// Bewertung eines Kategorie-Budgets. Bewusst an einer Stelle, weil sie an
// zwei Orten gebraucht wird (Uebersicht und Planung) und beide dasselbe sagen
// muessen — sonst warnt der eine Screen, waehrend der andere Entwarnung gibt.

export type BudgetLevel = 'none' | 'ok' | 'warn' | 'over'

export interface BudgetStatus {
  level: BudgetLevel
  /** Anteil des Budgets, 0 wenn keins gesetzt. Kann > 1 sein. */
  ratio: number
  /** Wieviel ueber dem Budget (0, wenn im Rahmen). */
  overBy: number
}

/**
 * `budget` null oder <= 0 bedeutet "kein Budget gesetzt" — dann gibt es nichts
 * zu bewerten. `warnRatio` ist der Anteil, ab dem gewarnt wird (0–1).
 */
export function budgetStatus(
  spent: number,
  budget: number | null,
  warnRatio: number,
): BudgetStatus {
  if (budget == null || budget <= 0) return { level: 'none', ratio: 0, overBy: 0 }
  const ratio = spent / budget
  if (spent > budget) return { level: 'over', ratio, overBy: spent - budget }
  if (ratio >= warnRatio) return { level: 'warn', ratio, overBy: 0 }
  return { level: 'ok', ratio, overBy: 0 }
}
