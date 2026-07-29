import { useMemo, useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import { SkeletonBlock } from '../ui/Skeleton'
import { ChevronRightIcon, PlusIcon } from '../ui/Icon'
import { formatMoney, todayISO } from '../../lib/utils'
import { monthlyContribution, recurringAmountForMonth } from '../../lib/forecast'
import { budgetStatus } from '../../lib/budget'
import FixedCostSheet, { CADENCES } from './FixedCostSheet'
import IncomeSheet from './IncomeSheet'
import EstimateSheet from './EstimateSheet'
import BudgetSheet from './BudgetSheet'
import type { PfCategory, PfFixedCost, PfRecurringIncome, PfVariableEstimate } from '../../types'

const cadenceLabel = (c: string) => CADENCES.find((x) => x.id === c)?.label ?? c

const card   = 'overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.05]'
const rowCls = 'flex w-full items-center justify-between gap-3 px-4 py-[13px] text-left'
const sep    = <div className="mx-4 h-px bg-zinc-100" />
const sLabel = 'mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400'

/** Planungs-Ebene: was jeden Monat fest rein- und rausgeht, plus Budgets.
 *  Speist die Prognose in der Übersicht. */
export default function Planning() {
  const { loading, fixedCosts, incomes, estimates, categories, monthTransactions } = usePersonal()

  const [fixedOpen, setFixedOpen] = useState(false)
  const [fixedEdit, setFixedEdit] = useState<PfFixedCost | null>(null)
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [incomeEdit, setIncomeEdit] = useState<PfRecurringIncome | null>(null)
  const [estOpen, setEstOpen] = useState(false)
  const [estEdit, setEstEdit] = useState<PfVariableEstimate | null>(null)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [budgetCat, setBudgetCat] = useState<PfCategory | null>(null)

  const month = todayISO().slice(0, 7)

  // Ausgaben des laufenden Monats je Kategorie — Grundlage der Budget-Anzeige.
  const spentByCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of monthTransactions) {
      if (t.type !== 'expense' || !t.category_id) continue
      m.set(t.category_id, (m.get(t.category_id) ?? 0) + Number(t.amount))
    }
    return m
  }, [monthTransactions])

  const budgetCats = categories.filter((c) => c.type === 'expense')

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  const emptyRow = (text: string) => (
    <div className="px-4 py-[13px] text-[14px] text-zinc-400">{text}</div>
  )

  const addButton = (label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 py-3 text-[14px] font-medium text-zinc-500 transition-colors duration-150 active:bg-black/[0.03]"
    >
      <PlusIcon size={16} />
      {label}
    </button>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ── Regelmäßige Einnahmen ─────────────────────────────────────────── */}
      <section>
        <p className={sLabel}>Regelmäßige Einnahmen</p>
        <div className={card}>
          {incomes.length === 0
            ? emptyRow('Noch keine Einnahmen hinterlegt')
            : incomes.map((inc, i) => {
                const active = recurringAmountForMonth(inc, month) > 0
                return (
                  <div key={inc.id}>
                    {i > 0 && sep}
                    <button
                      onClick={() => {
                        setIncomeEdit(inc)
                        setIncomeOpen(true)
                      }}
                      className={`${rowCls} transition-colors duration-100 active:bg-zinc-50`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-medium text-zinc-900">
                          {inc.name || 'Ohne Namen'}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-zinc-400">
                          ab {inc.start_month}
                          {inc.end_month ? ` bis ${inc.end_month}` : ''}
                          {!active && ' · zählt diesen Monat nicht'}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={
                            'text-[15px] font-semibold tabular-nums ' +
                            (active ? 'text-emerald-600' : 'text-zinc-300')
                          }
                        >
                          {formatMoney(Number(inc.amount))}
                        </span>
                        <ChevronRightIcon size={14} strokeWidth={2.5} className="text-zinc-300" />
                      </span>
                    </button>
                  </div>
                )
              })}
        </div>
        {addButton('Einnahme hinzufügen', () => {
          setIncomeEdit(null)
          setIncomeOpen(true)
        })}
      </section>

      {/* ── Fixkosten ─────────────────────────────────────────────────────── */}
      <section>
        <p className={sLabel}>Fixkosten</p>
        <div className={card}>
          {fixedCosts.length === 0
            ? emptyRow('Noch keine Fixkosten hinterlegt')
            : fixedCosts.map((fc, i) => {
                const monthly = monthlyContribution(fc, month)
                return (
                  <div key={fc.id}>
                    {i > 0 && sep}
                    <button
                      onClick={() => {
                        setFixedEdit(fc)
                        setFixedOpen(true)
                      }}
                      className={`${rowCls} transition-colors duration-100 active:bg-zinc-50`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-medium text-zinc-900">
                          {fc.name}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-zinc-400">
                          {cadenceLabel(fc.cadence)}
                          {fc.cadence !== 'monthly' && fc.due_month ? ` · fällig ${fc.due_month}` : ''}
                          {!fc.active && ' · inaktiv'}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="text-right">
                          <span className="block text-[15px] font-semibold tabular-nums text-zinc-900">
                            {formatMoney(Number(fc.amount))}
                          </span>
                          {/* Bei nicht-monatlichen Posten zeigt der Monatsbeitrag,
                              was tatsächlich in die Prognose einfließt. */}
                          {fc.cadence !== 'monthly' && monthly > 0 && (
                            <span className="block text-[11px] text-zinc-400">
                              {formatMoney(monthly)} / Monat
                            </span>
                          )}
                        </span>
                        <ChevronRightIcon size={14} strokeWidth={2.5} className="text-zinc-300" />
                      </span>
                    </button>
                  </div>
                )
              })}
        </div>
        {addButton('Fixkosten hinzufügen', () => {
          setFixedEdit(null)
          setFixedOpen(true)
        })}
      </section>

      {/* ── Variable Schätzposten ─────────────────────────────────────────── */}
      <section>
        <p className={sLabel}>Variable Schätzposten</p>
        <div className={card}>
          {estimates.length === 0
            ? emptyRow('Noch keine Schätzposten')
            : estimates.map((est, i) => (
                <div key={est.id}>
                  {i > 0 && sep}
                  <button
                    onClick={() => {
                      setEstEdit(est)
                      setEstOpen(true)
                    }}
                    className={`${rowCls} transition-colors duration-100 active:bg-zinc-50`}
                  >
                    <span className="truncate text-[15px] font-medium text-zinc-900">{est.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[15px] font-semibold tabular-nums text-zinc-900">
                        {formatMoney(Number(est.amount))}
                      </span>
                      <ChevronRightIcon size={14} strokeWidth={2.5} className="text-zinc-300" />
                    </span>
                  </button>
                </div>
              ))}
        </div>
        {addButton('Schätzposten hinzufügen', () => {
          setEstEdit(null)
          setEstOpen(true)
        })}
      </section>

      {/* ── Budgets ───────────────────────────────────────────────────────── */}
      <section>
        <p className={sLabel}>Budgets je Kategorie</p>
        <div className={card}>
          {budgetCats.length === 0
            ? emptyRow('Keine Ausgaben-Kategorien vorhanden')
            : budgetCats.map((c, i) => {
                const budget = c.monthly_budget == null ? null : Number(c.monthly_budget)
                const spent = spentByCategory.get(c.id) ?? 0
                const { level, ratio, overBy } = budgetStatus(spent, budget, Number(c.warn_ratio))
                const over = level === 'over'
                const warn = level === 'warn'
                return (
                  <div key={c.id}>
                    {i > 0 && sep}
                    <button
                      onClick={() => {
                        setBudgetCat(c)
                        setBudgetOpen(true)
                      }}
                      className={`${rowCls} transition-colors duration-100 active:bg-zinc-50`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-zinc-900">
                          {c.name}
                        </span>
                        {level === 'none' ? (
                          <span className="mt-0.5 block text-[12px] text-zinc-400">
                            Kein Budget gesetzt
                          </span>
                        ) : (
                          <>
                            <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                              <span
                                className={
                                  'block h-full rounded-full ' +
                                  (over ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-brand-600')
                                }
                                style={{ width: `${Math.min(100, ratio * 100)}%` }}
                              />
                            </span>
                            <span
                              className={
                                'mt-1 block text-[12px] ' +
                                (over ? 'text-red-500' : warn ? 'text-amber-600' : 'text-zinc-400')
                              }
                            >
                              {formatMoney(spent)} von {formatMoney(budget as number)}
                              {over
                                ? ` · ${formatMoney(overBy)} drüber`
                                : warn
                                  ? ' · Schwelle erreicht'
                                  : ''}
                            </span>
                          </>
                        )}
                      </span>
                      <ChevronRightIcon size={14} strokeWidth={2.5} className="shrink-0 text-zinc-300" />
                    </button>
                  </div>
                )
              })}
        </div>
      </section>

      <FixedCostSheet open={fixedOpen} onClose={() => setFixedOpen(false)} fixedCost={fixedEdit} />
      <IncomeSheet open={incomeOpen} onClose={() => setIncomeOpen(false)} income={incomeEdit} />
      <EstimateSheet open={estOpen} onClose={() => setEstOpen(false)} estimate={estEdit} />
      <BudgetSheet open={budgetOpen} onClose={() => setBudgetOpen(false)} category={budgetCat} />
    </div>
  )
}
