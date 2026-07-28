import { useMemo } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import { SkeletonBlock } from '../ui/Skeleton'
import { MoneyFlyIcon } from '../ui/Icon'
import { formatMoney } from '../../lib/utils'

// Übersicht des Persönlich-Bereichs: Monatsbilanz + Kontostand.
// Fixkosten, Budgets und Prognose folgen in Phase 2.

export default function PersonalHome() {
  const { loading, accounts, transactions } = usePersonal()

  const month = new Date().toISOString().slice(0, 7) // YYYY-MM

  const stats = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of transactions) {
      if (!t.date.startsWith(month)) continue
      if (t.type === 'income') income += Number(t.amount)
      else expense += Number(t.amount)
    }
    // Betrag ist in der DB immer positiv — Richtung kommt aus `type`.
    const total = transactions.reduce(
      (sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)),
      0,
    )
    return { income, expense, saldo: income - expense, total }
  }, [transactions, month])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <SkeletonBlock className="h-28 w-full rounded-3xl" />
        <SkeletonBlock className="h-20 w-full rounded-3xl" />
      </div>
    )
  }

  const monthLabel = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
            <MoneyFlyIcon size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
              Dein privater Bereich
            </h2>
            <p className="text-[13px] leading-snug text-zinc-500">
              Nur für dich sichtbar — niemand sonst kann diese Daten sehen.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <p className="text-[12px] font-medium uppercase tracking-wide text-zinc-400">
          {monthLabel}
        </p>
        <p
          className={
            'mt-1 text-[32px] font-semibold leading-none tracking-[-0.8px] tabular-nums ' +
            (stats.saldo >= 0 ? 'text-emerald-600' : 'text-zinc-900')
          }
        >
          {stats.saldo >= 0 ? '+' : '−'}
          {formatMoney(Math.abs(stats.saldo))}
        </p>
        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-[12px] text-zinc-400">Einnahmen</p>
            <p className="text-[15px] font-medium tabular-nums text-emerald-600">
              {formatMoney(stats.income)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-zinc-400">Ausgaben</p>
            <p className="text-[15px] font-medium tabular-nums text-zinc-900">
              {formatMoney(stats.expense)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <div className="text-[28px] font-semibold leading-none tracking-[-0.6px] text-zinc-900">
            {accounts.length}
          </div>
          <div className="mt-1.5 text-[13px] text-zinc-500">
            {accounts.length === 1 ? 'Konto' : 'Konten'}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <div className="text-[28px] font-semibold leading-none tracking-[-0.6px] text-zinc-900">
            {transactions.length}
          </div>
          <div className="mt-1.5 text-[13px] text-zinc-500">
            {transactions.length === 1 ? 'Umsatz' : 'Umsätze'}
          </div>
        </div>
      </section>
    </div>
  )
}
