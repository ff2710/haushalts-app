// Die Spar-Kaskade: verteilt das prognostizierte Restgeld eines Monats der
// Reihe nach auf Stufen — erst die Pflichten, dann die Ruecklagen, dann der
// Rest.
//
// Reine Funktion ohne Datenbankzugriff, damit sie gegen Kantenfaelle pruefbar
// ist. Genau das verlangt der Bauplan als Nachweis fuer Phase 3: "Restgeld-
// Logik stimmt bei Kantenfaellen (zu wenig Geld, Topf voll)".
//
// Grundregel: Was eine Stufe nicht bekommt, weil das Geld vorher aufgebraucht
// war, bleibt sichtbar offen. Die Kaskade rechnet nichts schoen und leiht
// nichts aus der Zukunft — bei Geld ist eine ehrliche Luecke mehr wert als
// eine gefuellte Zeile.

export type StepKind = 'fixed' | 'percent' | 'debts' | 'pots' | 'rest'

export interface CascadeStep {
  id: string
  name: string
  kind: StepKind
  amount: number | null
  percent: number | null
  position: number
  active: boolean
}

export interface CascadePot {
  id: string
  name: string
  /** null = ohne Ziel. */
  target_amount: number | null
  current_amount: number
  /** null = kein Monatsdeckel. */
  monthly_cap: number | null
  priority: number
  active: boolean
}

export interface CascadeDebt {
  id: string
  creditor: string
  initial_amount: number
  paid_amount: number
  /** null = nimmt, was uebrig bleibt. */
  monthly_rate: number | null
  priority: number
  active: boolean
}

/** Was eine Stufe an einen einzelnen Topf bzw. eine einzelne Schuld gibt. */
export interface CascadeShare {
  id: string
  name: string
  allocated: number
  /** Was danach noch fehlt — bis zum Topfziel bzw. bis zur Schuldenfreiheit. */
  remainingAfter: number
}

export interface CascadeStepResult {
  step: CascadeStep
  allocated: number
  /** Was die Stufe in diesem Monat gebraucht haette; null = unbegrenzt. */
  needed: number | null
  shares: CascadeShare[]
  /** Die Stufe hat weniger bekommen, als sie brauchte. */
  short: boolean
}

export interface CascadeResult {
  /** Der Betrag, mit dem gerechnet wurde (nie negativ). */
  input: number
  steps: CascadeStepResult[]
  /** Was nach der letzten Stufe uebrig bleibt. */
  leftover: number
  /** Summe dessen, was allen Stufen zusammen gefehlt hat. */
  shortfall: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Sortierung der Stufen: nach position, bei Gleichstand nach Name. */
const byPosition = (a: CascadeStep, b: CascadeStep) =>
  a.position - b.position || a.name.localeCompare(b.name, 'de')

/** Toepfe und Schulden werden in ihrer Prioritaet abgearbeitet. */
const byPriority = <T extends { priority: number; id: string }>(a: T, b: T) =>
  a.priority - b.priority || a.id.localeCompare(b.id)

/**
 * Rechnet die Kaskade durch.
 *
 * `input` ist das prognostizierte Restgeld (Einnahmen minus Fixkosten minus
 * variable Schaetzung). Ist es negativ, wird mit 0 gerechnet: in einem Monat,
 * der schon im Minus beginnt, gibt es nichts zu verteilen — und eine negative
 * Zuteilung waere sinnlos.
 */
export function runCascade(
  input: number,
  steps: CascadeStep[],
  pots: CascadePot[],
  debts: CascadeDebt[],
): CascadeResult {
  const start = Math.max(0, round2(Number(input) || 0))
  let pool = start

  /** Nimmt hoechstens `want` aus dem Topf und gibt zurueck, was wirklich floss. */
  const take = (want: number): number => {
    const give = round2(Math.min(pool, Math.max(0, want)))
    pool = round2(pool - give)
    return give
  }

  const activeSteps = steps.filter((s) => s.active).sort(byPosition)
  const activePots = pots.filter((p) => p.active).sort(byPriority)
  const activeDebts = debts.filter((d) => d.active).sort(byPriority)

  // Innerhalb eines Durchlaufs kann derselbe Topf von zwei Stufen bedient
  // werden. Ohne dieses Gedaechtnis bekaeme er zweimal denselben Restbedarf
  // zugeteilt und waere am Papier ueberfuellt.
  const potFilled = new Map<string, number>()
  const debtPaid = new Map<string, number>()

  const results: CascadeStepResult[] = []
  let shortfall = 0

  for (const step of activeSteps) {
    const shares: CascadeShare[] = []
    let needed: number | null = 0
    let allocated = 0

    switch (step.kind) {
      case 'fixed': {
        needed = round2(Math.max(0, step.amount ?? 0))
        allocated = take(needed)
        break
      }

      case 'percent': {
        // Bewusst am ANFAENGLICHEN Restgeld gemessen, nicht am Rest an dieser
        // Stelle: sonst haengt die Altersvorsorge davon ab, wie viel die
        // Stufen davor zufaellig verbraucht haben.
        needed = round2((start * Math.max(0, step.percent ?? 0)) / 100)
        allocated = take(needed)
        break
      }

      case 'debts': {
        for (const d of activeDebts) {
          const alreadyHere = debtPaid.get(d.id) ?? 0
          const open = round2(
            Math.max(0, Number(d.initial_amount) - Number(d.paid_amount) - alreadyHere),
          )
          if (open <= 0) continue
          // Die Wunschrate begrenzt, was in EINEM Monat fliesst; mehr als die
          // Restschuld ist nie noetig.
          const want = d.monthly_rate != null ? Math.min(Number(d.monthly_rate), open) : open
          needed = round2((needed ?? 0) + want)
          const give = take(want)
          allocated = round2(allocated + give)
          debtPaid.set(d.id, round2(alreadyHere + give))
          shares.push({
            id: d.id,
            name: d.creditor,
            allocated: give,
            remainingAfter: round2(open - give),
          })
        }
        break
      }

      case 'pots': {
        for (const p of activePots) {
          const alreadyHere = potFilled.get(p.id) ?? 0
          const openToTarget =
            p.target_amount != null
              ? round2(Math.max(0, Number(p.target_amount) - Number(p.current_amount) - alreadyHere))
              : null
          if (openToTarget !== null && openToTarget <= 0) continue

          const capLeft =
            p.monthly_cap != null ? round2(Math.max(0, Number(p.monthly_cap) - alreadyHere)) : null
          if (capLeft !== null && capLeft <= 0) continue

          // Ohne Ziel UND ohne Deckel nimmt ein Topf, was gerade da ist. Wer
          // das nicht will, setzt ein Ziel oder einen Deckel — die Reihenfolge
          // entscheidet dann, wer zuerst drankommt.
          const limits = [openToTarget, capLeft].filter((x): x is number => x !== null)
          const want = limits.length > 0 ? Math.min(...limits) : pool
          if (want <= 0) continue

          needed = round2((needed ?? 0) + want)
          const give = take(want)
          allocated = round2(allocated + give)
          potFilled.set(p.id, round2(alreadyHere + give))
          shares.push({
            id: p.id,
            name: p.name,
            allocated: give,
            remainingAfter: openToTarget !== null ? round2(openToTarget - give) : 0,
          })
        }
        break
      }

      case 'rest': {
        // Auffangstufe: nimmt alles Verbliebene und kann daher nie zu kurz
        // kommen.
        needed = null
        allocated = take(pool)
        break
      }
    }

    const missing = needed === null ? 0 : Math.max(0, round2(needed - allocated))
    const short = missing > 0.005
    if (short) shortfall = round2(shortfall + missing)

    results.push({ step, allocated: round2(allocated), needed, shares, short })
  }

  return {
    input: start,
    steps: results,
    leftover: round2(pool),
    shortfall: round2(shortfall),
  }
}

/**
 * Wie lange es bei gleichbleibender Rate noch dauert, bis eine Schuld getilgt
 * ist — als Zahl der Monate. null, wenn nichts fliesst (dann nie).
 *
 * Bewusst getrennt von der Kaskade: das ist eine Hochrechnung fuer die
 * Motivation, keine Zuteilung.
 */
export function monthsToClear(open: number, perMonth: number): number | null {
  if (open <= 0) return 0
  if (perMonth <= 0) return null
  return Math.ceil(round2(open) / round2(perMonth))
}
