export type Person   = 'A' | 'B'
export type Split    = 'both' | 'A' | 'B'
export type ViewMode = 'all' | 'store' | 'category'
export type ItemSort = 'custom' | 'created' | 'alpha'

export type AvatarRole = 'debtor' | 'creditor' | 'neutral'

export type SettingsView = 'list' | 'profile' | 'stores' | 'categories' | 'units'

export interface Profile {
  id: string
  name: string
  email: string | null
  avatar_url: string | null
  created_at: string
}

export interface Settings {
  id: number
  person_a: string
  person_b: string
  person_a_id: string | null
  person_b_id: string | null
  updated_at: string
}

export interface Store {
  id: string
  name: string
  position: number
  created_at: string
}

export interface Category {
  id: string
  name: string
  position: number
  created_at: string
}

export interface ShoppingItem {
  id: string
  name: string
  quantity: string | null
  unit: string | null
  is_done: boolean
  store_id: string | null
  category_id: string | null
  position: number
  created_at: string
}

export interface Expense {
  id: string
  amount: number
  description: string
  date: string
  paid_by: Person
  split: Split
  created_at: string
}

export interface Settlement {
  id: string
  amount: number
  from_person: Person
  to_person: Person
  date: string
  note: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Persoenlich-Bereich (pf_ = personal finance) — privat pro Person, RLS-isoliert.
// owner_id setzt die Datenbank per Default auth.uid(); das Frontend sendet ihn
// NIE mit. Deshalb ist er in den Insert-Typen unten ausgeschlossen.
// ---------------------------------------------------------------------------
export type Area = 'shared' | 'personal'

export type PfAccountType =
  | 'giro'
  | 'tagesgeld'
  | 'kreditkarte'
  | 'depot'
  | 'festgeld'
  | 'bar'
  | 'sonstiges'

export type PfCategoryType = 'income' | 'expense'

export interface PfAccount {
  id: string
  owner_id: string
  name: string
  type: PfAccountType
  is_hub: boolean
  is_shared_ref: boolean
  position: number
  created_at: string
}

export interface PfCategory {
  id: string
  owner_id: string
  name: string
  type: PfCategoryType
  color: string
  monthly_budget: number | null
  created_at: string
}

/** Felder, die das Frontend beim Anlegen schicken darf (ohne owner_id!). */
export type PfAccountInput = Omit<PfAccount, 'id' | 'owner_id' | 'created_at'>
export type PfCategoryInput = Omit<PfCategory, 'id' | 'owner_id' | 'created_at'>
