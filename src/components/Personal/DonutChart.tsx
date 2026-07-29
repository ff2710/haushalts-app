import { ChevronRightIcon } from '../ui/Icon'
import { formatMoney } from '../../lib/utils'

export interface DonutSlice {
  id: string
  name: string
  value: number
  color: string
  /** Anzahl Buchungen dahinter. */
  count: number
  /** Unterkategorie -> in der Liste eingerueckt. */
  indented?: boolean
}

interface Props {
  slices: DonutSlice[]
  total: number
  mode: 'eur' | 'pct'
  centerLabel: string
  onSelect: (slice: DonutSlice) => void
}

const SIZE = 168
const THICKNESS = 26
const R = (SIZE - THICKNESS) / 2
const CIRCUMFERENCE = 2 * Math.PI * R
/** Winziger Versatz, damit benachbarte Segmente sichtbar getrennt sind. */
const GAP = 1.5

/**
 * Ring als gestrichelter Kreis statt als Bogen-Pfade: ein Segment ist damit
 * ein Strichmuster auf einem Kreis. Das spart nicht nur Pfad-Arithmetik,
 * sondern hat auch den Kantenfall "ein einziges Segment ueber 100 %" gratis —
 * als Bogen waere der entartet (Anfang gleich Ende) und wuerde verschwinden.
 */
export default function DonutChart({ slices, total, mode, centerLabel, onSelect }: Props) {
  const value = (v: number) =>
    mode === 'pct'
      ? total > 0
        ? `${((v / total) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
        : '–'
      : formatMoney(v)

  let offset = 0
  const segments = slices
    .filter((s) => s.value > 0 && total > 0)
    .map((s) => {
      const len = (s.value / total) * CIRCUMFERENCE
      const seg = { ...s, len, offset }
      offset += len
      return seg
    })

  return (
    <div className="sm:flex sm:items-center sm:gap-6">
      <div className="flex shrink-0 justify-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="block">
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              strokeWidth={THICKNESS}
              className="stroke-zinc-100"
            />
            {segments.map((s) => (
              <circle
                key={s.id}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={THICKNESS}
                strokeDasharray={`${Math.max(0, s.len - GAP)} ${CIRCUMFERENCE}`}
                strokeDashoffset={-s.offset}
              />
            ))}
          </g>
          <text
            x={SIZE / 2}
            y={SIZE / 2 - 6}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={17}
            fontWeight={600}
            className="fill-zinc-900"
          >
            {formatMoney(total)}
          </text>
          <text
            x={SIZE / 2}
            y={SIZE / 2 + 14}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            className="fill-zinc-400"
          >
            {centerLabel}
          </text>
        </svg>
      </div>

      <ul className="mt-4 min-w-0 flex-1 sm:mt-0">
        {slices.length === 0 && (
          <li className="py-3 text-[14px] text-zinc-400">Keine Buchungen in diesem Zeitraum</li>
        )}
        {slices.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s)}
              className="flex w-full items-center gap-2.5 py-[9px] text-left transition-colors duration-100 active:bg-zinc-50"
              style={s.indented ? { paddingLeft: 22 } : undefined}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: s.color }}
              />
              <span
                className={
                  'min-w-0 flex-1 truncate ' +
                  (s.indented ? 'text-[13px] text-zinc-600' : 'text-[14px] text-zinc-900')
                }
              >
                {s.name}
                <span className="text-zinc-400"> ({s.count})</span>
              </span>
              <span className="shrink-0 text-[14px] font-medium tabular-nums text-zinc-900">
                {value(s.value)}
              </span>
              <ChevronRightIcon size={13} strokeWidth={2.5} className="shrink-0 text-zinc-300" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
