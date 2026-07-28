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
import type {
  ImportRow,
  PfAccount,
  PfAccountInput,
  PfCategory,
  PfCategoryInput,
  PfImportBatch,
  PfTransaction,
  PfTransactionInput,
} from '../types'

// State des Persoenlich-Bereichs. Bewusst getrennt von AppContext: die private
// Welt hat einen eigenen Realtime-Channel und eigene Ladelogik, und AppContext
// ist bereits gross genug.
//
// Es wird hier nirgends nach owner_id gefiltert — das erledigt RLS in Postgres.

const dbErr = (msg: string) => toastEmitter.emit(msg)

interface PersonalContextValue {
  loading:      boolean
  accounts:     PfAccount[]
  categories:   PfCategory[]
  transactions: PfTransaction[]
  batches:      PfImportBatch[]

  addAccount:    (data: PfAccountInput) => Promise<PfAccount | null>
  updateAccount: (id: string, data: Partial<PfAccountInput>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>

  addCategory:    (data: PfCategoryInput) => Promise<PfCategory | null>
  updateCategory: (id: string, data: Partial<PfCategoryInput>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  addTransaction:    (data: PfTransactionInput) => Promise<PfTransaction | null>
  updateTransaction: (id: string, data: Partial<PfTransactionInput>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>

  /** Legt die vom Menschen freigegebenen Zeilen als ein Batch an. */
  importRows: (
    rows: ImportRow[],
    filename: string,
    accountId: string | null,
  ) => Promise<PfImportBatch | null>
  /** Macht einen Import komplett rueckgaengig (Cascade). */
  undoImport: (batchId: string) => Promise<void>
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

// Neueste zuerst; bei gleichem Datum entscheidet die Anlagezeit.
const byDateDesc = (
  a: { date: string; created_at: string },
  b: { date: string; created_at: string },
) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)

export function PersonalProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()

  const [loading, setLoading]           = useState(true)
  const [accounts, setAccounts]         = useState<PfAccount[]>([])
  const [categories, setCategories]     = useState<PfCategory[]>([])
  const [transactions, setTransactions] = useState<PfTransaction[]>([])
  const [batches, setBatches]           = useState<PfImportBatch[]>([])

  const seeded = useRef(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [accRes, catRes, txRes, batchRes] = await Promise.all([
      personalService.fetchAccounts(),
      personalService.fetchCategories(),
      personalService.fetchTransactions(),
      personalService.fetchImportBatches(),
    ])

    if (accRes.error) dbErr('Konten konnten nicht geladen werden.')
    else setAccounts((accRes.data ?? []) as PfAccount[])

    if (txRes.error) dbErr('Umsätze konnten nicht geladen werden.')
    else setTransactions((txRes.data ?? []) as PfTransaction[])

    if (!batchRes.error) setBatches((batchRes.data ?? []) as PfImportBatch[])

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
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_TRANSACTIONS }, (p) => {
        if (p.eventType === 'DELETE')
          setTransactions((a) => removeById(a, (p.old as PfTransaction).id))
        else setTransactions((a) => upsert(a, p.new as PfTransaction).sort(byDateDesc))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_IMPORT_BATCHES }, (p) => {
        if (p.eventType === 'DELETE')
          setBatches((a) => removeById(a, (p.old as PfImportBatch).id))
        else
          setBatches((a) =>
            upsert(a, p.new as PfImportBatch).sort((x, y) =>
              y.imported_at.localeCompare(x.imported_at),
            ),
          )
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

  const addTransaction = useCallback(async (data: PfTransactionInput) => {
    const { data: row, error } = await personalService.addTransaction(data)
    if (error) {
      dbErr('Umsatz konnte nicht gespeichert werden.')
      return null
    }
    setTransactions((a) => upsert(a, row as PfTransaction).sort(byDateDesc))
    return row as PfTransaction
  }, [])

  const updateTransaction = useCallback(
    async (id: string, data: Partial<PfTransactionInput>) => {
      const { error } = await personalService.updateTransaction(id, data)
      if (error) dbErr('Umsatz konnte nicht geändert werden.')
    },
    [],
  )

  const deleteTransaction = useCallback(async (id: string) => {
    const { error } = await personalService.deleteTransaction(id)
    if (error) dbErr('Umsatz konnte nicht gelöscht werden.')
    else setTransactions((a) => removeById(a, id))
  }, [])

  /**
   * Import: legt zuerst den Batch an, dann die Zeilen. Schlaegt das Anlegen der
   * Zeilen fehl, wird der leere Batch wieder entfernt — es bleibt nichts
   * Halbfertiges stehen.
   * Es werden ausschliesslich Zeilen mit include === true geschrieben; ueber
   * Dubletten hat der Mensch im Review-Screen entschieden.
   */
  const importRows = useCallback(
    async (rows: ImportRow[], filename: string, accountId: string | null) => {
      const selected = rows.filter((r) => r.include)
      if (selected.length === 0) return null

      const { data: batch, error: batchErr } = await personalService.createImportBatch(
        filename,
        selected.length,
      )
      if (batchErr || !batch) {
        dbErr('Import konnte nicht gestartet werden.')
        return null
      }

      const payload: PfTransactionInput[] = selected.map((r) => ({
        date: r.date,
        type: r.type,
        amount: r.amount,
        description: r.description,
        account_id: accountId,
        category_id: null,
        import_batch_id: (batch as PfImportBatch).id,
        source: 'csv',
        source_ref: null,
      }))

      const { data: inserted, error: rowsErr } = await personalService.addTransactionsForBatch(
        payload,
        (batch as PfImportBatch).id,
      )
      if (rowsErr) {
        await personalService.deleteImportBatch((batch as PfImportBatch).id)
        dbErr('Import fehlgeschlagen — es wurde nichts gespeichert.')
        return null
      }

      if (inserted) {
        setTransactions((a) => {
          let next = a
          for (const row of inserted as PfTransaction[]) next = upsert(next, row)
          return next.sort(byDateDesc)
        })
      }
      setBatches((a) => upsert(a, batch as PfImportBatch))
      return batch as PfImportBatch
    },
    [],
  )

  const undoImport = useCallback(async (batchId: string) => {
    const { error } = await personalService.deleteImportBatch(batchId)
    if (error) {
      dbErr('Import konnte nicht rückgängig gemacht werden.')
      return
    }
    // Cascade in der DB entfernt die Zeilen; lokal nachziehen.
    setTransactions((a) => a.filter((t) => t.import_batch_id !== batchId))
    setBatches((a) => removeById(a, batchId))
  }, [])

  const value: PersonalContextValue = {
    loading,
    accounts,
    categories,
    transactions,
    batches,
    addAccount,
    updateAccount,
    deleteAccount,
    addCategory,
    updateCategory,
    deleteCategory,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importRows,
    undoImport,
  }

  return <PersonalContext.Provider value={value}>{children}</PersonalContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePersonal() {
  const ctx = useContext(PersonalContext)
  if (!ctx) throw new Error('usePersonal muss innerhalb von PersonalProvider verwendet werden')
  return ctx
}
