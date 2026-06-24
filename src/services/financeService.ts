import { supabase } from '../lib/supabase'
import { TABLE } from '../constants'
import type { Expense, Settlement } from '../types'

export async function fetchExpenses() {
  return supabase.from(TABLE.EXPENSES).select('*').order('date', { ascending: false })
}

export async function fetchSettlements() {
  return supabase.from(TABLE.SETTLEMENTS).select('*').order('date', { ascending: false })
}

export async function addExpense(data: Omit<Expense, 'id' | 'created_at'>) {
  return supabase.from(TABLE.EXPENSES).insert(data).select().single()
}

export async function updateExpense(
  id: string,
  data: Partial<Omit<Expense, 'id' | 'created_at'>>
) {
  return supabase.from(TABLE.EXPENSES).update(data).eq('id', id)
}

export async function deleteExpense(id: string) {
  return supabase.from(TABLE.EXPENSES).delete().eq('id', id)
}

export async function addSettlement(data: Omit<Settlement, 'id' | 'created_at'>) {
  return supabase.from(TABLE.SETTLEMENTS).insert(data).select().single()
}

export async function deleteSettlement(id: string) {
  return supabase.from(TABLE.SETTLEMENTS).delete().eq('id', id)
}
