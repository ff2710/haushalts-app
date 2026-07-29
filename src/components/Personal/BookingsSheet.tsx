import BottomSheet from '../ui/BottomSheet'
import { formatDate, formatMoney } from '../../lib/utils'
import type { PfTransaction } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  color: string
  /** Zeitraum, aus dem die Buchungen stammen — sonst weiss man nicht, worauf
   *  sich die Summe bezieht. */
  periodLabel: string
  transactions: PfTransaction[]
}

/**
 * Die Buchungen hinter einem Knoten im Diagramm. In der Referenz ist das ein
 * Seitenpanel; auf dem Telefon ist das BottomSheet der richtige Ort, und das
 * gibt es hier schon.
 */
export default function BookingsSheet({
  open,
  onClose,
  title,
  color,
  periodLabel,
  transactions,
}: Props) {
  const sum = transactions.reduce(
    (s, t) => s + (t.type === 'expense' ? Number(t.amount) : -Number(t.amount)),
    0,
  )

  // Nach Datum gruppieren, neueste zuerst — wie in der Referenz.
  const groups: { date: string; rows: PfTransaction[] }[] = []
  for (const t of transactions) {
    const last = groups[groups.length - 1]
    if (last && last.date === t.date) last.rows.push(t)
    else groups.push({ date: t.date, rows: [t] })
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-5 pt-2">
        <div className="flex items-center gap-2.5">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: color }}
          />
          <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
            {title}
          </h2>
        </div>
        <p className="mt-1 text-[13px] text-zinc-500">
          {transactions.length === 1 ? '1 Buchung' : `${transactions.length} Buchungen`} ·{' '}
          {periodLabel}
        </p>
        <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.6px] tabular-nums text-zinc-900">
          {sum < 0 ? '+' : ''}
          {formatMoney(Math.abs(sum))}
        </p>

        <div className="mt-4">
          {groups.length === 0 && (
            <p className="py-6 text-center text-[14px] text-zinc-400">
              Keine Buchungen in diesem Zeitraum.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.date}>
              <p className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400">
                {formatDate(g.date)}
              </p>
              {g.rows.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 border-t border-zinc-100 py-2.5"
                >
                  <span className="min-w-0 truncate text-[14px] text-zinc-800">
                    {t.description || 'Ohne Beschreibung'}
                  </span>
                  <span
                    className={
                      'shrink-0 text-[14px] font-medium tabular-nums ' +
                      (t.type === 'income' ? 'text-emerald-600' : 'text-zinc-900')
                    }
                  >
                    {t.type === 'income' ? '+' : '−'}
                    {formatMoney(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}
