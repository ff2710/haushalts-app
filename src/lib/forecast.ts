// Monatsend-Prognose. Port aus dem Finanztracker:
//   - Amortisierung  -> docs/finanztracker-reference/server/forecast.js
//   - Zusammenbau    -> docs/finanztracker-reference/server/index.js:631-671
// Die Rechenregeln sind woertlich uebernommen, inklusive der Rundungsreihenfolge
// (jede Fixkosten-Position einzeln auf Cent gerundet, DANN summiert) — sonst
// weichen Summen um Cent-Betraege ab.
//
// Bewusst reine Funktionen ohne Datenbankzugriff: so sind sie gegen das
// Original testbar (siehe Verifikation in Phase 2).

const PERIOD: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
  once: 0,
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** "YYYY-MM" -> fortlaufender Monatsindex (Jahr*12 + Monat). */
export function monthIndex(ym: string): number {
  const [y, m] = String(ym).split('-').map(Number)
  return y * 12 + (m - 1)
}

export function indexToMonth(idx: number): string {
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

/** Minimalform eines Fixkostens — nur, was die Rechnung braucht. */
export interface FixedCostLike {
  amount: number
  cadence: string
  due_month?: string | null
  start_month?: string | null
  amortize?: boolean
  active?: boolean
}

/**
 * Monatsbeitrag eines Fixkostens fuer den Monat `month`. Immer >= 0.
 *
 * Nicht-monatliche Posten werden ueber ihren Spar-Zyklus verteilt (amortize),
 * damit die Prognose nicht im Faelligkeitsmonat einbricht.
 */
export function monthlyContribution(fc: FixedCostLike, month: string): number {
  const M = monthIndex(month)
  const amount = Number(fc.amount) || 0
  if (!amount || !fc.active) return 0

  // Monatliche Fixkosten: ab dem Startmonat (oder immer) der volle Betrag.
  if (fc.cadence === 'monthly') {
    const start = fc.start_month ? monthIndex(fc.start_month) : -Infinity
    return M >= start ? amount : 0
  }

  // Nicht-monatlich: es braucht ein Faelligkeitsdatum.
  if (!fc.due_month) return 0
  let due = monthIndex(fc.due_month)
  let start = fc.start_month ? monthIndex(fc.start_month) : due

  // Einmalig: kein Zyklus, nur das eine Fenster [start..due].
  if (fc.cadence === 'once') {
    if (M < start || M > due) return 0
    if (fc.amortize) {
      const N = due - start + 1
      return N > 0 ? amount / N : amount
    }
    return M === due ? amount : 0
  }

  // Zyklisch: Fenster vorrollen, bis die Faelligkeit >= gesuchtem Monat liegt.
  const period = PERIOD[fc.cadence]
  let guard = 0
  while (due < M && guard < 2000) {
    start = due + 1 // neues Fenster beginnt direkt nach alter Faelligkeit
    due = due + period
    guard++
  }

  if (M < start) return 0 // Sparen fuer dieses Fenster hat noch nicht begonnen
  if (fc.amortize) {
    const N = due - start + 1
    return N > 0 ? amount / N : amount
  }
  return M === due ? amount : 0
}

/** Ist ein Fixkosten im gegebenen Monat tatsaechlich faellig (Zahlungsmonat)? */
export function isDueInMonth(fc: FixedCostLike, month: string): boolean {
  if (fc.cadence === 'monthly') {
    const start = fc.start_month ? monthIndex(fc.start_month) : -Infinity
    return monthIndex(month) >= start
  }
  if (!fc.due_month) return false
  const M = monthIndex(month)
  let due = monthIndex(fc.due_month)
  if (fc.cadence === 'once') return due === M
  const period = PERIOD[fc.cadence]
  let guard = 0
  while (due < M && guard < 2000) {
    due += period
    guard++
  }
  return due === M
}

export interface RecurringIncomeLike {
  amount: number
  start_month: string
  end_month?: string | null
  active?: boolean
}

/** Betrag einer regelmaessigen Einnahme im gegebenen Monat (0, wenn ausserhalb). */
export function recurringAmountForMonth(ri: RecurringIncomeLike, month: string): number {
  if (!ri.active) return 0
  if (month < ri.start_month) return 0
  if (ri.end_month && month > ri.end_month) return 0
  return Number(ri.amount) || 0
}

export interface ForecastInput {
  fixedCosts: (FixedCostLike & { id: string; name: string })[]
  recurringIncomes: RecurringIncomeLike[]
  variableEstimates: { amount: number }[]
  /** Ausgaben-Summen je Monat ('YYYY-MM' -> Summe), fuer den Vorschlagswert. */
  monthlyExpenseTotals: { month: string; total: number }[]
}

export interface ForecastResult {
  month: string
  expectedIncome: number
  fixedMonthly: number
  fixedBreakdown: { id: string; name: string; monthly: number }[]
  variableEstimate: number
  /** Was am Monatsende uebrig bleibt: Einnahmen − Fixkosten − Schaetzung. */
  leftover: number
  /** Ø Gesamt-Ausgaben der letzten bis zu 3 Monate MIT Daten; null wenn keine. */
  variableSuggestion: number | null
}

export function computeForecast(input: ForecastInput, month: string): ForecastResult {
  const expectedIncome = input.recurringIncomes.reduce(
    (s, ri) => s + recurringAmountForMonth(ri, month),
    0,
  )

  // Rundung je Position VOR der Summe — genau wie im Original.
  const fixedBreakdown = input.fixedCosts
    .map((fc) => ({ id: fc.id, name: fc.name, monthly: round2(monthlyContribution(fc, month)) }))
    .filter((f) => f.monthly > 0)
  const fixedMonthly = fixedBreakdown.reduce((s, f) => s + f.monthly, 0)

  const variableEstimate = input.variableEstimates.reduce((s, v) => s + (Number(v.amount) || 0), 0)

  // Vorschlag: Ø der bis zu 3 juengsten Monate MIT Daten, ohne den aktuellen.
  const previous = input.monthlyExpenseTotals
    .filter((r) => r.month < month)
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 3)
  const variableSuggestion =
    previous.length > 0
      ? round2(previous.reduce((s, r) => s + r.total, 0) / previous.length)
      : null

  return {
    month,
    expectedIncome: round2(expectedIncome),
    fixedMonthly: round2(fixedMonthly),
    fixedBreakdown,
    variableEstimate: round2(variableEstimate),
    leftover: round2(expectedIncome - fixedMonthly - variableEstimate),
    variableSuggestion,
  }
}
