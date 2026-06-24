import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { formatDate, formatMoney } from '../../lib/utils'
import type { Expense, Person, Settlement } from '../../types'
import { MoneyFlyIcon, SwapIcon, TrashIcon } from '../ui/Icon'

type Row =
  | { kind: 'expense';    data: Expense    }
  | { kind: 'settlement'; data: Settlement }

export default function History({
  onDelete,
  hiddenId,
}: {
  onDelete: (kind: 'expense' | 'settlement', id: string, label: string) => void
  hiddenId?: string | null
}) {
  const { expenses, settlements, nameA, nameB } = useApp()
  const nameOf = (p: Person) => (p === 'A' ? nameA : nameB)

  const rows: Row[] = useMemo(() => {
    const all: Row[] = [
      ...expenses.map((e)   => ({ kind: 'expense'    as const, data: e })),
      ...settlements.map((s) => ({ kind: 'settlement' as const, data: s })),
    ]
    return all.sort((a, b) => {
      const d = b.data.date.localeCompare(a.data.date)
      return d !== 0 ? d : b.data.created_at.localeCompare(a.data.created_at)
    })
  }, [expenses, settlements])

  const splitLabel = (e: Expense) => {
    if (e.split === 'both') return 'für beide'
    return 'nur ' + nameOf(e.split)
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white py-14 text-center shadow-card ring-1 ring-black/[0.05]">
        <p className="text-[15px] text-zinc-400">Noch keine Einträge.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
        Verlauf
      </h3>

      <AnimatePresence initial={false} mode="popLayout">
        {rows
          .filter((row) => row.data.id !== hiddenId)
          .map((row) =>
            row.kind === 'expense' ? (
              <motion.div
                key={'e' + row.data.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-black/[0.05]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <MoneyFlyIcon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-zinc-900">
                    {row.data.description}
                  </p>
                  <p className="mt-0.5 text-[12px] text-zinc-400">
                    {formatDate(row.data.date)} · {nameOf(row.data.paid_by)} · {splitLabel(row.data)}
                  </p>
                </div>

                <p className="shrink-0 text-[14px] font-semibold text-zinc-900">
                  {formatMoney(Number(row.data.amount))}
                </p>

                <button
                  onClick={() => onDelete('expense', row.data.id, `${row.data.description} (${formatMoney(Number(row.data.amount))})`)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-300 transition-all duration-150 hover:bg-red-50 hover:text-red-400 active:scale-90"
                  aria-label="Löschen"
                >
                  <TrashIcon size={14} />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={'s' + row.data.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3.5 shadow-card ring-1 ring-emerald-100/80"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <SwapIcon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-emerald-900">
                    Zahlung: {nameOf(row.data.from_person)} → {nameOf(row.data.to_person)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-emerald-600/70">
                    {formatDate(row.data.date)}
                  </p>
                </div>

                <p className="shrink-0 text-[14px] font-semibold text-emerald-700">
                  {formatMoney(Number(row.data.amount))}
                </p>

                <button
                  onClick={() =>
                    onDelete(
                      'settlement',
                      row.data.id,
                      `Zahlung ${nameOf(row.data.from_person)} → ${nameOf(row.data.to_person)} (${formatMoney(Number(row.data.amount))})`
                    )
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-emerald-300 transition-all duration-150 hover:bg-red-50 hover:text-red-400 active:scale-90"
                  aria-label="Löschen"
                >
                  <TrashIcon size={14} />
                </button>
              </motion.div>
            )
          )}
      </AnimatePresence>
    </div>
  )
}
