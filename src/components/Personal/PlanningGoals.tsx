import { useMemo } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import { formatMoney, todayISO } from '../../lib/utils'
import { indexToMonth, monthIndex } from '../../lib/forecast'
import {
  BUCKET_LABEL,
  DEFAULT_TARGETS,
  bucketStatuses,
  bucketTotals,
  type Bucket,
} from '../../lib/buckets'
import * as personalService from '../../services/personalService'
import { useEffect, useState } from 'react'
import { Bar, Hint, SectionHead, card } from './planningShared'
import { SkeletonBlock } from '../ui/Skeleton'
import type { PfTransaction } from '../../types'

// 50/30/20: wohin das Einkommen geht, gemessen an den drei Toepfen.
//
// Bewusst als Verlauf ueber mehrere Monate statt als Momentaufnahme. Ein
// einzelner Monat sagt wenig — teuer war er, oder ist das die Regel? Die
// Antwort steht erst in der Reihe. Genau das unterscheidet diese Ansicht von
// der Analyse: dort ein Monat centgenau, hier die Richtung ueber ein halbes
// Jahr.

const MONTHS_BACK = 6

const BUCKET_STYLE: Record<Bucket, { bar: string; dot: string }> = {
  fix:      { bar: 'bg-violet-500', dot: 'bg-violet-500' },
  freizeit: { bar: 'bg-pink-500',   dot: 'bg-pink-500' },
  sparen:   { bar: 'bg-teal-500',   dot: 'bg-teal-500' },
}

export default function PlanningGoals() {
  const { categories } = usePersonal()
  const [rows, setRows] = useState<PfTransaction[]>([])
  const [busy, setBusy] = useState(true)

  const months = useMemo(() => {
    const now = monthIndex(todayISO().slice(0, 7))
    return Array.from({ length: MONTHS_BACK }, (_, i) => indexToMonth(now - (MONTHS_BACK - 1 - i)))
  }, [])

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    const start = `${months[0]}-01`
    const [y, m] = months[months.length - 1].split('-').map(Number)
    const endExclusive = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    void personalService.fetchTransactionsBetween(start, endExclusive).then(({ data, error }) => {
      if (cancelled) return
      if (!error) setRows((data ?? []) as PfTransaction[])
      setBusy(false)
    })
    return () => {
      cancelled = true
    }
  }, [months])

  /** Je Monat die drei Topfsummen — aus derselben Quelle wie die Kaskade. */
  const series = useMemo(
    () =>
      months.map((month) => {
        const inMonth = rows.filter((t) => t.date.startsWith(month))
        const totals = bucketTotals(inMonth, categories)
        return { month, totals, statuses: bucketStatuses(totals) }
      }),
    [months, rows, categories],
  )

  const current = series[series.length - 1]
  const assigned = categories.filter((c) => !c.parent_id && c.planning_bucket).length
  const unassignedCats = categories.filter(
    (c) => !c.parent_id && c.type === 'expense' && !c.planning_bucket,
  )

  if (busy) {
    return (
      <div className="space-y-3">
        <SkeletonBlock className="h-44 w-full rounded-2xl" />
        <SkeletonBlock className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  if (assigned === 0) {
    return (
      <section>
        <SectionHead title="50 / 30 / 20" />
        <div className={card}>
          <p className="px-4 py-5 text-[13px] leading-snug text-zinc-500">
            Noch keine Kategorie einem Topf zugeordnet. Öffne unter „Kategorien" eine
            Hauptkategorie und wähle dort ihren Planungs-Topf — Fixkosten, Freizeit oder
            Sparen. Danach steht hier, wie dein Einkommen sich tatsächlich aufteilt.
          </p>
        </div>
      </section>
    )
  }

  const noIncome = current.totals.income <= 0

  return (
    <div className="space-y-6">
      <section>
        <SectionHead title={`Diesen Monat — Ziel 50 / 30 / 20`} />
        <div className={`${card} p-4`}>
          {noIncome ? (
            <p className="text-[13px] leading-snug text-zinc-500">
              Für diesen Monat sind noch keine Einnahmen erfasst. Die Anteile beziehen sich
              auf das Einkommen — ohne das gibt es nichts zu teilen.
            </p>
          ) : (
            <ul className="space-y-4">
              {current.statuses.map((s) => {
                const over = s.deltaAmount > 0
                return (
                  <li key={s.bucket}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-2 text-[14px] font-medium text-zinc-900">
                        <span
                          className={'h-2.5 w-2.5 shrink-0 rounded-full ' + BUCKET_STYLE[s.bucket].dot}
                        />
                        {BUCKET_LABEL[s.bucket]}
                      </span>
                      <span className="shrink-0 text-[14px] tabular-nums text-zinc-900">
                        {s.share.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %
                        <span className="text-zinc-400"> von {s.target} %</span>
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Bar ratio={s.target > 0 ? s.share / s.target : 0} className={BUCKET_STYLE[s.bucket].bar} />
                    </div>
                    <p className="mt-1 text-[12px] text-zinc-400">
                      {formatMoney(s.amount)} von {formatMoney(s.targetAmount)} ·{' '}
                      <span className={over ? 'text-red-500' : 'text-emerald-600'}>
                        {over ? `${formatMoney(s.deltaAmount)} drüber` : `${formatMoney(-s.deltaAmount)} Luft`}
                      </span>
                    </p>
                  </li>
                )
              })}
            </ul>
          )}

          {current.totals.unassigned > 0 && (
            <p className="mt-4 rounded-xl bg-zinc-50 px-3 py-2.5 text-[12px] leading-snug text-zinc-500">
              {formatMoney(current.totals.unassigned)} liegen in Kategorien ohne Topf und
              fehlen deshalb oben. Betroffen:{' '}
              {unassignedCats.map((c) => c.name).join(', ') || 'ohne Kategorie gebuchte Ausgaben'}.
            </p>
          )}
        </div>
      </section>

      {/* ── Verlauf ─────────────────────────────────────────────────────────
          Der eigentliche Punkt dieser Ansicht: ob es besser wird. */}
      <section>
        <SectionHead title={`Verlauf über ${MONTHS_BACK} Monate`} />
        <div className={`${card} p-4`}>
          <ul className="space-y-3">
            {series.map(({ month, totals, statuses }) => {
              const label = new Date(`${month}-01T00:00:00`).toLocaleDateString('de-DE', {
                month: 'short',
                year: '2-digit',
              })
              return (
                <li key={month} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-[12px] tabular-nums text-zinc-400">{label}</span>
                  {totals.income <= 0 ? (
                    <span className="flex-1 text-[12px] text-zinc-300">keine Einnahmen</span>
                  ) : (
                    <>
                      <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        {statuses.map((s) => (
                          <span
                            key={s.bucket}
                            className={BUCKET_STYLE[s.bucket].bar}
                            style={{ width: `${Math.min(100, s.share)}%` }}
                            title={`${BUCKET_LABEL[s.bucket]} ${s.share} %`}
                          />
                        ))}
                      </span>
                      <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-zinc-400">
                        {statuses.map((s) => Math.round(s.share)).join(' / ')}
                      </span>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 border-t border-zinc-100 pt-3">
            {(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) => (
              <span key={b} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span className={'h-2 w-2 rounded-full ' + BUCKET_STYLE[b].dot} />
                {BUCKET_LABEL[b]} {DEFAULT_TARGETS[b]} %
              </span>
            ))}
          </div>
        </div>
      </section>

      <Hint>
        Die Anteile messen am Einkommen des jeweiligen Monats, nicht an den Ausgaben — sonst
        ergäben sie immer 100 Prozent und die Aussage wäre weg. Schuldentilgung zählt zum
        Sparen: ein getilgter Euro erhöht dein Vermögen wie ein gesparter.
      </Hint>
    </div>
  )
}
