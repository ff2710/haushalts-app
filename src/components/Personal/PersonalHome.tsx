import { useEffect, useMemo, useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import * as personalService from '../../services/personalService'
import { SkeletonBlock } from '../ui/Skeleton'
import { MoneyFlyIcon } from '../ui/Icon'
import { formatMoney, todayISO } from '../../lib/utils'
import { computeForecast } from '../../lib/forecast'
import { budgetStatus } from '../../lib/budget'
import { buildCashflow } from '../../lib/cashflow'

// Übersicht des Persönlich-Bereichs: Monatsend-Prognose + Ist-Stand.
// Die Prognose rechnet ausschließlich mit den Funktionen aus lib/forecast.ts,
// die 1:1 aus dem Finanztracker portiert und gegen das Original getestet sind.

export default function PersonalHome() {
  // monthTransactions statt transactions fuer alle Monatssummen: die
  // allgemeine Umsatzliste ist gedeckelt und wuerde bei vielen Buchungen zu
  // niedrige Summen liefern.
  const {
    loading, accounts, transactions, monthTransactions,
    fixedCosts, incomes, estimates, categories,
  } = usePersonal()

  const month = todayISO().slice(0, 7)

  // Für den Vorschlagswert: Ausgaben-Summen der Vormonate. Bewusst separat
  // geladen, weil die Umsatzliste im Context nur die jüngsten Zeilen hält.
  const [expenseTotals, setExpenseTotals] = useState<{ month: string; total: number }[]>([])
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

  // Ist-Stand des laufenden Monats — dieselbe Rechnung wie in der Analyse.
  // Zwei eigene Summierungen für dieselben Zahlen wären zwei Gelegenheiten,
  // auseinanderzulaufen.
  const actual = useMemo(
    () => buildCashflow(monthTransactions, categories),
    [monthTransactions, categories],
  )

  // Budgets, die diesen Monat Aufmerksamkeit brauchen.
  const budgetAlerts = useMemo(() => {
    const spent = new Map<string, number>()
    for (const t of monthTransactions) {
      if (t.type !== 'expense' || !t.category_id) continue
      spent.set(t.category_id, (spent.get(t.category_id) ?? 0) + Number(t.amount))
    }
    return categories
      .filter((c) => c.type === 'expense')
      .map((c) => {
        const budget = c.monthly_budget == null ? null : Number(c.monthly_budget)
        const used = spent.get(c.id) ?? 0
        const status = budgetStatus(used, budget, Number(c.warn_ratio))
        return { id: c.id, name: c.name, budget: budget ?? 0, used, ...status }
      })
      // Nur zeigen, was Aufmerksamkeit braucht.
      .filter((b) => b.level === 'warn' || b.level === 'over')
      .sort((a, b) => b.ratio - a.ratio)
  }, [monthTransactions, categories])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <SkeletonBlock className="h-40 w-full rounded-3xl" />
        <SkeletonBlock className="h-28 w-full rounded-3xl" />
      </div>
    )
  }

  const monthLabel = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const hasPlan = fixedCosts.length > 0 || incomes.length > 0 || estimates.length > 0

  const line = (label: string, value: string, cls = 'text-zinc-900') => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[14px] text-zinc-500">{label}</span>
      <span className={`text-[15px] font-medium tabular-nums ${cls}`}>{value}</span>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {/* ── Prognose ──────────────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <p className="text-[12px] font-medium uppercase tracking-wide text-zinc-400">
          Prognose {monthLabel}
        </p>

        {hasPlan ? (
          <>
            <p className="mt-1 text-[12px] text-zinc-400">Bleibt am Monatsende übrig</p>
            <p
              className={
                'mt-1 text-[32px] font-semibold leading-none tracking-[-0.8px] tabular-nums ' +
                (forecast.leftover >= 0 ? 'text-emerald-600' : 'text-red-500')
              }
            >
              {forecast.leftover >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(forecast.leftover))}
            </p>

            <div className="mt-4 border-t border-black/[0.06] pt-2">
              {line('Erwartete Einnahmen', formatMoney(forecast.expectedIncome), 'text-emerald-600')}
              {line('Fixkosten', '− ' + formatMoney(forecast.fixedMonthly))}
              {line('Variable Schätzung', '− ' + formatMoney(forecast.variableEstimate))}
            </div>

            {forecast.variableSuggestion !== null && (
              <p className="mt-3 rounded-2xl bg-zinc-50 px-4 py-3 text-[12px] leading-snug text-zinc-500">
                Deine tatsächlichen Ausgaben lagen zuletzt im Schnitt bei{' '}
                <span className="font-semibold text-zinc-700">
                  {formatMoney(forecast.variableSuggestion)}
                </span>{' '}
                pro Monat.
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-[13px] leading-snug text-zinc-500">
            Noch keine Planung hinterlegt. Trage unter „Planung" deine Einnahmen und Fixkosten
            ein — dann rechnet dir die Prognose aus, was am Monatsende übrig bleibt.
          </p>
        )}
      </section>

      {/* ── Budget-Warnungen ──────────────────────────────────────────────── */}
      {budgetAlerts.length > 0 && (
        <section className="rounded-3xl bg-white p-5 shadow-soft">
          <p className="text-[12px] font-medium uppercase tracking-wide text-zinc-400">
            Budgets im Blick
          </p>
          <ul className="mt-2 space-y-2">
            {budgetAlerts.map((b) => {
              const over = b.level === 'over'
              return (
                <li key={b.id}>
                  <div className="flex items-baseline justify-between">
                    <span className="truncate text-[14px] font-medium text-zinc-900">{b.name}</span>
                    <span
                      className={
                        'shrink-0 text-[13px] tabular-nums ' +
                        (over ? 'text-red-500' : 'text-amber-600')
                      }
                    >
                      {formatMoney(b.used)} / {formatMoney(b.budget)}
                    </span>
                  </div>
                  <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <span
                      className={'block h-full rounded-full ' + (over ? 'bg-red-500' : 'bg-amber-500')}
                      style={{ width: `${Math.min(100, b.ratio * 100)}%` }}
                    />
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ── Ist-Stand ─────────────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <p className="text-[12px] font-medium uppercase tracking-wide text-zinc-400">
          Tatsächlich diesen Monat
        </p>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[12px] text-zinc-400">Einnahmen</p>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-emerald-600">
              {formatMoney(actual.income)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-zinc-400">Ausgaben</p>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-zinc-900">
              {formatMoney(actual.expense)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-zinc-400">Saldo</p>
            <p
              className={
                'mt-0.5 text-[17px] font-semibold tabular-nums ' +
                (actual.saldo >= 0 ? 'text-emerald-600' : 'text-red-500')
              }
            >
              {actual.saldo >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(actual.saldo))}
            </p>
          </div>
        </div>

        {/* Sparen steht bewusst etwas abseits: es ist keine vierte Zahl derselben
            Art, sondern die Folge aus den dreien darüber. */}
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-zinc-50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-zinc-400">
              {actual.saved >= 0 ? 'Gespart' : 'Entspart'}
            </p>
            <p
              className={
                'mt-0.5 text-[17px] font-semibold tabular-nums ' +
                (actual.saved >= 0 ? 'text-zinc-900' : 'text-red-500')
              }
            >
              {formatMoney(Math.abs(actual.saved))}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[12px] text-zinc-400">Sparquote</p>
            <p
              className={
                'mt-0.5 text-[17px] font-semibold tabular-nums ' +
                (actual.savingsRate >= 0 ? 'text-zinc-900' : 'text-red-500')
              }
            >
              {actual.income > 0
                ? `${(actual.savingsRate * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
                : '–'}
            </p>
          </div>
        </div>
        <p className="mt-1.5 px-1 text-[11px] leading-snug text-zinc-400">
          {actual.savedDeliberate > 0
            ? `Übriggebliebenes plus ${formatMoney(actual.savedDeliberate)}, die gezielt angelegt wurden.`
            : 'Was am Monatsende übrig blieb. Markierst du eine Kategorie im Editor als „Sparen", zählt sie hier mit statt als Ausgabe.'}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <MoneyFlyIcon size={16} className="text-zinc-400" />
            <div className="text-[13px] text-zinc-500">
              {accounts.length === 1 ? 'Konto' : 'Konten'}
            </div>
          </div>
          <div className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.5px] text-zinc-900">
            {accounts.length}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <div className="text-[13px] text-zinc-500">Umsätze</div>
          <div className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.5px] text-zinc-900">
            {transactions.length}
          </div>
        </div>
      </section>
    </div>
  )
}
