import { useMemo, useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import { SkeletonBlock } from '../ui/Skeleton'
import { PlusIcon, MoneyFlyIcon } from '../ui/Icon'
import { formatDate, formatMoney } from '../../lib/utils'
import TransactionSheet from './TransactionSheet'
import CsvImport from './CsvImport'
import type { PfTransaction } from '../../types'

export default function Transactions() {
  const { loading, transactions, categories, batches, undoImport } = usePersonal()

  const [sheetOpen, setSheetOpen]   = useState(false)
  const [editing, setEditing]       = useState<PfTransaction | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const catName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]))
    return (id: string | null) => (id ? m.get(id) ?? null : null)
  }, [categories])

  // Umsätze nach Datum gruppieren — ruhigeres Listenbild.
  const groups = useMemo(() => {
    const m = new Map<string, PfTransaction[]>()
    for (const t of transactions) {
      const arr = m.get(t.date)
      if (arr) arr.push(t)
      else m.set(t.date, [t])
    }
    return [...m.entries()]
  }, [transactions])

  const openNew = () => {
    setEditing(null)
    setSheetOpen(true)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-2">
        <SkeletonBlock className="h-14 w-full rounded-2xl" />
        <SkeletonBlock className="h-14 w-full rounded-2xl" />
        <SkeletonBlock className="h-14 w-full rounded-2xl" />
      </div>
    )
  }

  const lastBatch = batches[0]

  return (
    <div className="mx-auto max-w-2xl">
      {/* Aktionen */}
      <div className="flex gap-2">
        <button
          onClick={openNew}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3 text-[14px] font-semibold text-white transition-opacity duration-150 active:opacity-80"
        >
          <PlusIcon size={16} />
          Umsatz
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="rounded-2xl bg-white px-4 py-3 text-[14px] font-medium text-zinc-700 shadow-soft transition-transform duration-150 active:scale-[0.98]"
        >
          CSV-Import
        </button>
      </div>

      {/* Letzter Import — rückgängig machbar */}
      {lastBatch && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-zinc-700">
              Letzter Import: {lastBatch.filename}
            </p>
            <p className="text-[12px] text-zinc-400">
              {lastBatch.row_count} Umsätze · {formatDate(lastBatch.imported_at)}
            </p>
          </div>
          <button
            onClick={() => void undoImport(lastBatch.id)}
            className="shrink-0 rounded-xl px-3 py-1.5 text-[13px] font-medium text-red-500 transition-colors duration-150 active:bg-red-50"
          >
            Rückgängig
          </button>
        </div>
      )}

      {/* Liste. Dichte bewusst hoch gehalten: hier scrollt man durch viele
          Zeilen, und jeder Millimeter Rand kostet eine sichtbare Buchung. */}
      {transactions.length === 0 ? (
        <div className="mt-3 rounded-3xl border border-dashed border-black/10 bg-white/50 p-8 text-center">
          <p className="text-[15px] font-medium text-zinc-700">Noch keine Umsätze</p>
          <p className="mt-1 text-[13px] leading-snug text-zinc-500">
            Erfasse deinen ersten Umsatz oder importiere eine CSV aus dem Banking.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {groups.map(([date, list]) => (
            <section key={date}>
              <h3 className="mb-1 px-1 text-[12px] font-medium uppercase tracking-wide text-zinc-400">
                {formatDate(date)}
              </h3>
              <ul className="space-y-1">
                {list.map((t) => {
                  const cat = catName(t.category_id)
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => {
                          setEditing(t)
                          setSheetOpen(true)
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 text-left shadow-soft transition-transform duration-150 active:scale-[0.99]"
                      >
                        <div
                          className={
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ' +
                            (t.type === 'income'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-brand-50 text-brand-600')
                          }
                        >
                          <MoneyFlyIcon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-zinc-900">
                            {t.description || '(ohne Beschreibung)'}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-zinc-400">
                            {cat && <span className="truncate">{cat}</span>}
                            {t.source === 'csv' && (
                              <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                                CSV
                              </span>
                            )}
                          </p>
                        </div>
                        <p
                          className={
                            'shrink-0 text-[14px] font-semibold tabular-nums ' +
                            (t.type === 'income' ? 'text-emerald-600' : 'text-zinc-900')
                          }
                        >
                          {t.type === 'income' ? '+' : '−'}
                          {formatMoney(Number(t.amount))}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <TransactionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        transaction={editing}
      />
      <CsvImport open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
