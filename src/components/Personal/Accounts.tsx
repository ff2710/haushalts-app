import { useMemo, useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import { SkeletonBlock } from '../ui/Skeleton'
import { ChevronRightIcon } from '../ui/Icon'
import AddButton from '../ui/AddButton'
import { formatMoney } from '../../lib/utils'
import AccountSheet, { ACCOUNT_TYPES } from './AccountSheet'
import type { PfAccount } from '../../types'

const typeLabel = (t: string) => ACCOUNT_TYPES.find((x) => x.id === t)?.label ?? t

export default function Accounts() {
  const { loading, accounts, transactions } = usePersonal()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<PfAccount | null>(null)

  // Saldo je Konto aus den Umsaetzen: Einnahmen plus, Ausgaben minus.
  // Der Betrag ist in der DB immer positiv — die Richtung steckt in `type`.
  const balances = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactions) {
      if (!t.account_id) continue
      const delta = t.type === 'income' ? Number(t.amount) : -Number(t.amount)
      m.set(t.account_id, (m.get(t.account_id) ?? 0) + delta)
    }
    return m
  }, [transactions])

  const openNew = () => {
    setEditing(null)
    setSheetOpen(true)
  }

  const openEdit = (acc: PfAccount) => {
    setEditing(acc)
    setSheetOpen(true)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-2">
        <SkeletonBlock className="h-16 w-full rounded-2xl" />
        <SkeletonBlock className="h-16 w-full rounded-2xl" />
        <SkeletonBlock className="h-16 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {accounts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/10 bg-white/50 p-8 text-center">
          <p className="text-[15px] font-medium text-zinc-700">Noch keine Konten</p>
          <p className="mt-1 text-[13px] leading-snug text-zinc-500">
            Lege dein erstes Konto an — z. B. dein Girokonto.
          </p>
          <button
            onClick={openNew}
            className="mt-4 rounded-2xl bg-brand-600 px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity duration-150 active:opacity-80"
          >
            Konto anlegen
          </button>
        </div>
      ) : (
        <>
          <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400">
              Konten
            </p>
            <AddButton onClick={openNew} label="Konto hinzufügen" />
          </div>
          <ul className="space-y-2">
            {accounts.map((acc) => (
              <li key={acc.id}>
                <button
                  onClick={() => openEdit(acc)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-soft transition-transform duration-150 active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[15px] font-medium text-zinc-900">{acc.name}</p>
                      {acc.is_hub && (
                        <span className="shrink-0 rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                          Hub
                        </span>
                      )}
                      {acc.is_shared_ref && (
                        <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Gemeinsam
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-zinc-400">{typeLabel(acc.type)}</p>
                  </div>
                  <p className="shrink-0 text-[15px] font-semibold tabular-nums text-zinc-900">
                    {formatMoney(balances.get(acc.id) ?? 0)}
                  </p>
                  <ChevronRightIcon size={16} className="shrink-0 text-zinc-300" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <AccountSheet open={sheetOpen} onClose={() => setSheetOpen(false)} account={editing} />
    </div>
  )
}
