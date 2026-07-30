import { supabase } from '../lib/supabase'
import {
  TABLE,
  PF_DEFAULT_CATEGORIES,
  PF_TX_PAGE_SIZE,
  PF_SUGGESTION_SCAN_LIMIT,
} from '../constants'
import { makeDedupKey } from '../lib/dedup'
import type {
  PfAccountInput,
  PfCashLocationInput,
  PfCategoryInput,
  PfFixedCostInput,
  PfRecurringIncomeInput,
  PfTransactionInput,
  PfVariableEstimateInput,
} from '../types'

// Duenne Supabase-Wrapper fuer den Persoenlich-Bereich — gleiches Muster wie
// financeService.ts.
//
// WICHTIG: owner_id wird hier NIE mitgeschickt. Die Spalte hat in Postgres
// `default auth.uid()`, und die RLS-Policy erzwingt `owner_id = auth.uid()`.
// Das Frontend kann damit weder fremde Daten lesen noch fremde anlegen.
// Die Selects brauchen aus demselben Grund keinen .eq('owner_id', ...) —
// RLS filtert bereits serverseitig.

export async function fetchAccounts() {
  return supabase.from(TABLE.PF_ACCOUNTS).select('*').order('position', { ascending: true })
}

export async function fetchCategories() {
  return supabase.from(TABLE.PF_CATEGORIES).select('*').order('name', { ascending: true })
}

export async function addAccount(data: PfAccountInput) {
  return supabase.from(TABLE.PF_ACCOUNTS).insert(data).select().single()
}

export async function updateAccount(id: string, data: Partial<PfAccountInput>) {
  return supabase.from(TABLE.PF_ACCOUNTS).update(data).eq('id', id)
}

export async function deleteAccount(id: string) {
  return supabase.from(TABLE.PF_ACCOUNTS).delete().eq('id', id)
}

// ---------------------------------------------------------------------------
// Bargeld: selbst gesetzter Stand, optional auf Orte aufgeteilt.
// ---------------------------------------------------------------------------

export async function fetchCashLocations() {
  return supabase
    .from(TABLE.PF_CASH_LOCATIONS)
    .select('*')
    .order('position', { ascending: true })
}

export async function addCashLocation(data: PfCashLocationInput) {
  return supabase.from(TABLE.PF_CASH_LOCATIONS).insert(data).select().single()
}

export async function updateCashLocation(id: string, data: Partial<PfCashLocationInput>) {
  return supabase.from(TABLE.PF_CASH_LOCATIONS).update(data).eq('id', id)
}

export async function deleteCashLocation(id: string) {
  return supabase.from(TABLE.PF_CASH_LOCATIONS).delete().eq('id', id)
}

export async function addCategory(data: PfCategoryInput) {
  return supabase.from(TABLE.PF_CATEGORIES).insert(data).select().single()
}

export async function updateCategory(id: string, data: Partial<PfCategoryInput>) {
  return supabase.from(TABLE.PF_CATEGORIES).update(data).eq('id', id)
}

export async function deleteCategory(id: string) {
  return supabase.from(TABLE.PF_CATEGORIES).delete().eq('id', id)
}

/**
 * Legt die Standard-Kategorien fuer die aktuell angemeldete Person an.
 * Der Unique-Index (owner_id, name, type) macht das idempotent: ein zweiter
 * Aufruf legt nichts doppelt an. Wird nur aufgerufen, wenn die Person noch
 * gar keine Kategorien hat.
 */
export async function seedDefaultCategories() {
  return supabase
    .from(TABLE.PF_CATEGORIES)
    .insert(PF_DEFAULT_CATEGORIES.map((c) => ({ ...c })))
    .select()
}

// ---------------------------------------------------------------------------
// Transaktionen
//
// dedup_key wird hier zentral berechnet — nicht in den Aufrufern. So kann kein
// Eingabepfad ihn vergessen, und der Schluessel bleibt ueber manuelle Erfassung
// und CSV-Import hinweg konsistent.
// ---------------------------------------------------------------------------

export async function fetchTransactions(limit = PF_TX_PAGE_SIZE) {
  return supabase
    .from(TABLE.PF_TRANSACTIONS)
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
}

/**
 * ALLE Umsaetze eines Monats — ohne die Obergrenze von fetchTransactions.
 *
 * Wichtig fuer Geld-Anzeigen (Monatssaldo, Budget-Verbrauch): die Liste im
 * Context haelt nur die juengsten PF_TX_PAGE_SIZE Zeilen. Haette ein Monat mehr
 * Buchungen als das, wuerden Summen daraus stillschweigend zu niedrig
 * ausfallen. Deshalb hier monatsgenau und unbegrenzt laden.
 */
export async function fetchTransactionsForMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return supabase
    .from(TABLE.PF_TRANSACTIONS)
    .select('*')
    .gte('date', `${month}-01`)
    .lt('date', next)
    .order('date', { ascending: false })
}

/**
 * Alle Umsaetze eines Zeitraums — Grundlage der Analyse-Ansicht.
 *
 * `endExclusive` ist bewusst exklusiv (lt statt lte): so passen die Grenzen
 * direkt auf die Zeitraeume aus lib/period.ts, und der Monatsletzte kann weder
 * doppelt noch gar nicht gezaehlt werden.
 *
 * Ohne Obergrenze, wie fetchTransactionsForMonth: aus diesen Zeilen werden
 * Geldsummen gebildet, und eine stillschweigend abgeschnittene Liste ergaebe
 * stillschweigend zu kleine Summen.
 */
export async function fetchTransactionsBetween(start: string, endExclusive: string) {
  return supabase
    .from(TABLE.PF_TRANSACTIONS)
    .select('*')
    .gte('date', start)
    .lt('date', endExclusive)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
}

/** Vergleichsdaten fuer die Dubletten-Pruefung (Datumsfenster aus dedupWindow).
 *  RLS liefert ausschliesslich eigene Zeilen. */
export async function fetchTransactionsInRange(from: string, to: string) {
  return supabase
    .from(TABLE.PF_TRANSACTIONS)
    .select('*')
    .gte('date', from)
    .lte('date', to)
}

export async function addTransaction(data: PfTransactionInput) {
  return supabase
    .from(TABLE.PF_TRANSACTIONS)
    .insert({ ...data, dedup_key: makeDedupKey(data) })
    .select()
    .single()
}

export async function updateTransaction(id: string, data: Partial<PfTransactionInput>) {
  // Aendert sich etwas an den Schluesselfeldern, muss der dedup_key mitziehen.
  const patch: Record<string, unknown> = { ...data }
  if (
    data.date !== undefined ||
    data.type !== undefined ||
    data.amount !== undefined ||
    data.description !== undefined
  ) {
    const { data: current } = await supabase
      .from(TABLE.PF_TRANSACTIONS)
      .select('date,type,amount,description')
      .eq('id', id)
      .single()
    if (current) patch.dedup_key = makeDedupKey({ ...current, ...data })
  }
  return supabase.from(TABLE.PF_TRANSACTIONS).update(patch).eq('id', id)
}

export async function deleteTransaction(id: string) {
  return supabase.from(TABLE.PF_TRANSACTIONS).delete().eq('id', id)
}

// ---------------------------------------------------------------------------
// Import-Batches — ein Import bleibt dadurch rueckgaengig machbar.
// ---------------------------------------------------------------------------

export async function fetchImportBatches() {
  return supabase
    .from(TABLE.PF_IMPORT_BATCHES)
    .select('*')
    .order('imported_at', { ascending: false })
}

export async function createImportBatch(filename: string, rowCount: number) {
  return supabase
    .from(TABLE.PF_IMPORT_BATCHES)
    .insert({ filename, row_count: rowCount })
    .select()
    .single()
}

/** Legt die Zeilen eines Imports an — alle mit derselben batchId verknuepft. */
export async function addTransactionsForBatch(
  rows: PfTransactionInput[],
  batchId: string,
) {
  return supabase
    .from(TABLE.PF_TRANSACTIONS)
    .insert(
      rows.map((r) => ({
        ...r,
        import_batch_id: batchId,
        source: 'csv' as const,
        dedup_key: makeDedupKey(r),
      })),
    )
    .select()
}

/** Import rueckgaengig: Batch loeschen entfernt per FK-Cascade genau die
 *  Transaktionen dieses Imports — nichts anderes. */
export async function deleteImportBatch(id: string) {
  return supabase.from(TABLE.PF_IMPORT_BATCHES).delete().eq('id', id)
}

// ---------------------------------------------------------------------------
// Planungs-Ebene (Phase 2): Fixkosten, regelmaessige Einnahmen, Schaetzposten
// ---------------------------------------------------------------------------

export async function fetchFixedCosts() {
  return supabase.from(TABLE.PF_FIXED_COSTS).select('*').order('name', { ascending: true })
}

export async function addFixedCost(data: PfFixedCostInput) {
  return supabase.from(TABLE.PF_FIXED_COSTS).insert(data).select().single()
}

export async function updateFixedCost(id: string, data: Partial<PfFixedCostInput>) {
  return supabase.from(TABLE.PF_FIXED_COSTS).update(data).eq('id', id)
}

export async function deleteFixedCost(id: string) {
  return supabase.from(TABLE.PF_FIXED_COSTS).delete().eq('id', id)
}

export async function fetchRecurringIncome() {
  return supabase.from(TABLE.PF_RECURRING_INCOME).select('*').order('name', { ascending: true })
}

export async function addRecurringIncome(data: PfRecurringIncomeInput) {
  return supabase.from(TABLE.PF_RECURRING_INCOME).insert(data).select().single()
}

export async function updateRecurringIncome(id: string, data: Partial<PfRecurringIncomeInput>) {
  return supabase.from(TABLE.PF_RECURRING_INCOME).update(data).eq('id', id)
}

export async function deleteRecurringIncome(id: string) {
  return supabase.from(TABLE.PF_RECURRING_INCOME).delete().eq('id', id)
}

export async function fetchVariableEstimates() {
  return supabase
    .from(TABLE.PF_VARIABLE_ESTIMATES)
    .select('*')
    .order('created_at', { ascending: true })
}

export async function addVariableEstimate(data: PfVariableEstimateInput) {
  return supabase.from(TABLE.PF_VARIABLE_ESTIMATES).insert(data).select().single()
}

export async function updateVariableEstimate(id: string, data: Partial<PfVariableEstimateInput>) {
  return supabase.from(TABLE.PF_VARIABLE_ESTIMATES).update(data).eq('id', id)
}

export async function deleteVariableEstimate(id: string) {
  return supabase.from(TABLE.PF_VARIABLE_ESTIMATES).delete().eq('id', id)
}

/**
 * Ausgaben-Summen je Monat VOR `month` — Grundlage fuer den Vorschlagswert der
 * Prognose (Ø der letzten bis zu 3 Monate mit Daten).
 *
 * Bewusst clientseitig gruppiert statt per SQL-Aggregat: dafuer braeuchte es
 * eine zusaetzliche Datenbank-Funktion. Die Abfrage ist auf die juengsten
 * Zeilen begrenzt (PF_SUGGESTION_SCAN_LIMIT) — bei realistischem Volumen
 * deckt das die noetigen drei Vormonate um ein Vielfaches ab.
 */
export async function fetchExpenseTotalsBefore(month: string) {
  const { data, error } = await supabase
    .from(TABLE.PF_TRANSACTIONS)
    .select('date,amount')
    .eq('type', 'expense')
    .lt('date', `${month}-01`)
    .order('date', { ascending: false })
    .limit(PF_SUGGESTION_SCAN_LIMIT)

  if (error) return { data: null, error }

  const byMonth = new Map<string, number>()
  for (const row of (data ?? []) as { date: string; amount: number }[]) {
    const m = row.date.slice(0, 7)
    byMonth.set(m, (byMonth.get(m) ?? 0) + Number(row.amount))
  }
  const totals = [...byMonth.entries()].map(([m, total]) => ({ month: m, total }))
  return { data: totals, error: null }
}
