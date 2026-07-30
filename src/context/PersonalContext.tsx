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
import { todayISO } from '../lib/utils'
import * as personalService from '../services/personalService'
import type {
  ImportRow,
  PfAccount,
  PfAccountInput,
  PfAllocationStep,
  PfAllocationStepInput,
  PfDebt,
  PfDebtInput,
  PfPot,
  PfPotInput,
  PfCashLocation,
  PfCashLocationInput,
  PfCategory,
  PfCategoryInput,
  PfFixedCost,
  PfFixedCostInput,
  PfImportBatch,
  PfRecurringIncome,
  PfRecurringIncomeInput,
  PfTransaction,
  PfTransactionInput,
  PfVariableEstimate,
  PfVariableEstimateInput,
} from '../types'

// State des Persoenlich-Bereichs. Bewusst getrennt von AppContext: die private
// Welt hat einen eigenen Realtime-Channel und eigene Ladelogik, und AppContext
// ist bereits gross genug.
//
// Es wird hier nirgends nach owner_id gefiltert — das erledigt RLS in Postgres.

const dbErr = (msg: string) => toastEmitter.emit(msg)

/**
 * Die Kategorie-Regeln stehen in der Datenbank (Unique-Index + Trigger, siehe
 * supabase/schema-personal.sql). Deren Meldungen sind fuer Entwickler
 * geschrieben — hier werden die Codes in Saetze uebersetzt, die auch etwas
 * sagen, wenn man das Schema nicht kennt.
 */
const categoryErr = (code: string | undefined, fallback: string) => {
  if (code === '23505')
    dbErr('Diesen Namen gibt es an derselben Stelle schon.')
  else if (code === '23514')
    // Deckt alle Regeln des Triggers ab: dritte Ebene, Typ-Mischung, und den
    // Typwechsel an einer Kategorie, an der noch Unterkategorien haengen.
    dbErr('Das erlaubt die Kategorie-Struktur nicht — höchstens zwei Ebenen, gleiche Art wie die Hauptkategorie, und die Art bleibt fest, solange Unterkategorien daran hängen.')
  else if (code === '23503')
    dbErr('Die gewählte Hauptkategorie gibt es nicht mehr.')
  else dbErr(fallback)
}

/** Laufender Monat als 'YYYY-MM' in lokaler Zeit. */
const currentMonth = (): string => todayISO().slice(0, 7)

interface PersonalContextValue {
  loading:      boolean
  accounts:     PfAccount[]
  /** Optionale Orte eines Bargeld-Kontos; leer = ein einzelner Bestand. */
  cashLocations: PfCashLocation[]
  categories:   PfCategory[]
  transactions: PfTransaction[]
  /** ALLE Umsaetze des laufenden Monats — Grundlage aller Monatssummen.
   *  Bewusst getrennt von `transactions`, das gedeckelt ist. */
  monthTransactions: PfTransaction[]
  batches:      PfImportBatch[]
  fixedCosts:   PfFixedCost[]
  incomes:      PfRecurringIncome[]
  estimates:    PfVariableEstimate[]
  pots:         PfPot[]
  debts:        PfDebt[]
  allocationSteps: PfAllocationStep[]

  addAccount:    (data: PfAccountInput) => Promise<PfAccount | null>
  updateAccount: (id: string, data: Partial<PfAccountInput>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>

  addCashLocation:    (data: PfCashLocationInput) => Promise<void>
  updateCashLocation: (id: string, data: Partial<PfCashLocationInput>) => Promise<void>
  deleteCashLocation: (id: string) => Promise<void>

  addCategory:    (data: PfCategoryInput) => Promise<PfCategory | null>
  /** true = gespeichert. Bei false steht der Grund schon als Hinweis auf dem
   *  Schirm; der Editor bleibt dann offen, damit nichts verloren geht. */
  updateCategory: (id: string, data: Partial<PfCategoryInput>) => Promise<boolean>
  deleteCategory: (id: string) => Promise<boolean>

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

  addFixedCost:    (data: PfFixedCostInput) => Promise<void>
  updateFixedCost: (id: string, data: Partial<PfFixedCostInput>) => Promise<void>
  deleteFixedCost: (id: string) => Promise<void>

  addIncome:    (data: PfRecurringIncomeInput) => Promise<void>
  updateIncome: (id: string, data: Partial<PfRecurringIncomeInput>) => Promise<void>
  deleteIncome: (id: string) => Promise<void>

  addEstimate:    (data: PfVariableEstimateInput) => Promise<void>
  updateEstimate: (id: string, data: Partial<PfVariableEstimateInput>) => Promise<void>
  deleteEstimate: (id: string) => Promise<void>

  addPot:    (data: PfPotInput) => Promise<void>
  updatePot: (id: string, data: Partial<PfPotInput>) => Promise<void>
  deletePot: (id: string) => Promise<void>

  addDebt:    (data: PfDebtInput) => Promise<void>
  updateDebt: (id: string, data: Partial<PfDebtInput>) => Promise<void>
  deleteDebt: (id: string) => Promise<void>

  addStep:    (data: PfAllocationStepInput) => Promise<void>
  updateStep: (id: string, data: Partial<PfAllocationStepInput>) => Promise<void>
  deleteStep: (id: string) => Promise<void>
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

/** Toepfe und Schulden werden in ihrer Prioritaet abgearbeitet — dieselbe
 *  Sortierung wie in lib/cascade.ts, damit Anzeige und Rechnung uebereinstimmen. */
const byPriority = (a: { priority: number; id: string }, b: { priority: number; id: string }) =>
  a.priority - b.priority || a.id.localeCompare(b.id)

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
  const [cashLocations, setCashLocations] = useState<PfCashLocation[]>([])
  const [categories, setCategories]     = useState<PfCategory[]>([])
  const [transactions, setTransactions] = useState<PfTransaction[]>([])
  const [monthTransactions, setMonthTransactions] = useState<PfTransaction[]>([])
  const [batches, setBatches]           = useState<PfImportBatch[]>([])
  const [fixedCosts, setFixedCosts]     = useState<PfFixedCost[]>([])
  const [incomes, setIncomes]           = useState<PfRecurringIncome[]>([])
  const [estimates, setEstimates]       = useState<PfVariableEstimate[]>([])
  const [pots, setPots]                 = useState<PfPot[]>([])
  const [debts, setDebts]               = useState<PfDebt[]>([])
  const [allocationSteps, setSteps]     = useState<PfAllocationStep[]>([])

  const seeded = useRef(false)
  const cashSeeded = useRef(false)
  const stepsSeeded = useRef(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [
      accRes, cashRes, catRes, txRes, monthRes, batchRes, fixRes, incRes, estRes,
      potRes, debtRes, stepRes,
    ] = await Promise.all([
      personalService.fetchAccounts(),
      personalService.fetchCashLocations(),
      personalService.fetchCategories(),
      personalService.fetchTransactions(),
      personalService.fetchTransactionsForMonth(currentMonth()),
      personalService.fetchImportBatches(),
      personalService.fetchFixedCosts(),
      personalService.fetchRecurringIncome(),
      personalService.fetchVariableEstimates(),
      personalService.fetchPots(),
      personalService.fetchDebts(),
      personalService.fetchAllocationSteps(),
    ])

    if (accRes.error) {
      dbErr('Konten konnten nicht geladen werden.')
    } else {
      const accs = (accRes.data ?? []) as PfAccount[]
      setAccounts(accs)

      // Ein Bargeld-Konto gehoert immer dazu: Bargeld hat man, ob man es
      // anlegt oder nicht, und wer es erst anlegen muss, traegt seinen Bestand
      // nie ein. Nur wenn keines existiert — wer eigene angelegt hat, behaelt
      // sie unangetastet.
      if (!accs.some((a) => a.type === 'bar') && !cashSeeded.current) {
        cashSeeded.current = true
        const { data: row, error } = await personalService.addAccount({
          name: 'Bargeld',
          type: 'bar',
          is_hub: false,
          is_shared_ref: false,
          stated_balance: 0,
          position: accs.length,
        })
        if (row) {
          setAccounts((a) => upsert(a, row as PfAccount).sort(byPosition))
        } else if (error) {
          // 23505 = der Teil-Unique-Index hat zugeschlagen: ein zweites Geraet
          // war schneller. Kein Fehler fuer den Nutzer, Realtime liefert die
          // Zeile gleich nach. Alles andere gehoert gemeldet, sonst merkt
          // niemand, dass sein Bargeld-Konto fehlt.
          if (error.code !== '23505') {
            dbErr('Bargeld-Konto konnte nicht angelegt werden.')
            cashSeeded.current = false
          }
        }
      }
    }

    if (!cashRes.error) setCashLocations((cashRes.data ?? []) as PfCashLocation[])

    if (txRes.error) dbErr('Umsätze konnten nicht geladen werden.')
    else setTransactions((txRes.data ?? []) as PfTransaction[])

    if (!monthRes.error) setMonthTransactions((monthRes.data ?? []) as PfTransaction[])

    if (!batchRes.error) setBatches((batchRes.data ?? []) as PfImportBatch[])

    if (fixRes.error) dbErr('Fixkosten konnten nicht geladen werden.')
    else setFixedCosts((fixRes.data ?? []) as PfFixedCost[])

    if (incRes.error) dbErr('Einnahmen konnten nicht geladen werden.')
    else setIncomes((incRes.data ?? []) as PfRecurringIncome[])

    if (estRes.error) dbErr('Schätzposten konnten nicht geladen werden.')
    else setEstimates((estRes.data ?? []) as PfVariableEstimate[])

    if (!potRes.error) setPots((potRes.data ?? []) as PfPot[])
    if (!debtRes.error) setDebts((debtRes.data ?? []) as PfDebt[])

    if (stepRes.error) {
      dbErr('Kaskade konnte nicht geladen werden.')
    } else {
      let steps = (stepRes.data ?? []) as PfAllocationStep[]
      // Ohne Stufen waere die Kaskade eine leere Seite, auf der man nicht
      // erkennt, was sie ueberhaupt tun soll. Deshalb einmal die Reihenfolge
      // aus dem Bauplan als Startaufstellung — anpassbar, nicht in Stein.
      if (steps.length === 0 && !stepsSeeded.current) {
        stepsSeeded.current = true
        const { data, error } = await personalService.seedAllocationSteps()
        if (data) steps = data as PfAllocationStep[]
        else if (error) stepsSeeded.current = false
      }
      setSteps(steps.sort(byPosition))
    }

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
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_CASH_LOCATIONS }, (p) => {
        if (p.eventType === 'DELETE')
          setCashLocations((a) => removeById(a, (p.old as PfCashLocation).id))
        else setCashLocations((a) => upsert(a, p.new as PfCashLocation).sort(byPosition))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_CATEGORIES }, (p) => {
        if (p.eventType === 'DELETE') setCategories((a) => removeById(a, (p.old as PfCategory).id))
        else setCategories((a) => upsert(a, p.new as PfCategory).sort(byName))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_TRANSACTIONS }, (p) => {
        if (p.eventType === 'DELETE') {
          const id = (p.old as PfTransaction).id
          setTransactions((a) => removeById(a, id))
          setMonthTransactions((a) => removeById(a, id))
          return
        }
        const row = p.new as PfTransaction
        setTransactions((a) => upsert(a, row).sort(byDateDesc))
        // Nur aufnehmen, wenn die Buchung in den laufenden Monat faellt;
        // wandert sie beim Bearbeiten hinaus, wieder entfernen.
        setMonthTransactions((a) =>
          row.date.startsWith(currentMonth()) ? upsert(a, row).sort(byDateDesc) : removeById(a, row.id),
        )
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
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_FIXED_COSTS }, (p) => {
        if (p.eventType === 'DELETE') setFixedCosts((a) => removeById(a, (p.old as PfFixedCost).id))
        else setFixedCosts((a) => upsert(a, p.new as PfFixedCost).sort(byName))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_RECURRING_INCOME }, (p) => {
        if (p.eventType === 'DELETE') setIncomes((a) => removeById(a, (p.old as PfRecurringIncome).id))
        else setIncomes((a) => upsert(a, p.new as PfRecurringIncome).sort(byName))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_POTS }, (p) => {
        if (p.eventType === 'DELETE') setPots((a) => removeById(a, (p.old as PfPot).id))
        else setPots((a) => upsert(a, p.new as PfPot).sort(byPriority))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_DEBTS }, (p) => {
        if (p.eventType === 'DELETE') setDebts((a) => removeById(a, (p.old as PfDebt).id))
        else setDebts((a) => upsert(a, p.new as PfDebt).sort(byPriority))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_ALLOCATION_STEPS }, (p) => {
        if (p.eventType === 'DELETE') setSteps((a) => removeById(a, (p.old as PfAllocationStep).id))
        else setSteps((a) => upsert(a, p.new as PfAllocationStep).sort(byPosition))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE.PF_VARIABLE_ESTIMATES }, (p) => {
        if (p.eventType === 'DELETE') setEstimates((a) => removeById(a, (p.old as PfVariableEstimate).id))
        else setEstimates((a) => upsert(a, p.new as PfVariableEstimate))
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

  const addCashLocation = useCallback(async (data: PfCashLocationInput) => {
    const { data: row, error } = await personalService.addCashLocation(data)
    if (error) dbErr('Ort konnte nicht angelegt werden.')
    else setCashLocations((a) => upsert(a, row as PfCashLocation).sort(byPosition))
  }, [])

  const updateCashLocation = useCallback(
    async (id: string, data: Partial<PfCashLocationInput>) => {
      const { error } = await personalService.updateCashLocation(id, data)
      if (error) dbErr('Ort konnte nicht geändert werden.')
      else setCashLocations((a) => a.map((c) => (c.id === id ? { ...c, ...data } : c)).sort(byPosition))
    },
    [],
  )

  const deleteCashLocation = useCallback(async (id: string) => {
    const { error } = await personalService.deleteCashLocation(id)
    if (error) dbErr('Ort konnte nicht gelöscht werden.')
    else setCashLocations((a) => removeById(a, id))
  }, [])

  const addCategory = useCallback(async (data: PfCategoryInput) => {
    const { data: row, error } = await personalService.addCategory(data)
    if (error) {
      categoryErr(error.code, 'Kategorie konnte nicht angelegt werden.')
      return null
    }
    setCategories((a) => upsert(a, row as PfCategory).sort(byName))
    return row as PfCategory
  }, [])

  const updateCategory = useCallback(async (id: string, data: Partial<PfCategoryInput>) => {
    const { error } = await personalService.updateCategory(id, data)
    if (error) {
      categoryErr(error.code, 'Kategorie konnte nicht geändert werden.')
      return false
    }
    // Lokal nachziehen statt auf Realtime zu warten — sonst steht im Editor
    // nach dem Speichern kurz noch der alte Name.
    setCategories((a) => a.map((c) => (c.id === id ? { ...c, ...data } : c)).sort(byName))
    return true
  }, [])

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await personalService.deleteCategory(id)
    if (error) {
      // Beim Loeschen bedeutet 23505 etwas Eigenes: eine Unterkategorie wird
      // dabei zur Hauptkategorie und stiesse dort auf einen belegten Namen.
      if (error.code === '23505')
        dbErr('Löschen nicht möglich: eine Unterkategorie würde dabei zur Hauptkategorie, und den Namen gibt es dort schon. Benenne sie zuerst um.')
      else categoryErr(error.code, 'Kategorie konnte nicht gelöscht werden.')
      return false
    }
    setCategories((a) =>
      // Die Kinder der geloeschten Kategorie ruecken per "on delete set null"
      // eine Ebene hoch; lokal genauso nachziehen.
      removeById(a, id).map((c) => (c.parent_id === id ? { ...c, parent_id: null } : c)),
    )
    return true
  }, [])

  const addTransaction = useCallback(async (data: PfTransactionInput) => {
    const { data: row, error } = await personalService.addTransaction(data)
    if (error) {
      dbErr('Umsatz konnte nicht gespeichert werden.')
      return null
    }
    const created = row as PfTransaction
    setTransactions((a) => upsert(a, created).sort(byDateDesc))
    if (created.date.startsWith(currentMonth()))
      setMonthTransactions((a) => upsert(a, created).sort(byDateDesc))
    return created
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
    if (error) {
      dbErr('Umsatz konnte nicht gelöscht werden.')
      return
    }
    setTransactions((a) => removeById(a, id))
    setMonthTransactions((a) => removeById(a, id))
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
        const rows = inserted as PfTransaction[]
        setTransactions((a) => {
          let next = a
          for (const row of rows) next = upsert(next, row)
          return next.sort(byDateDesc)
        })
        const thisMonth = rows.filter((r) => r.date.startsWith(currentMonth()))
        if (thisMonth.length > 0) {
          setMonthTransactions((a) => {
            let next = a
            for (const row of thisMonth) next = upsert(next, row)
            return next.sort(byDateDesc)
          })
        }
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
    setMonthTransactions((a) => a.filter((t) => t.import_batch_id !== batchId))
    setBatches((a) => removeById(a, batchId))
  }, [])

  // ── Planungs-Ebene ────────────────────────────────────────────────────────
  // Realtime traegt die Aenderungen nach; der lokale Upsert haelt die Liste
  // sofort aktuell, damit die Prognose ohne Verzoegerung stimmt.

  const addFixedCost = useCallback(async (data: PfFixedCostInput) => {
    const { data: row, error } = await personalService.addFixedCost(data)
    if (error) dbErr('Fixkosten konnten nicht angelegt werden.')
    else setFixedCosts((a) => upsert(a, row as PfFixedCost).sort(byName))
  }, [])

  const updateFixedCost = useCallback(async (id: string, data: Partial<PfFixedCostInput>) => {
    const { error } = await personalService.updateFixedCost(id, data)
    if (error) dbErr('Fixkosten konnten nicht geändert werden.')
    else setFixedCosts((a) => a.map((f) => (f.id === id ? { ...f, ...data } : f)).sort(byName))
  }, [])

  const deleteFixedCost = useCallback(async (id: string) => {
    const { error } = await personalService.deleteFixedCost(id)
    if (error) dbErr('Fixkosten konnten nicht gelöscht werden.')
    else setFixedCosts((a) => removeById(a, id))
  }, [])

  const addIncome = useCallback(async (data: PfRecurringIncomeInput) => {
    const { data: row, error } = await personalService.addRecurringIncome(data)
    if (error) dbErr('Einnahme konnte nicht angelegt werden.')
    else setIncomes((a) => upsert(a, row as PfRecurringIncome).sort(byName))
  }, [])

  const updateIncome = useCallback(async (id: string, data: Partial<PfRecurringIncomeInput>) => {
    const { error } = await personalService.updateRecurringIncome(id, data)
    if (error) dbErr('Einnahme konnte nicht geändert werden.')
    else setIncomes((a) => a.map((i) => (i.id === id ? { ...i, ...data } : i)).sort(byName))
  }, [])

  const deleteIncome = useCallback(async (id: string) => {
    const { error } = await personalService.deleteRecurringIncome(id)
    if (error) dbErr('Einnahme konnte nicht gelöscht werden.')
    else setIncomes((a) => removeById(a, id))
  }, [])

  const addEstimate = useCallback(async (data: PfVariableEstimateInput) => {
    const { data: row, error } = await personalService.addVariableEstimate(data)
    if (error) dbErr('Schätzposten konnte nicht angelegt werden.')
    else setEstimates((a) => upsert(a, row as PfVariableEstimate))
  }, [])

  const updateEstimate = useCallback(async (id: string, data: Partial<PfVariableEstimateInput>) => {
    const { error } = await personalService.updateVariableEstimate(id, data)
    if (error) dbErr('Schätzposten konnte nicht geändert werden.')
    else setEstimates((a) => a.map((e) => (e.id === id ? { ...e, ...data } : e)))
  }, [])

  const deleteEstimate = useCallback(async (id: string) => {
    const { error } = await personalService.deleteVariableEstimate(id)
    if (error) dbErr('Schätzposten konnte nicht gelöscht werden.')
    else setEstimates((a) => removeById(a, id))
  }, [])

  // ── Kaskade, Toepfe, Schulden ─────────────────────────────────────────────

  const addPot = useCallback(async (data: PfPotInput) => {
    const { data: row, error } = await personalService.addPot(data)
    if (error) dbErr('Topf konnte nicht angelegt werden.')
    else setPots((a) => upsert(a, row as PfPot).sort(byPriority))
  }, [])
  const updatePot = useCallback(async (id: string, data: Partial<PfPotInput>) => {
    const { error } = await personalService.updatePot(id, data)
    if (error) dbErr('Topf konnte nicht geändert werden.')
    else setPots((a) => a.map((x) => (x.id === id ? { ...x, ...data } : x)).sort(byPriority))
  }, [])
  const deletePot = useCallback(async (id: string) => {
    const { error } = await personalService.deletePot(id)
    if (error) dbErr('Topf konnte nicht gelöscht werden.')
    else setPots((a) => removeById(a, id))
  }, [])

  const addDebt = useCallback(async (data: PfDebtInput) => {
    const { data: row, error } = await personalService.addDebt(data)
    if (error) dbErr('Schuld konnte nicht angelegt werden.')
    else setDebts((a) => upsert(a, row as PfDebt).sort(byPriority))
  }, [])
  const updateDebt = useCallback(async (id: string, data: Partial<PfDebtInput>) => {
    const { error } = await personalService.updateDebt(id, data)
    // Der Check paid_amount <= initial_amount schlaegt hier zu, wenn jemand
    // mehr tilgt als aufgenommen — das gehoert benannt, nicht verschluckt.
    if (error)
      dbErr(
        error.code === '23514'
          ? 'Es lässt sich nicht mehr tilgen, als aufgenommen wurde.'
          : 'Schuld konnte nicht geändert werden.',
      )
    else setDebts((a) => a.map((x) => (x.id === id ? { ...x, ...data } : x)).sort(byPriority))
  }, [])
  const deleteDebt = useCallback(async (id: string) => {
    const { error } = await personalService.deleteDebt(id)
    if (error) dbErr('Schuld konnte nicht gelöscht werden.')
    else setDebts((a) => removeById(a, id))
  }, [])

  const addStep = useCallback(async (data: PfAllocationStepInput) => {
    const { data: row, error } = await personalService.addAllocationStep(data)
    if (error) dbErr('Stufe konnte nicht angelegt werden.')
    else setSteps((a) => upsert(a, row as PfAllocationStep).sort(byPosition))
  }, [])
  const updateStep = useCallback(async (id: string, data: Partial<PfAllocationStepInput>) => {
    const { error } = await personalService.updateAllocationStep(id, data)
    if (error) dbErr('Stufe konnte nicht geändert werden.')
    else setSteps((a) => a.map((x) => (x.id === id ? { ...x, ...data } : x)).sort(byPosition))
  }, [])
  const deleteStep = useCallback(async (id: string) => {
    const { error } = await personalService.deleteAllocationStep(id)
    if (error) dbErr('Stufe konnte nicht gelöscht werden.')
    else setSteps((a) => removeById(a, id))
  }, [])

  const value: PersonalContextValue = {
    loading,
    accounts,
    cashLocations,
    categories,
    transactions,
    monthTransactions,
    batches,
    fixedCosts,
    incomes,
    estimates,
    pots,
    debts,
    allocationSteps,
    addAccount,
    updateAccount,
    deleteAccount,
    addCashLocation,
    updateCashLocation,
    deleteCashLocation,
    addCategory,
    updateCategory,
    deleteCategory,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importRows,
    undoImport,
    addFixedCost,
    updateFixedCost,
    deleteFixedCost,
    addIncome,
    updateIncome,
    deleteIncome,
    addEstimate,
    updateEstimate,
    deleteEstimate,
    addPot,
    updatePot,
    deletePot,
    addDebt,
    updateDebt,
    deleteDebt,
    addStep,
    updateStep,
    deleteStep,
  }

  return <PersonalContext.Provider value={value}>{children}</PersonalContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePersonal() {
  const ctx = useContext(PersonalContext)
  if (!ctx) throw new Error('usePersonal muss innerhalb von PersonalProvider verwendet werden')
  return ctx
}
