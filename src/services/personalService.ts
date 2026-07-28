import { supabase } from '../lib/supabase'
import { TABLE, PF_DEFAULT_CATEGORIES } from '../constants'
import type { PfAccountInput, PfCategoryInput } from '../types'

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
