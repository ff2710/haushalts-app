// Baut aus Umsaetzen und Kategorien den Geldfluss-Baum fuer Sankey und Donut.
//
// Reine Funktion ohne Datenbankzugriff — so laesst sich programmatisch pruefen,
// was der Bauplan fuer Phase 2.5 verlangt: die Kanten einer Ebene muessen sich
// exakt auf ihren Elternknoten summieren, und die Prozentansicht muss dieselben
// Daten beschreiben wie die Euro-Ansicht.
//
// Der Fluss hat vier Ebenen:
//   Einnahme-Kategorien -> Budget -> Ausgaben-Hauptkategorie -> Unterkategorie
//
// Damit die Summen auf jeder Ebene aufgehen, bekommt eine Hauptkategorie, auf
// die auch direkt gebucht wurde, einen zusaetzlichen Rest-Knoten "Direkt
// gebucht". Ohne den waere die Unterkategorie-Ebene stillschweigend kleiner als
// die Ebene darueber — und genau solche stillen Luecken sind bei Geld das
// Gefaehrliche.

import { categoryColorMap } from './categoryColors'
import { bucketResolver } from './buckets'

export type NodeKind = 'income' | 'budget' | 'category' | 'subcategory'

export interface FlowNode {
  /** Stabil ueber Neuberechnungen hinweg (fuer Hover/Auswahl). */
  id: string
  name: string
  /** Summe in Euro, immer positiv. */
  value: number
  color: string
  kind: NodeKind
  /** Kategorie dahinter; null beim Budget-Knoten und bei Rest-Knoten. */
  categoryId: string | null
  /** Spalte im Diagramm: 0 Einnahmen, 1 Budget, 2 Hauptkategorie, 3 Unterkategorie. */
  depth: 0 | 1 | 2 | 3
}

export interface FlowLink {
  source: string
  target: string
  value: number
}

export interface Cashflow {
  nodes: FlowNode[]
  links: FlowLink[]
  income: number
  expense: number
  /** Einnahmen minus Ausgaben. Kann negativ sein. */
  saldo: number
  /** Ausgaben ohne Kategorie — im Fluss als eigener Knoten, hier nochmal fuer Hinweise. */
  uncategorizedExpense: number

  /**
   * Was in Kategorien des Topfes "sparen" geflossen ist — gezielt angelegtes
   * Geld also, das als Ausgabe gebucht ist (ETF-Sparplan, Ruecklage).
   */
  savedDeliberate: number
  /**
   * Gespart insgesamt: was gezielt angelegt wurde PLUS was am Ende uebrig
   * blieb. Beides hat den Monat ueberlebt, und beides erhoeht das Vermoegen —
   * nur der Weg dahin ist verschieden.
   *
   * Kann negativ sein: wer mehr ausgibt als einnimmt, hat entspart.
   */
  saved: number
  /** saved / Einnahmen. 0, wenn es keine Einnahmen gab. */
  savingsRate: number
}

/** Minimalform einer Buchung — nur, was der Fluss braucht. */
export interface FlowTransaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  category_id: string | null
}

export interface FlowCategory {
  id: string
  name: string
  type: 'income' | 'expense'
  color: string
  parent_id: string | null
  /** Planungs-Topf der Hauptkategorie; Unterkategorien erben ihn. */
  planning_bucket?: 'fix' | 'freizeit' | 'sparen' | null
}

// Als Konstanten exportiert, nicht als Literale verstreut: bookingsForNode
// muss dieselben Knoten erkennen, die buildCashflow gebaut hat. Zwei Stellen
// mit demselben getippten String waeren eine stille Bruchstelle.
export const BUDGET_ID = 'budget'
export const SURPLUS_ID = 'surplus'
export const NO_CATEGORY_INCOME = 'income:none'
export const NO_CATEGORY_EXPENSE = 'expense:none'
const NEUTRAL = '#94a3b8'

/** Rest-Knoten einer Hauptkategorie, auf die auch direkt gebucht wurde. */
export const directNodeId = (categoryId: string) => `direct:${categoryId}`

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildCashflow(
  transactions: FlowTransaction[],
  categories: FlowCategory[],
): Cashflow {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const colors = categoryColorMap(categories)
  // Ein Index fuer alle Buchungen — die Aufloesung selbst steht in
  // lib/buckets.ts und wird hier nicht nachgebaut.
  const bucketOfCategory = bucketResolver(categories)

  // Wo gehoert eine Buchung hin? Auf eine Unterkategorie gebucht heisst: sie
  // zaehlt zusaetzlich auf deren Hauptkategorie.
  const mainOf = (categoryId: string | null) => {
    if (!categoryId) return null
    const c = byId.get(categoryId)
    if (!c) return null
    if (!c.parent_id) return c
    return byId.get(c.parent_id) ?? c
  }

  let income = 0
  let expense = 0
  let uncategorizedExpense = 0
  let savedDeliberate = 0

  // Summen je Knoten
  const incomeByCat = new Map<string, number>()
  let incomeNoCat = 0
  const expenseByMain = new Map<string, number>()
  const expenseBySub = new Map<string, number>()
  /** Direkt auf die Hauptkategorie gebucht, nicht auf eine Unterkategorie. */
  const expenseDirect = new Map<string, number>()
  let expenseNoCat = 0

  for (const t of transactions) {
    const amount = Math.abs(Number(t.amount)) || 0
    if (amount === 0) continue

    if (t.type === 'income') {
      income += amount
      // Einnahmen bleiben auf Hauptkategorie-Ebene: die linke Spalte traegt
      // ohnehin schon die meisten Namen, eine weitere Aufteilung waere auf
      // schmalen Screens nicht mehr lesbar.
      const main = mainOf(t.category_id)
      if (!main) incomeNoCat += amount
      else incomeByCat.set(main.id, (incomeByCat.get(main.id) ?? 0) + amount)
      continue
    }

    expense += amount
    const cat = t.category_id ? byId.get(t.category_id) : undefined
    if (!cat) {
      expenseNoCat += amount
      uncategorizedExpense += amount
      continue
    }
    const main = cat.parent_id ? (byId.get(cat.parent_id) ?? cat) : cat
    // Der Topf wird ueber lib/buckets.ts aufgeloest, nicht hier noch einmal
    // nachgebaut. Zwei Implementierungen derselben Regel driften auseinander,
    // sobald sich die Regel aendert — und dann sagte die Uebersicht etwas
    // anderes als die 50/30/20-Ansicht.
    if (bucketOfCategory(cat.id) === 'sparen') savedDeliberate += amount
    expenseByMain.set(main.id, (expenseByMain.get(main.id) ?? 0) + amount)
    if (cat.parent_id && byId.has(cat.parent_id)) {
      expenseBySub.set(cat.id, (expenseBySub.get(cat.id) ?? 0) + amount)
    } else {
      expenseDirect.set(main.id, (expenseDirect.get(main.id) ?? 0) + amount)
    }
  }

  const nodes: FlowNode[] = []
  const links: FlowLink[] = []

  // ── Spalte 0: Einnahmen ───────────────────────────────────────────────────
  const incomeEntries = [...incomeByCat.entries()]
    .map(([id, value]) => ({ cat: byId.get(id)!, value }))
    .sort((a, b) => b.value - a.value || a.cat.name.localeCompare(b.cat.name, 'de'))

  for (const { cat, value } of incomeEntries) {
    nodes.push({
      id: `cat:${cat.id}`,
      name: cat.name,
      value: round2(value),
      color: colors.get(cat.id) ?? cat.color,
      kind: 'income',
      categoryId: cat.id,
      depth: 0,
    })
    links.push({ source: `cat:${cat.id}`, target: BUDGET_ID, value: round2(value) })
  }
  if (incomeNoCat > 0) {
    nodes.push({
      id: NO_CATEGORY_INCOME,
      name: 'Ohne Kategorie',
      value: round2(incomeNoCat),
      color: NEUTRAL,
      kind: 'income',
      categoryId: null,
      depth: 0,
    })
    links.push({ source: NO_CATEGORY_INCOME, target: BUDGET_ID, value: round2(incomeNoCat) })
  }

  // ── Spalte 1: Budget ──────────────────────────────────────────────────────
  // Der Knoten traegt, was tatsaechlich durchlaeuft. Sind die Ausgaben groesser
  // als die Einnahmen (aus Ruecklagen gelebt), waere ein Budget in Hoehe der
  // Einnahmen kleiner als die abgehenden Kanten — das Bild wuerde luegen.
  const budgetValue = Math.max(income, expense)
  nodes.push({
    id: BUDGET_ID,
    name: 'Budget',
    value: round2(budgetValue),
    color: NEUTRAL,
    kind: 'budget',
    categoryId: null,
    depth: 1,
  })

  // Mehr Einnahmen als Ausgaben: der Ueberschuss braucht ein Ziel, sonst
  // endet im Budget-Knoten Geld im Nichts.
  const surplus = round2(income - expense)

  // ── Spalte 2 und 3: Ausgaben ──────────────────────────────────────────────
  const mainEntries = [...expenseByMain.entries()]
    .map(([id, value]) => ({ cat: byId.get(id)!, value }))
    .sort((a, b) => b.value - a.value || a.cat.name.localeCompare(b.cat.name, 'de'))

  for (const { cat, value } of mainEntries) {
    const nodeId = `cat:${cat.id}`
    nodes.push({
      id: nodeId,
      name: cat.name,
      value: round2(value),
      color: colors.get(cat.id) ?? cat.color,
      kind: 'category',
      categoryId: cat.id,
      depth: 2,
    })
    links.push({ source: BUDGET_ID, target: nodeId, value: round2(value) })

    const subs = categories
      .filter((c) => c.parent_id === cat.id && (expenseBySub.get(c.id) ?? 0) > 0)
      .map((c) => ({ cat: c, value: expenseBySub.get(c.id) as number }))
      .sort((a, b) => b.value - a.value || a.cat.name.localeCompare(b.cat.name, 'de'))

    if (subs.length === 0) continue

    for (const sub of subs) {
      const subId = `cat:${sub.cat.id}`
      nodes.push({
        id: subId,
        name: sub.cat.name,
        value: round2(sub.value),
        color: colors.get(sub.cat.id) ?? sub.cat.color,
        kind: 'subcategory',
        categoryId: sub.cat.id,
        depth: 3,
      })
      links.push({ source: nodeId, target: subId, value: round2(sub.value) })
    }

    // Rest, der direkt auf der Hauptkategorie gebucht wurde: eigener Knoten,
    // damit sich Ebene 3 exakt auf Ebene 2 summiert.
    const direct = expenseDirect.get(cat.id) ?? 0
    if (direct > 0) {
      const restId = directNodeId(cat.id)
      nodes.push({
        id: restId,
        name: 'Direkt gebucht',
        value: round2(direct),
        color: colors.get(cat.id) ?? cat.color,
        kind: 'subcategory',
        categoryId: cat.id,
        depth: 3,
      })
      links.push({ source: nodeId, target: restId, value: round2(direct) })
    }
  }

  if (expenseNoCat > 0) {
    nodes.push({
      id: NO_CATEGORY_EXPENSE,
      name: 'Ohne Kategorie',
      value: round2(expenseNoCat),
      color: NEUTRAL,
      kind: 'category',
      categoryId: null,
      depth: 2,
    })
    links.push({ source: BUDGET_ID, target: NO_CATEGORY_EXPENSE, value: round2(expenseNoCat) })
  }

  if (surplus > 0) {
    nodes.push({
      id: SURPLUS_ID,
      name: 'Übrig geblieben',
      value: surplus,
      color: '#16a34a',
      kind: 'category',
      categoryId: null,
      depth: 2,
    })
    links.push({ source: BUDGET_ID, target: SURPLUS_ID, value: surplus })
  }

  return {
    nodes,
    links,
    income: round2(income),
    expense: round2(expense),
    saldo: round2(income - expense),
    uncategorizedExpense: round2(uncategorizedExpense),
    savedDeliberate: round2(savedDeliberate),
    saved: round2(income - expense + savedDeliberate),
    savingsRate: income > 0 ? (income - expense + savedDeliberate) / income : 0,
  }
}

/** Knoten einer Ebene, in Zeichenreihenfolge. */
export function nodesAtDepth(flow: Cashflow, depth: number): FlowNode[] {
  return flow.nodes.filter((n) => n.depth === depth)
}

/**
 * Die Buchungen hinter einem Knoten.
 *
 * Steht bewusst hier neben buildCashflow und nicht in der Komponente: die
 * Zuordnung "welche Buchung steckt in diesem Knoten" gibt es damit genau
 * einmal. Zweimal formuliert — einmal beim Summieren, einmal beim Auflisten —
 * koennten die beiden auseinanderlaufen, und dann zeigte das Buchungsblatt
 * andere Zahlen als die Kante, aus der es geoeffnet wurde. Bei Geld ist das
 * kein Schoenheitsfehler.
 *
 * Zusicherung, die in der Pruefung nachgerechnet wird: die Summe der
 * zurueckgegebenen Buchungen ist der Wert des Knotens.
 *
 * Zwei benannte Ausnahmen, beide keine Kategorie-Knoten:
 *  - Budget: traegt max(Einnahmen, Ausgaben); aufgelistet werden die Ausgaben,
 *    denn das ist es, was aus dem Topf herausgeht.
 *  - Uebrig geblieben: eine Rechengroesse, dahinter steckt keine Buchung.
 */
export function bookingsForNode<T extends FlowTransaction>(
  node: FlowNode,
  transactions: T[],
  categories: FlowCategory[],
): T[] {
  if (node.id === BUDGET_ID) return transactions.filter((t) => t.type === 'expense')
  // Der Ueberschuss ist eine Rechengroesse, keine Buchung.
  if (node.id === SURPLUS_ID) return []

  // "Ohne Kategorie" heisst hier dasselbe wie in buildCashflow: entweder gar
  // keine Kategorie, ODER eine, die es nicht mehr gibt. Nur auf null zu pruefen
  // waere enger als das Summieren — nach dem Loeschen einer Kategorie zeigte
  // das Buchungsblatt dann weniger Zeilen, als der Knoten verspricht.
  const known = new Set(categories.map((c) => c.id))
  const orphan = (t: FlowTransaction) => !t.category_id || !known.has(t.category_id)
  if (node.id === NO_CATEGORY_INCOME)
    return transactions.filter((t) => t.type === 'income' && orphan(t))
  if (node.id === NO_CATEGORY_EXPENSE)
    return transactions.filter((t) => t.type === 'expense' && orphan(t))

  if (!node.categoryId) return []

  // Rest-Knoten: ausschliesslich das, was direkt auf der Hauptkategorie liegt.
  if (node.id.startsWith('direct:'))
    return transactions.filter((t) => t.type === 'expense' && t.category_id === node.categoryId)

  if (node.kind === 'subcategory')
    return transactions.filter((t) => t.type === 'expense' && t.category_id === node.categoryId)

  // Haupt- oder Einnahme-Kategorie: sie selbst und alles darunter.
  const own = new Set<string>([node.categoryId])
  for (const c of categories) if (c.parent_id === node.categoryId) own.add(c.id)
  const wanted = node.kind === 'income' ? 'income' : 'expense'

  return transactions.filter(
    (t) => t.type === wanted && t.category_id !== null && own.has(t.category_id),
  )
}
