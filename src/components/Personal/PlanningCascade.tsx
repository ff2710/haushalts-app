import { useEffect, useMemo, useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import * as personalService from '../../services/personalService'
import { formatMoney, todayISO } from '../../lib/utils'
import { computeForecast } from '../../lib/forecast'
import { runCascade, type CascadeStepResult } from '../../lib/cascade'
import { ChevronRightIcon } from '../ui/Icon'
import { Bar, Hint, SectionHead, card, rowCls, sep } from './planningShared'
import StepSheet from './StepSheet'
import type { PfAllocationStep } from '../../types'

// Die Kaskade: was diesen Monat voraussichtlich uebrig bleibt, der Reihe nach
// verteilt. Rein rechnerisch — hier wird nichts gebucht.
//
// Was eine Stufe nicht bekommt, bleibt sichtbar offen. Eine Kaskade, die
// gefuellte Zeilen zeigt, wo das Geld nicht reicht, waere schlimmer als keine.

const KIND_HINT: Record<string, string> = {
  fixed: 'fester Betrag',
  percent: 'Anteil vom Restgeld',
  debts: 'verteilt auf die Schulden',
  pots: 'verteilt auf die Töpfe',
  rest: 'was übrig bleibt',
}

export default function PlanningCascade() {
  const { fixedCosts, incomes, estimates, pots, debts, allocationSteps, transactions } =
    usePersonal()

  const month = todayISO().slice(0, 7)
  const [expenseTotals, setExpenseTotals] = useState<{ month: string; total: number }[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<PfAllocationStep | null>(null)

  useEffect(() => {
    let cancelled = false
    void personalService.fetchExpenseTotalsBefore(month).then(({ data }) => {
      if (!cancelled && data) setExpenseTotals(data)
    })
    return () => {
      cancelled = true
    }
  }, [month, transactions.length])

  const forecast = useMemo(
    () =>
      computeForecast(
        {
          fixedCosts,
          recurringIncomes: incomes,
          variableEstimates: estimates,
          monthlyExpenseTotals: expenseTotals,
        },
        month,
      ),
    [fixedCosts, incomes, estimates, expenseTotals, month],
  )

  const result = useMemo(
    () => runCascade(forecast.leftover, allocationSteps, pots, debts),
    [forecast.leftover, allocationSteps, pots, debts],
  )

  const open = (step: PfAllocationStep | null) => {
    setEditing(step)
    setSheetOpen(true)
  }

  /** Die Engine arbeitet mit einer Minimalform der Stufe; zum Bearbeiten
   *  braucht es die vollstaendige Zeile aus dem Context. */
  const fullStep = (id: string) => allocationSteps.find((s) => s.id === id) ?? null

  const stepLine = (r: CascadeStepResult) => {
    const share = r.needed && r.needed > 0 ? r.allocated / r.needed : 1
    return (
      <div key={r.step.id}>
        <button
          onClick={() => open(fullStep(r.step.id))}
          className={`${rowCls} transition-colors duration-100 active:bg-zinc-50`}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[15px] font-medium text-zinc-900">{r.step.name}</span>
              <span
                className={
                  'shrink-0 text-[15px] font-semibold tabular-nums ' +
                  (r.allocated > 0 ? 'text-zinc-900' : 'text-zinc-300')
                }
              >
                {formatMoney(r.allocated)}
              </span>
            </span>

            {r.needed !== null && r.needed > 0 && (
              <span className="mt-1.5 block">
                <Bar ratio={share} className={r.short ? 'bg-amber-500' : 'bg-brand-600'} />
              </span>
            )}

            <span className="mt-1 block text-[12px] text-zinc-400">
              {r.short ? (
                <span className="text-amber-600">
                  {formatMoney((r.needed ?? 0) - r.allocated)} fehlen —{' '}
                  {KIND_HINT[r.step.kind]}
                </span>
              ) : (
                KIND_HINT[r.step.kind]
              )}
              {r.step.kind === 'percent' && r.step.percent != null && ` · ${r.step.percent} %`}
            </span>

            {/* Bei Toepfen und Schulden zeigt sich erst hier, wer was bekommt. */}
            {r.shares.length > 0 && (
              <span className="mt-1.5 block space-y-0.5">
                {r.shares.map((sh) => (
                  <span key={sh.id} className="flex justify-between gap-3 text-[12px]">
                    <span className="truncate text-zinc-500">{sh.name}</span>
                    <span className="shrink-0 tabular-nums text-zinc-500">
                      {formatMoney(sh.allocated)}
                      {sh.remainingAfter > 0 && (
                        <span className="text-zinc-300"> · noch {formatMoney(sh.remainingAfter)}</span>
                      )}
                    </span>
                  </span>
                ))}
              </span>
            )}
          </span>
          <ChevronRightIcon size={14} strokeWidth={2.5} className="shrink-0 text-zinc-300" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Was zu verteilen ist ──────────────────────────────────────────── */}
      <section>
        <SectionHead title="Zu verteilen diesen Monat" />
        <div className={`${card} p-4`}>
          <p
            className={
              'text-[28px] font-semibold leading-none tracking-[-0.6px] tabular-nums ' +
              (result.input > 0 ? 'text-zinc-900' : 'text-red-500')
            }
          >
            {formatMoney(result.input)}
          </p>
          <p className="mt-1.5 text-[12px] leading-snug text-zinc-400">
            Erwartete Einnahmen {formatMoney(forecast.expectedIncome)} − Fixkosten{' '}
            {formatMoney(forecast.fixedMonthly)} − variable Schätzung{' '}
            {formatMoney(forecast.variableEstimate)}
          </p>
          {forecast.leftover < 0 && (
            <p className="mt-2 rounded-xl bg-red-50 px-3 py-2.5 text-[12px] leading-snug text-red-600">
              Rechnerisch bleibt nichts übrig — die Planung geht {formatMoney(-forecast.leftover)}{' '}
              ins Minus. Die Kaskade verteilt deshalb nichts, statt Beträge zu erfinden.
            </p>
          )}
        </div>
      </section>

      {/* ── Die Stufen ────────────────────────────────────────────────────── */}
      <section>
        <SectionHead
          title="Stufen"
          add={{ label: 'Stufe hinzufügen', onClick: () => open(null) }}
        />
        <div className={card}>
          {allocationSteps.length === 0 ? (
            <p className="px-4 py-4 text-[14px] text-zinc-400">Noch keine Stufen</p>
          ) : (
            result.steps.map((r, i) => (
              <div key={r.step.id}>
                {i > 0 && sep}
                {stepLine(r)}
              </div>
            ))
          )}
        </div>

        {/* Inaktive Stufen laufen nicht mit, sollen aber auffindbar bleiben. */}
        {allocationSteps.some((s) => !s.active) && (
          <div className={`${card} mt-2`}>
            {allocationSteps
              .filter((s) => !s.active)
              .map((s, i) => (
                <div key={s.id}>
                  {i > 0 && sep}
                  <button
                    onClick={() => open(s)}
                    className={`${rowCls} transition-colors duration-100 active:bg-zinc-50`}
                  >
                    <span className="truncate text-[14px] text-zinc-400">{s.name} · pausiert</span>
                    <ChevronRightIcon size={14} strokeWidth={2.5} className="shrink-0 text-zinc-300" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* ── Ergebnis ──────────────────────────────────────────────────────── */}
      <section>
        <div className={`${card} p-4`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] text-zinc-500">Nach allen Stufen übrig</span>
            <span className="text-[17px] font-semibold tabular-nums text-zinc-900">
              {formatMoney(result.leftover)}
            </span>
          </div>
          {result.shortfall > 0 && (
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-zinc-100 pt-2">
              <span className="text-[14px] text-amber-600">Insgesamt zu wenig</span>
              <span className="text-[15px] font-semibold tabular-nums text-amber-600">
                {formatMoney(result.shortfall)}
              </span>
            </div>
          )}
        </div>
      </section>

      <Hint>
        Eine Vorschau, keine Buchung: die Kaskade zeigt, wohin das Geld nach Plan ginge.
        Töpfe und Schulden verändert sie nicht — deren Stand trägst du ein, wenn er sich
        wirklich ändert.
      </Hint>

      <StepSheet open={sheetOpen} onClose={() => setSheetOpen(false)} step={editing} />
    </div>
  )
}
