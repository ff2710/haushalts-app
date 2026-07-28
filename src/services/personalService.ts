import { supabase } from '../lib/supabase'
import { TABLE, PF_DEFAULT_CATEGORIES, PF_TX_PAGE_SIZE } from '../constants'
import { makeDedupKey } from '../lib/dedup'
import type { PfAccountInput, PfCategoryInput, PfTransactionInput } from '../types'

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
