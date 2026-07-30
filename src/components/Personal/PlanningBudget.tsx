import { useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import { ChevronRightIcon } from '../ui/Icon'
import { formatMoney, todayISO } from '../../lib/utils'
import { monthlyContribution, recurringAmountForMonth } from '../../lib/forecast'
import FixedCostSheet, { CADENCES } from './FixedCostSheet'
import IncomeSheet from './IncomeSheet'
import EstimateSheet from './EstimateSheet'
import { EmptyRow, SectionHead, card, rowCls, sep } from './planningShared'
import type { PfFixedCost, PfRecurringIncome, PfVariableEstimate } from '../../types'

const cadenceLabel = (c: string) => CADENCES.find((x) => x.id === c)?.label ?? c

// Was jeden Monat fest rein- und rausgeht. Speist die Prognose in der
// Uebersicht und damit den Betrag, den die Kaskade verteilt.

export default function PlanningBudget() {
  const { fixedCosts, incomes, estimates } = usePersonal()

  const [fixedOpen, setFixedOpen] = useState(false)
  const [fixedEdit, setFixedEdit] = useState<PfFixedCost | null>(null)
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [incomeEdit, setIncomeEdit] = useState<PfRecurringIncome | null>(null)
  const [estOpen, setEstOpen] = useState(false)
  const [estEdit, setEstEdit] = useState<PfVariableEstimate | null>(null)

  const month = todayISO().slice(0, 7)

  return (
    <div className="space-y-6">
      {/* ── Regelmäßige Einnahmen ─────────────────────────────────────────── */}
      <section>
        <SectionHead title={'Regelmäßige Einnahmen'} add={{
          label: 'Einnahme hinzufügen',
          onClick: () => {
            setIncomeEdit(null)
            setIncomeOpen(true)
          },
        }} />
        <div className={card}>
          {incomes.length === 0
            ? <EmptyRow>Noch keine Einnahmen hinterlegt</EmptyRow>
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
      </section>

      {/* ── Fixkosten ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHead title={'Fixkosten'} add={{
          label: 'Fixkosten hinzufügen',
          onClick: () => {
            setFixedEdit(null)
            setFixedOpen(true)
          },
        }} />
        <div className={card}>
          {fixedCosts.length === 0
            ? <EmptyRow>Noch keine Fixkosten hinterlegt</EmptyRow>
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
      </section>

      {/* ── Variable Schätzposten ─────────────────────────────────────────── */}
      <section>
        <SectionHead title={'Variable Schätzposten'} add={{
          label: 'Schätzposten hinzufügen',
          onClick: () => {
            setEstEdit(null)
            setEstOpen(true)
          },
        }} />
        <div className={card}>
          {estimates.length === 0
            ? <EmptyRow>Noch keine Schätzposten</EmptyRow>
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
      </section>

      <FixedCostSheet open={fixedOpen} onClose={() => setFixedOpen(false)} fixedCost={fixedEdit} />
      <IncomeSheet open={incomeOpen} onClose={() => setIncomeOpen(false)} income={incomeEdit} />
      <EstimateSheet open={estOpen} onClose={() => setEstOpen(false)} estimate={estEdit} />
    </div>
  )
}
