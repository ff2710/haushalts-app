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
