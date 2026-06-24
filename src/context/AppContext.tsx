import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { toastEmitter } from '../lib/toastEmitter'
import { useAuth } from './AuthContext'
import { REALTIME_CHANNEL, DEFAULT_UNITS } from '../constants'
import * as shoppingService from '../services/shoppingService'
import * as financeService from '../services/financeService'
import type {
  Category,
  Expense,
  Profile,
  Settings,
  Settlement,
  ShoppingItem,
  Store,
} from '../types'

const dbErr = (msg: string) => toastEmitter.emit(msg)

interface AppContextValue {
  loading:     boolean
  settings:    Settings | null
  myRole:      'A' | 'B' | null
  nameA:       string
  nameB:       string
  profileA:    Profile | null
  profileB:    Profile | null
  stores:      Store[]
  categories:  Category[]
  items:       ShoppingItem[]
  expenses:    Expense[]
  settlements: Settlement[]
  units:       string[]

  linkCurrentUser:  () => Promise<void>

  addUnit:    (name: string) => Promise<void>
  removeUnit: (name: string) => Promise<void>

  addStore:    (name: string) => Promise<Store | null>
  deleteStore: (id: string) => Promise<void>

  addCategory:    (name: string) => Promise<Category | null>
  deleteCategory: (id: string) => Promise<void>

  addItem:      (data: Partial<ShoppingItem> & { name: string }) => Promise<void>
  updateItem:   (id: string, patch: Partial<ShoppingItem>) => Promise<void>
  deleteItem:   (id: string) => Promise<void>
  reorderItems: (ordered: ShoppingItem[]) => Promise<void>

  addExpense:    (data: Omit<Expense, 'id' | 'created_at'>) => Promise<void>
  updateExpense: (id: string, data: Partial<Omit<Expense, 'id' | 'created_at'>>) => Promise<void>
  deleteExpense: (id: string) => Promise<void>

  addSettlement:    (data: Omit<Settlement, 'id' | 'created_at'>) => Promise<void>
  deleteSettlement: (id: string) => Promise<void>

  resetHousehold: () => Promise<void>
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

function upsert<T extends { id: string }>(arr: T[], row: T): T[] {
  const idx = arr.findIndex((x) => x.id === row.id)
  if (idx === -1) return [...arr, row]
  const copy = arr.slice()
  copy[idx] = row
  return copy
}

function removeById<T extends { id: string }>(arr: T[], id: string): T[] {
  return arr.filter((x) => x.id !== id)
}

const byPosition = (a: { position: number }, b: { position: number }) =>
  a.position - b.position

const byDateDesc = (
  a: { date: string; created_at: string },
  b: { date: string; created_at: string },
) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)

export function AppProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()

  const [loading, setLoading]         = useState(true)
  const [settings, setSettings]       = useState<Settings | null>(null)
  const [profileA, setProfileA]       = useState<Profile | null>(null)
  const [profileB, setProfileB]       = useState<Profile | null>(null)
  const [stores, setStores]           = useState<Store[]>([])
  const [categories, setCategories]   = useState<Category[]>([])
  const [items, setItems]             = useState<ShoppingItem[]>([])
  const [expenses, setExpenses]       = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [units, setUnits]             = useState<string[]>([...DEFAULT_UNITS])

  const myRole = useMemo<'A' | 'B' | null>(() => {
    if (!session || !settings) return null
    if (settings.person_a_id === session.user.id) return 'A'
    if (settings.person_b_id === session.user.id) return 'B'
    return null
  }, [session, settings])

  const nameA = useMemo(
    () => profileA?.name ?? settings?.person_a ?? 'Person A',
    [profileA, settings],
  )
  const nameB = useMemo(
    () => profileB?.name ?? settings?.person_b ?? 'Person B',
    [profileB, settings],
  )

  const loadProfilesForSettings = useCallback(async (s: Settings) => {
    const ids = [s.person_a_id, s.person_b_id].filter(Boolean) as string[]
    if (ids.length === 0) return
    const { data } = await shoppingService.fetchProfiles(ids)
    if (!data) return
    setProfileA(data.find((p: Profile) => p.id === s.person_a_id) ?? null)
    setProfileB(data.find((p: Profile) => p.id === s.person_b_id) ?? null)
  }, [])

  const loadUnitsFromDB = useCallback(async () => {
    const { data } = await shoppingService.fetchUnits()
    if (data && data.length > 0) setUnits(data.map((u: { name: string }) => u.name))
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [expensesRes, settlementsRes] = await Promise.all([
      financeService.fetchExpenses(),
      financeService.fetchSettlements(),
    ])
    const { settings: s, stores: st, categories: cat, items: it, units: un } =
      await shoppingService.fetchInitialData()

    if (s.data) {
      setSettings(s.data as Settings)
      await loadProfilesForSettings(s.data as Settings)
    }
    if (st.data)  setStores(st.data as Store[])
    if (cat.data) setCategories(cat.data as Category[])
    if (it.data)  setItems(it.data as ShoppingItem[])
    if (expensesRes.data)    setExpenses(expensesRes.data as Expense[])
    if (settlementsRes.data) setSettlements(settlementsRes.data as Settlement[])
    if (un.data && un.data.length > 0) setUnits(un.data.map((u: { name: string }) => u.name))
    setLoading(false)
  }, [loadProfilesForSettings])

  const channelReady = useRef(false)
  useEffect(() => {
    void loadAll()
    if (channelReady.current) return
    channelReady.current = true

    const channel = supabase.channel(REALTIME_CHANNEL)

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (p) => {
        if (p.eventType === 'DELETE') return
        const s = p.new as Settings
        setSettings(s)
        void loadProfilesForSettings(s)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (p) => {
        if (p.eventType === 'DELETE') return
        const prof = p.new as Profile
        setProfileA((prev) => (prev?.id === prof.id ? prof : prev))
        setProfileB((prev) => (prev?.id === prof.id ? prof : prev))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, (p) => {
        if (p.eventType === 'DELETE') setStores((a) => removeById(a, (p.old as Store).id))
        else setStores((a) => upsert(a, p.new as Store).sort(byPosition))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (p) => {
        if (p.eventType === 'DELETE') setCategories((a) => removeById(a, (p.old as Category).id))
        else setCategories((a) => upsert(a, p.new as Category).sort(byPosition))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, (p) => {
        if (p.eventType === 'DELETE') setItems((a) => removeById(a, (p.old as ShoppingItem).id))
        else setItems((a) => upsert(a, p.new as ShoppingItem).sort(byPosition))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (p) => {
        if (p.eventType === 'DELETE') setExpenses((a) => removeById(a, (p.old as Expense).id))
        else setExpenses((a) => upsert(a, p.new as Expense).sort(byDateDesc))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, (p) => {
        if (p.eventType === 'DELETE') setSettlements((a) => removeById(a, (p.old as Settlement).id))
        else setSettlements((a) => upsert(a, p.new as Settlement).sort(byDateDesc))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, () => {
        void loadUnitsFromDB()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      channelReady.current = false
    }
  }, [loadAll, loadUnitsFromDB, loadProfilesForSettings])

  const linkCurrentUser = async () => {
    if (!session) return
    const uid = session.user.id

    if (!settings) {
      const { data } = await shoppingService.createSettingsRow(uid)
      if (data) {
        setSettings(data as Settings)
        await loadProfilesForSettings(data as Settings)
      }
    } else if (!settings.person_a_id) {
      const { data } = await shoppingService.linkUserToSettings(uid, 'a')
      if (data) {
        setSettings(data as Settings)
        await loadProfilesForSettings(data as Settings)
      }
    } else if (!settings.person_b_id) {
      const { data } = await shoppingService.linkUserToSettings(uid, 'b')
      if (data) {
        setSettings(data as Settings)
        await loadProfilesForSettings(data as Settings)
      }
    }
  }

  // ----- Einheiten -----
  const addUnit = async (name: string) => {
    const t = name.trim()
    if (!t || units.includes(t)) return
    setUnits((prev) => [...prev, t])
    const { error } = await shoppingService.addUnit(t, units.length)
    if (error) {
      setUnits((prev) => prev.filter((u) => u !== t))
      dbErr('Einheit konnte nicht gespeichert werden.')
    }
  }

  const removeUnit = async (name: string) => {
    setUnits((prev) => prev.filter((u) => u !== name))
    const { error } = await shoppingService.deleteUnit(name)
    if (error) {
      setUnits((prev) => [...prev, name])
      dbErr('Einheit konnte nicht gelöscht werden.')
    }
  }

  // ----- Läden -----
  const addStore = async (name: string): Promise<Store | null> => {
    const position = (stores.at(-1)?.position ?? 0) + 1
    const { data, error } = await shoppingService.addStore(name, position)
    if (error) { dbErr('Laden konnte nicht gespeichert werden.'); return null }
    if (data) {
      setStores((a) => upsert(a, data as Store).sort(byPosition))
      return data as Store
    }
    return null
  }

  const deleteStore = async (id: string) => {
    const prev = stores.find((s) => s.id === id)
    setStores((a) => removeById(a, id))
    const { error } = await shoppingService.deleteStore(id)
    if (error) {
      if (prev) setStores((a) => upsert(a, prev).sort(byPosition))
      dbErr('Laden konnte nicht gelöscht werden.')
    }
  }

  // ----- Kategorien -----
  const addCategory = async (name: string): Promise<Category | null> => {
    const position = (categories.at(-1)?.position ?? 0) + 1
    const { data, error } = await shoppingService.addCategory(name, position)
    if (error) { dbErr('Kategorie konnte nicht gespeichert werden.'); return null }
    if (data) {
      setCategories((a) => upsert(a, data as Category).sort(byPosition))
      return data as Category
    }
    return null
  }

  const deleteCategory = async (id: string) => {
    const prev = categories.find((c) => c.id === id)
    setCategories((a) => removeById(a, id))
    const { error } = await shoppingService.deleteCategory(id)
    if (error) {
      if (prev) setCategories((a) => upsert(a, prev).sort(byPosition))
      dbErr('Kategorie konnte nicht gelöscht werden.')
    }
  }

  // ----- Einkaufsartikel -----
  const addItem = async (data: Partial<ShoppingItem> & { name: string }) => {
    const position = (items.at(-1)?.position ?? 0) + 1
    const payload = {
      name:        data.name,
      quantity:    data.quantity ?? null,
      unit:        data.unit ?? null,
      store_id:    data.store_id ?? null,
      category_id: data.category_id ?? null,
      is_done:     false,
      position,
    }
    const { data: row, error } = await shoppingService.addShoppingItem(payload)
    if (error) { dbErr('Artikel konnte nicht hinzugefügt werden.'); return }
    if (row) setItems((a) => upsert(a, row as ShoppingItem).sort(byPosition))
  }

  const updateItem = async (id: string, patch: Partial<ShoppingItem>) => {
    setItems((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort(byPosition))
    const { error } = await shoppingService.updateShoppingItem(id, patch)
    if (error) dbErr('Änderung konnte nicht gespeichert werden.')
  }

  const deleteItem = async (id: string) => {
    setItems((a) => removeById(a, id))
    const { error } = await shoppingService.deleteShoppingItem(id)
    if (error) dbErr('Artikel konnte nicht gelöscht werden.')
  }

  const reorderItems = async (ordered: ShoppingItem[]) => {
    const withPos = ordered.map((it, i) => ({ ...it, position: i }))
    setItems((a) => {
      const map = new Map(withPos.map((x) => [x.id, x]))
      return a.map((x) => map.get(x.id) ?? x).sort(byPosition)
    })
    const results = await shoppingService.reorderShoppingItems(
      withPos.map((it) => ({ id: it.id, position: it.position }))
    )
    if (results.some((r) => r.error)) dbErr('Reihenfolge konnte nicht gespeichert werden.')
  }

  // ----- Ausgaben -----
  const addExpense = async (data: Omit<Expense, 'id' | 'created_at'>) => {
    const { data: row, error } = await financeService.addExpense(data)
    if (error) { dbErr('Ausgabe konnte nicht gespeichert werden.'); return }
    if (row) setExpenses((a) => upsert(a, row as Expense).sort(byDateDesc))
  }

  const updateExpense = async (id: string, data: Partial<Omit<Expense, 'id' | 'created_at'>>) => {
    setExpenses((a) => a.map((x) => (x.id === id ? { ...x, ...data } : x)).sort(byDateDesc))
    const { error } = await financeService.updateExpense(id, data)
    if (error) dbErr('Ausgabe konnte nicht gespeichert werden.')
  }

  const deleteExpense = async (id: string) => {
    setExpenses((a) => removeById(a, id))
    const { error } = await financeService.deleteExpense(id)
    if (error) dbErr('Ausgabe konnte nicht gelöscht werden.')
  }

  // ----- Ausgleich -----
  const addSettlement = async (data: Omit<Settlement, 'id' | 'created_at'>) => {
    const { data: row, error } = await financeService.addSettlement(data)
    if (error) { dbErr('Zahlung konnte nicht gespeichert werden.'); return }
    if (row) setSettlements((a) => upsert(a, row as Settlement).sort(byDateDesc))
  }

  const deleteSettlement = async (id: string) => {
    setSettlements((a) => removeById(a, id))
    const { error } = await financeService.deleteSettlement(id)
    if (error) dbErr('Zahlung konnte nicht gelöscht werden.')
  }

  // ----- Reset -----
  const resetHousehold = async () => {
    await shoppingService.deleteAllHouseholdData()
    setItems([])
    setExpenses([])
    setSettlements([])
    setStores([])
    setCategories([])
    setUnits([...DEFAULT_UNITS])
  }

  const value: AppContextValue = {
    loading,
    settings,
    myRole,
    nameA,
    nameB,
    profileA,
    profileB,
    stores,
    categories,
    items,
    expenses,
    settlements,
    units,
    linkCurrentUser,
    addUnit,
    removeUnit,
    addStore,
    deleteStore,
    addCategory,
    deleteCategory,
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
    addExpense,
    updateExpense,
    deleteExpense,
    addSettlement,
    deleteSettlement,
    resetHousehold,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp muss innerhalb von AppProvider verwendet werden')
  return ctx
}
