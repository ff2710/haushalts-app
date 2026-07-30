import { formatMoney } from '../../lib/utils'
import type { Cashflow } from '../../lib/cashflow'

// Die fuenf Kennzahlen eines Zeitraums. Steht an einer Stelle, weil Uebersicht
// und Analyse sie beide zeigen — zwei Fassungen derselben Zahlen wuerden
// irgendwann auseinanderlaufen, und dann glaubt man der App keine mehr.
//
// Gespart und Sparquote stehen bewusst abgesetzt auf eigener Flaeche: sie sind
// keine vierte Zahl derselben Art, sondern die Folge aus den dreien darueber.

interface Props {
  flow: Cashflow
  /** Erklaersatz unter dem Sparen-Kasten. In der Analyse waere er bei jedem
   *  Zeitraumwechsel im Weg, dort bleibt er weg. */
  hint?: boolean
}

export default function MoneySummary({ flow, hint = false }: Props) {
  const percent =
    flow.income > 0
      ? `${(flow.savingsRate * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
      : '–'

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[12px] text-zinc-400">Einnahmen</p>
          <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-emerald-600">
            {formatMoney(flow.income)}
          </p>
        </div>
        <div>
          <p className="text-[12px] text-zinc-400">Ausgaben</p>
          <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-zinc-900">
            {formatMoney(flow.expense)}
          </p>
        </div>
        <div>
          <p className="text-[12px] text-zinc-400">Saldo</p>
          <p
            className={
              'mt-0.5 text-[17px] font-semibold tabular-nums ' +
              (flow.saldo >= 0 ? 'text-emerald-600' : 'text-red-500')
            }
          >
            {flow.saldo >= 0 ? '+' : '−'}
            {formatMoney(Math.abs(flow.saldo))}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 rounded-2xl bg-zinc-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-zinc-400">{flow.saved >= 0 ? 'Gespart' : 'Entspart'}</p>
          <p
            className={
              'mt-0.5 text-[17px] font-semibold tabular-nums ' +
              (flow.saved >= 0 ? 'text-zinc-900' : 'text-red-500')
            }
          >
            {formatMoney(Math.abs(flow.saved))}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px] text-zinc-400">Sparquote</p>
          <p
            className={
              'mt-0.5 text-[17px] font-semibold tabular-nums ' +
              (flow.savingsRate >= 0 ? 'text-zinc-900' : 'text-red-500')
            }
          >
            {percent}
          </p>
        </div>
      </div>

      {hint && (
        <p className="mt-1.5 px-1 text-[11px] leading-snug text-zinc-400">
          {flow.savedDeliberate > 0
            ? `Übriggebliebenes plus ${formatMoney(flow.savedDeliberate)}, die gezielt angelegt wurden.`
            : 'Was am Monatsende übrig blieb. Markierst du eine Kategorie im Editor als „Sparen", zählt sie hier mit statt als Ausgabe.'}
        </p>
      )}
    </>
  )
}
