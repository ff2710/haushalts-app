import { useMemo, useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import { formatMoney, todayISO } from '../../lib/utils'
import { indexToMonth, monthIndex } from '../../lib/forecast'
import { monthsToClear } from '../../lib/cascade'
import { ChevronRightIcon } from '../ui/Icon'
import { Bar, EmptyRow, Hint, SectionHead, card, rowCls, sep } from './planningShared'
import DebtSheet from './DebtSheet'
import type { PfDebt } from '../../types'

// Schuldentilgung als Fortschrittstracker, nicht als Cent-Zaehler. Die Frage,
// die hier beantwortet wird, ist "wann bin ich durch?" — und die beantwortet
// man mit einer Hochrechnung, nicht mit einem Kontostand.

const monthLabel = (offset: number): string => {
  const target = indexToMonth(monthIndex(todayISO().slice(0, 7)) + offset)
  return new Date(`${target}-01T00:00:00`).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  })
}

export default function PlanningDebts() {
  const { debts } = usePersonal()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PfDebt | null>(null)

  const show = (debt: PfDebt | null) => {
    setEditing(debt)
    setOpen(true)
  }

  const summary = useMemo(() => {
    const active = debts.filter((d) => d.active)
    const open = active.reduce(
      (s, d) => s + Math.max(0, Number(d.initial_amount) - Number(d.paid_amount)),
      0,
    )
    const paid = active.reduce((s, d) => s + Number(d.paid_amount), 0)
    const rate = active.reduce((s, d) => s + Number(d.monthly_rate ?? 0), 0)
    return { open, paid, rate, total: open + paid }
  }, [debts])

  const allClear = debts.length > 0 && summary.open <= 0

  return (
    <div className="space-y-6">
      <section>
        <SectionHead title="Schulden" add={{ label: 'Schuld hinzufügen', onClick: () => show(null) }} />
        <div className={card}>
          {debts.length === 0 ? (
            <EmptyRow>Keine Schulden eingetragen</EmptyRow>
          ) : (
            debts.map((d, D) => {
              const initial = Number(d.initial_amount)
              const paid = Number(d.paid_amount)
              const rest = Math.max(0, initial - paid)
              const rate = d.monthly_rate == null ? 0 : Number(d.monthly_rate)
              const months = monthsToClear(rest, rate)
              const done = rest <= 0
              return (
                <div key={d.id}>
                  {D > 0 && sep}
                  <button
                    onClick={() => show(d)}
                    className={`${rowCls} transition-colors duration-100 active:bg-zinc-50`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className={
                            'truncate text-[15px] font-medium ' +
                            (d.active ? 'text-zinc-900' : 'text-zinc-400')
                          }
                        >
                          {d.creditor}
                          {!d.active && ' · pausiert'}
                        </span>
                        <span
                          className={
                            'shrink-0 text-[15px] font-semibold tabular-nums ' +
                            (done ? 'text-emerald-600' : 'text-zinc-900')
                          }
                        >
                          {done ? 'getilgt' : formatMoney(rest)}
                        </span>
                      </span>

                      <span className="mt-1.5 block">
                        <Bar
                          ratio={initial > 0 ? paid / initial : 0}
                          className={done ? 'bg-emerald-500' : 'bg-brand-600'}
                        />
                      </span>

                      <span className="mt-1 block text-[12px] text-zinc-400">
                        {formatMoney(paid)} von {formatMoney(initial)} getilgt
                        {!done && rate > 0 && months !== null && (
                          <> · bei {formatMoney(rate)}/Monat fertig im {monthLabel(months)}</>
                        )}
                        {!done && rate <= 0 && ' · keine feste Rate'}
                      </span>

                      {d.note && (
                        <span className="mt-1 block truncate text-[12px] text-zinc-400">{d.note}</span>
                      )}
                    </span>
                    <ChevronRightIcon size={14} strokeWidth={2.5} className="shrink-0 text-zinc-300" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </section>

      {debts.length > 0 && (
        <section>
          <div className={`${card} p-4`}>
            {allClear ? (
              <p className="text-[15px] font-medium text-emerald-600">
                Alles getilgt — {formatMoney(summary.paid)} insgesamt zurückgezahlt.
              </p>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] text-zinc-500">Noch offen</span>
                  <span className="text-[17px] font-semibold tabular-nums text-zinc-900">
                    {formatMoney(summary.open)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar
                    ratio={summary.total > 0 ? summary.paid / summary.total : 0}
                    className="bg-brand-600"
                  />
                </div>
                <p className="mt-1.5 text-[12px] text-zinc-400">
                  {formatMoney(summary.paid)} von {formatMoney(summary.total)} geschafft
                  {summary.rate > 0 &&
                    monthsToClear(summary.open, summary.rate) !== null && (
                      <>
                        {' '}· bei {formatMoney(summary.rate)}/Monat schuldenfrei im{' '}
                        {monthLabel(monthsToClear(summary.open, summary.rate) as number)}
                      </>
                    )}
                </p>
              </>
            )}
          </div>
        </section>
      )}

      <Hint>
        Die Hochrechnung nimmt an, dass die Rate so bleibt — sie ist ein Ziel, keine Zusage.
        Getilgtes zählt in den Sparen-Topf der 50/30/20-Ansicht, wenn du die passende
        Kategorie so markiert hast: ein getilgter Euro erhöht dein Vermögen wie ein
        gesparter.
      </Hint>

      <DebtSheet open={open} onClose={() => setOpen(false)} debt={editing} />
    </div>
  )
}
