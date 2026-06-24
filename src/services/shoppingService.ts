import { supabase } from '../lib/supabase'
import { TABLE, SETTINGS_ID } from '../constants'
import type { Category, Settings, ShoppingItem, Store } from '../types'

export async function fetchInitialData() {
  const [settings, stores, categories, items, units] = await Promise.all([
    supabase.from(TABLE.SETTINGS).select('*').eq('id', SETTINGS_ID).maybeSingle(),
    supabase.from(TABLE.STORES).select('*').order('position'),
    supabase.from(TABLE.CATEGORIES).select('*').order('position'),
    supabase.from(TABLE.SHOPPING_ITEMS).select('*').order('position'),
    supabase.from(TABLE.UNITS).select('name').order('position'),
  ])
  return { settings, stores, categories, items, units }
}

export async function addShoppingItem(
  payload: Omit<ShoppingItem, 'id' | 'created_at'>
) {
  return supabase.from(TABLE.SHOPPING_ITEMS).insert(payload).select().single()
}

export async function updateShoppingItem(id: string, patch: Partial<ShoppingItem>) {
  return supabase.from(TABLE.SHOPPING_ITEMS).update(patch).eq('id', id)
}

export async function deleteShoppingItem(id: string) {
  return supabase.from(TABLE.SHOPPING_ITEMS).delete().eq('id', id)
}

export async function reorderShoppingItems(items: { id: string; position: number }[]) {
  return Promise.all(
    items.map((it) =>
      supabase.from(TABLE.SHOPPING_ITEMS).update({ position: it.position }).eq('id', it.id)
    )
  )
}

export async function addStore(name: string, position: number) {
  return supabase.from(TABLE.STORES).insert({ name, position }).select().single()
}

export async function deleteStore(id: string) {
  return supabase.from(TABLE.STORES).delete().eq('id', id)
}

export async function addCategory(name: string, position: number) {
  return supabase.from(TABLE.CATEGORIES).insert({ name, position }).select().single()
}

export async function deleteCategory(id: string) {
  return supabase.from(TABLE.CATEGORIES).delete().eq('id', id)
}

export async function fetchUnits() {
  return supabase.from(TABLE.UNITS).select('name').order('position')
}

export async function addUnit(name: string, position: number) {
  return supabase.from(TABLE.UNITS).insert({ name, position })
}

export async function deleteUnit(name: string) {
  return supabase.from(TABLE.UNITS).delete().eq('name', name)
}

export async function fetchProfiles(ids: string[]) {
  return supabase.from(TABLE.PROFILES).select('*').in('id', ids)
}

export async function linkUserToSettings(uid: string, slot: 'a' | 'b') {
  const field = slot === 'a' ? 'person_a_id' : 'person_b_id'
  return supabase
    .from(TABLE.SETTINGS)
    .update({ [field]: uid })
    .eq('id', SETTINGS_ID)
    .select()
    .single()
}

export async function createSettingsRow(uid: string) {
  return supabase
    .from(TABLE.SETTINGS)
    .insert({ id: SETTINGS_ID, person_a: '', person_b: '', person_a_id: uid })
    .select()
    .single()
}

export async function fetchSettings() {
  return supabase.from(TABLE.SETTINGS).select('*').eq('id', SETTINGS_ID).maybeSingle()
}

export async function deleteAllHouseholdData() {
  return Promise.all([
    supabase.from(TABLE.SHOPPING_ITEMS).delete().not('id', 'is', null),
    supabase.from(TABLE.EXPENSES).delete().not('id', 'is', null),
    supabase.from(TABLE.SETTLEMENTS).delete().not('id', 'is', null),
    supabase.from(TABLE.STORES).delete().not('id', 'is', null),
    supabase.from(TABLE.CATEGORIES).delete().not('id', 'is', null),
    supabase.from(TABLE.UNITS).delete().not('name', 'is', null),
  ])
}

export type { Settings, Store, Category, ShoppingItem }
