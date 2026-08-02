// Die 50/30/20-Ebene: die groebste Lesart der Ausgaben.
//
// Es gibt genau EINE Kette — Buchung -> Unterkategorie -> Hauptkategorie ->
// Topf. Dieser Modul ist die Stelle, an der das letzte Glied aufgeloest wird,
// und zwar fuer alle Ansichten dieselbe. Der Bauplan verlangt das ausdruecklich
// fuer Phase 3: "50/30/20-Ansicht und Kaskade beziehen ihre Bucket-Summen aus
// derselben Quelle (keine zweite Rechenstelle)."
//
// Warum Schuldentilgung in den Sparen-Topf gehoert: ein getilgter Euro erhoeht
// das Nettovermoegen genauso wie ein gesparter. Wer eine Kategorie
// "Schulden tilgen" als 'sparen' markiert, sieht das automatisch richtig — es
// braucht dafuer keine Sonderbehandlung im Code.

export type Bucket = 'fix' | 'freizeit' | 'sparen'

export const BUCKETS: Bucket[] = ['fix', 'freizeit', 'sparen']

export const BUCKET_LABEL: Record<Bucket, string> = {
  fix: 'Fixkosten',
  freizeit: 'Freizeit',
  sparen: 'Sparen',
}

/** Die klassische Aufteilung. Anpassbar, deshalb ueberall als Parameter. */
export const DEFAULT_TARGETS: Record<Bucket, number> = { fix: 50, freizeit: 30, sparen: 20 }

export interface BucketCategory {
  id: string
  parent_id: string | null
  planning_bucket?: Bucket | null
}

export interface BucketTransaction {
  type: 'income' | 'expense'
  amount: number
  category_id: string | null
}

/**
 * Der Topf einer Kategorie. Unterkategorien tragen keinen eigenen und erben
 * ihn vom Elternteil — genau wie die Farbe.
 *
 * null heisst "nicht zugeordnet", nicht "gehoert nirgends hin". Der
 * Unterschied ist wichtig: nicht zugeordnete Ausgaben werden ausgewiesen statt
 * stillschweigend auf die drei Toepfe verteilt.
 */
export function bucketOf(
  categoryId: string | null,
  categories: BucketCategory[],
): Bucket | null {
  if (!categoryId) return null
  return resolve(categoryId, new Map(categories.map((c) => [c.id, c])))
}

/**
 * Dasselbe fuer viele Abfragen hintereinander: baut den Index einmal und gibt
 * eine Funktion zurueck. Wer in einer Schleife ueber Buchungen laeuft, nimmt
 * die — bucketOf wuerde sonst je Buchung den ganzen Index neu aufbauen.
 */
export function bucketResolver(categories: BucketCategory[]): (id: string | null) => Bucket | null {
  const byId = new Map(categories.map((c) => [c.id, c]))
  return (categoryId) => (categoryId ? resolve(categoryId, byId) : null)
}

function resolve(categoryId: string, byId: Map<string, BucketCategory>): Bucket | null {
  const cat = byId.get(categoryId)
  if (!cat) return null
  if (!cat.parent_id) return cat.planning_bucket ?? null
  const parent = byId.get(cat.parent_id)
  // Elternteil nicht auffindbar: die Kategorie wie eine Hauptkategorie
  // behandeln, statt zu raten.
  return (parent ?? cat).planning_bucket ?? null
}

export interface BucketTotals {
  fix: number
  freizeit: number
  sparen: number
  /** Ausgaben in Kategorien ohne Topf — plus alles ohne Kategorie. */
  unassigned: number
  /** Alle Ausgaben zusammen. */
  expense: number
  income: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Summiert die Ausgaben eines Zeitraums auf die drei Toepfe. */
export function bucketTotals(
  transactions: BucketTransaction[],
  categories: BucketCategory[],
): BucketTotals {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const out = { fix: 0, freizeit: 0, sparen: 0, unassigned: 0, expense: 0, income: 0 }

  for (const t of transactions) {
    const amount = Math.abs(Number(t.amount)) || 0
    if (amount === 0) continue
    if (t.type === 'income') {
      out.income += amount
      continue
    }
    out.expense += amount
    const bucket = t.category_id ? resolve(t.category_id, byId) : null
    if (bucket) out[bucket] += amount
    else out.unassigned += amount
  }

  return {
    fix: round2(out.fix),
    freizeit: round2(out.freizeit),
    sparen: round2(out.sparen),
    unassigned: round2(out.unassigned),
    expense: round2(out.expense),
    income: round2(out.income),
  }
}

export interface BucketStatus {
  bucket: Bucket
  amount: number
  /** Anteil an den Einnahmen in Prozent; 0 ohne Einnahmen. */
  share: number
  /** Zielanteil in Prozent. */
  target: number
  /** Der Zielbetrag in Euro. */
  targetAmount: number
  /**
   * Abstand zum Ziel in Euro. Positiv = ueber dem Ziel.
   *
   * Bewusst in Euro und nicht nur in Prozentpunkten: "34 Prozent statt 50" sagt
   * einem nicht, was zu tun waere. "520 Euro zu viel" schon.
   */
  deltaAmount: number
}

/**
 * Ist gegen Soll, gemessen an den EINNAHMEN des Zeitraums — nicht an den
 * Ausgaben. 50/30/20 ist eine Aussage darueber, wohin das Einkommen geht;
 * gegen die Ausgaben gerechnet ergaeben die drei Anteile immer 100 Prozent
 * und die Aussage waere verloren.
 */
export function bucketStatuses(
  totals: BucketTotals,
  targets: Record<Bucket, number> = DEFAULT_TARGETS,
): BucketStatus[] {
  return BUCKETS.map((bucket) => {
    const amount = totals[bucket]
    const target = targets[bucket]
    const targetAmount = round2((totals.income * target) / 100)
    return {
      bucket,
      amount,
      share: totals.income > 0 ? round2((amount / totals.income) * 100) : 0,
      target,
      targetAmount,
      deltaAmount: round2(amount - targetAmount),
    }
  })
}
