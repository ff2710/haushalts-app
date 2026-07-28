import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { toastEmitter } from '../lib/toastEmitter'
import { useAuth } from './AuthContext'
import { REALTIME_CHANNEL_PERSONAL, TABLE } from '../constants'
import * as personalService from '../services/personalService'
import type { PfAccount, PfAccountInput, PfCategory, PfCategoryInput } from '../types'

// State des Persoenlich-Bereichs. Bewusst getrennt von AppContext: die private
// Welt hat einen eigenen Realtime-Channel und eigene Ladelogik, und AppContext
// ist bereits gross genug.
//
// Es wird hier nirgends nach owner_id gefiltert — das erledigt RLS in Postgres.

const dbErr = (msg: string) => toastEmitter.emit(msg)

interface PersonalContextValue {
  loading:    boolean
  accounts:   PfAccount[]
  categories: PfCategory[]

  addAccount:    (data: PfAccountInput) => Promise<PfAccount | null>
  updateAccount: (id: string, data: Partial<PfAccountInput>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>

  addCategory:    (data: PfCategoryInput) => Promise<PfCategory | null>
  updateCategory: (id: string, data: Partial<PfCategoryInput>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
}

const PersonalContext = createContext<PersonalContextValue | undefined>(undefined)

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

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'de')

export function PersonalProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()

  const [loading, setLoading]       = useState(true)
  const [accounts, setAccounts]     = useState<PfAccount[]>([])
  const [categories, setCategories] = useState<PfCategory[]>([])

  const seeded = useRef(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [accRes, catRes] = await Promise.all([
      personalService.fetchAccounts(),
      personalService.fetchCategories(),
    ])

    if (accRes.error) dbErr('Konten konnten nicht geladen werden.')
    else setAccounts((accRes.data ?? []) as PfAccount[])

    if (catRes.error) {
      dbErr('Kategorien konnten nicht geladen werden.')
    } else {
      let cats = (catRes.data ?? []) as PfCategory[]

      // Erster Besuch dieser Person: Standard-Kategorien anlegen. Der
      // Unique-Index (owner_id, name, type) verhindert Doppelanlage; ein
      // Konflikt bedeutet also "schon vorhanden" und wird still hingenommen.
      if (cats.length === 0 && !seeded.current) {
        seeded.current = true
        const { data, error } = await personalService.seedDefaultCategories()
        if (data) {
          cats = data as PfCategory[]
        } else if (error) {
          // 23505 = Unique-Verletzung: ein zweiter Tab war schneller. Das ist
          // kein Fehler fuer den Nutzer — Realtime liefert die Zeilen gleich
          // nach. Alles andere ist echt und gehoert gemeldet.
          if (error.code !== '23505') {
            dbErr('Standard-Kategorien konnten nicht angelegt werden.')
            seeded.current = false // beim naechsten Laden erneut versuchen
          }
        }
      }
      setCategories(cats.sort(byName))
    }

    setLoading(false)
  }, [])

  const channelReady = useRef(false)
  useEffect(() => {
    if (!session) return
    void loadAll()
    if (channelReady.current) return
    channelReady.current = true

    // Realtime liefert dank RLS ohnehin nur eigene Zeilen.
    const channel = supabase.channel(REALTIME_CHANNEL_PERSONAL)

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_ACCOUNTS }, (p) => {
        if (p.eventType === 'DELETE') setAccounts((a) => removeById(a, (p.old as PfAccount).id))
        else setAccounts((a) => upsert(a, p.new as PfAccount).sort(byPosition))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_CATEGORIES }, (p) => {
        if (p.eventType === 'DELETE') setCategories((a) => removeById(a, (p.old as PfCategory).id))
        else setCategories((a) => upsert(a, p.new as PfCategory).sort(byName))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      channelReady.current = false
    }
  }, [session, loadAll])

  const addAccount = useCallback(async (data: PfAccountInput) => {
    const { data: row, error } = await personalService.addAccount(data)
    if (error) {
      dbErr('Konto konnte nicht angelegt werden.')
      return null
    }
    setAccounts((a) => upsert(a, row as PfAccount).sort(byPosition))
    return row as PfAccount
  }, [])

  const updateAccount = useCallback(async (id: string, data: Partial<PfAccountInput>) => {
    const { error } = await personalService.updateAccount(id, data)
    if (error) dbErr('Konto konnte nicht geändert werden.')
  }, [])

  const deleteAccount = useCallback(async (id: string) => {
    const { error } = await personalService.deleteAccount(id)
    if (error) dbErr('Konto konnte nicht gelöscht werden.')
    else setAccounts((a) => removeById(a, id))
  }, [])

  const addCategory = useCallback(async (data: PfCategoryInput) => {
    const { data: row, error } = await personalService.addCategory(data)
    if (error) {
      dbErr('Kategorie konnte nicht angelegt werden.')
      return null
    }
    setCategories((a) => upsert(a, row as PfCategory).sort(byName))
    return row as PfCategory
  }, [])

  const updateCategory = useCallback(async (id: string, data: Partial<PfCategoryInput>) => {
    const { error } = await personalService.updateCategory(id, data)
    if (error) dbErr('Kategorie konnte nicht geändert werden.')
  }, [])

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await personalService.deleteCategory(id)
    if (error) dbErr('Kategorie konnte nicht gelöscht werden.')
    else setCategories((a) => removeById(a, id))
  }, [])

  const value: PersonalContextValue = {
    loading,
    accounts,
    categories,
    addAccount,
    updateAccount,
    deleteAccount,
    addCategory,
    updateCategory,
    deleteCategory,
  }

  return <PersonalContext.Provider value={value}>{children}</PersonalContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePersonal() {
  const ctx = useContext(PersonalContext)
  if (!ctx) throw new Error('usePersonal muss innerhalb von PersonalProvider verwendet werden')
  return ctx
}
