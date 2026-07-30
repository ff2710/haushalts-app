import { useEffect, useMemo, useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import * as personalService from '../../services/personalService'
import { SkeletonBlock } from '../ui/Skeleton'
import { ChevronRightIcon } from '../ui/Icon'
import { formatMoney, todayISO } from '../../lib/utils'
import {
  isCurrent,
  periodOf,
  shiftPeriod,
  shortLabel,
  trailingPeriods,
  withKind,
  type Period,
  type PeriodKind,
} from '../../lib/period'
import {
  SURPLUS_ID,
  bookingsForNode,
  buildCashflow,
  type Cashflow,
  type FlowNode,
} from '../../lib/cashflow'
import SankeyChart from './SankeyChart'
import DonutChart, { type DonutSlice } from './DonutChart'
import BookingsSheet from './BookingsSheet'
import MoneySummary from './MoneySummary'
import type { PfTransaction } from '../../types'

// Analyse-Ansicht: wo ist das Geld hingeflossen. Bewusst nur Ist-Daten —
// die Planung (Ziele, Toepfe) ist eine eigene Ansicht mit anderer Zeitachse
// und anderer Genauigkeit.

const KIND_LABEL: Record<PeriodKind, string> = {
  month: 'Monat',
  quarter: 'Quartal',
  year: 'Jahr',
}

/** Wie weit der Verlaufsbalken zurueckschaut, je Koernung. */
const TRAIL: Record<PeriodKind, number> = { month: 12, quarter: 8, year: 5 }

function useIsWide(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const onChange = () => setWide(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}

const card = 'rounded-3xl bg-white p-5 shadow-soft'
const sLabel = 'text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400'

export default function Analysis() {
  const { categories, loading: catsLoading } = usePersonal()
  const isWide = useIsWide()

  const [kind, setKind]     = useState<PeriodKind>('month')
  const [period, setPeriod] = useState<Period>(() => periodOf('month', todayISO()))
  const [mode, setMode]     = useState<'eur' | 'pct'>('eur')
  const [side, setSide]     = useState<'expense' | 'income' | 'sub'>('expense')
  const [drill, setDrill]   = useState<string | null>(null)
  const [picked, setPicked] = useState<FlowNode | null>(null)

  const [rows, setRows]   = useState<PfTransaction[]>([])
  const [busy, setBusy]   = useState(true)

  const trail = useMemo(() => trailingPeriods(period, TRAIL[kind]), [period, kind])

  // Ein Ladevorgang fuer alles: der Zeitraum selbst und der Verlauf davor
  // liegen ohnehin nebeneinander, zwei Abfragen waeren nur mehr Wartezeit.
  useEffect(() => {
    let cancelled = false
    setBusy(true)
    void personalService
      .fetchTransactionsBetween(trail[0].start, period.endExclusive)
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error) setRows((data ?? []) as PfTransaction[])
        setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [trail, period.endExclusive])

  // Zeitraumwechsel verlaesst den Hineinzoom — sonst stuende man in einer
  // Kategorie, die es im neuen Zeitraum vielleicht gar nicht gibt.
  useEffect(() => setDrill(null), [period.start, period.kind])

  const periodRows = useMemo(
    () => rows.filter((t) => t.date >= period.start && t.date < period.endExclusive),
    [rows, period],
  )

  const flow = useMemo(() => buildCashflow(periodRows, categories), [periodRows, categories])

  const history = useMemo(
    () =>
      trail.map((p) => {
        let income = 0
        let expense = 0
        for (const t of rows) {
          if (t.date < p.start || t.date >= p.endExclusive) continue
          if (t.type === 'income') income += Number(t.amount)
          else expense += Number(t.amount)
        }
        return { period: p, income, expense }
      }),
    [trail, rows],
  )
  const historyMax = Math.max(1, ...history.map((h) => Math.max(h.income, h.expense)))

  const hasChildren = (nodeId: string) => flow.links.some((l) => l.source === nodeId)

  /** Was im Diagramm tatsaechlich gezeichnet wird. */
  const visible: Cashflow = useMemo(() => {
    if (drill) {
      const rootId = `cat:${drill}`
      const childIds = new Set(
        flow.links.filter((l) => l.source === rootId).map((l) => l.target),
      )
      return {
        ...flow,
        nodes: flow.nodes.filter((n) => n.id === rootId || childIds.has(n.id)),
        links: flow.links.filter((l) => l.source === rootId),
      }
    }
    // Schmaler Screen: die Unterkategorie-Ebene bliebe unlesbar gequetscht.
    // Sie ist per Antippen einer Hauptkategorie erreichbar.
    const maxDepth = isWide ? 3 : 2
    const keep = new Set(flow.nodes.filter((n) => n.depth <= maxDepth).map((n) => n.id))
    return {
      ...flow,
      nodes: flow.nodes.filter((n) => keep.has(n.id)),
      links: flow.links.filter((l) => keep.has(l.source) && keep.has(l.target)),
    }
  }, [flow, drill, isWide])

  // Die Zuordnung "welche Buchung steckt in diesem Knoten" liegt bewusst in
  // lib/cashflow.ts direkt neben dem Summieren — zweimal formuliert koennten
  // die beiden auseinanderlaufen, und dann zeigte das Buchungsblatt andere
  // Zahlen als die Kante, aus der es geoeffnet wurde.
  const bookingsFor = (node: FlowNode) => bookingsForNode(node, periodRows, categories)

  const onSelect = (node: FlowNode) => {
    // Auf schmalen Screens fuehrt das Antippen einer Hauptkategorie mit
    // Unterkategorien hinein statt zur Buchungsliste — die erreicht man dort
    // ueber den Elternknoten. So ist die Geste nie mehrdeutig.
    if (!drill && !isWide && node.kind === 'category' && hasChildren(node.id)) {
      setDrill(node.categoryId)
      return
    }
    setPicked(node)
  }

  const slices: DonutSlice[] = useMemo(() => {
    const pick =
      side === 'income'
        ? flow.nodes.filter((n) => n.depth === 0)
        : side === 'sub'
          ? flow.nodes.filter((n) => n.depth === 3)
          : flow.nodes.filter((n) => n.depth === 2 && n.id !== SURPLUS_ID)
    return pick.map((n) => ({
      id: n.id,
      name: n.name,
      value: n.value,
      color: n.color,
      count: bookingsFor(n).length,
      indented: side === 'sub',
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, side, periodRows, categories])

  const sliceSum = slices.reduce((s, x) => s + x.value, 0)
  // Bezugswert des Donuts ist die Summe der Seite, nicht die der gezeigten
  // Segmente — sonst naennte er fuer eine Unterkategorie eine andere
  // Prozentzahl als der Sankey direkt darueber.
  const donutTotal = side === 'income' ? flow.income : flow.expense

  const drillNode = drill ? flow.nodes.find((n) => n.id === `cat:${drill}`) : null

  if (catsLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <SkeletonBlock className="h-28 w-full rounded-3xl" />
        <SkeletonBlock className="h-80 w-full rounded-3xl" />
      </div>
    )
  }

  const kindButton = (k: PeriodKind) => (
    <button
      key={k}
      onClick={() => {
        setKind(k)
        setPeriod((p) => withKind(p, k))
      }}
      className={
        'rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors duration-150 ' +
        (kind === k ? 'bg-white text-zinc-900 shadow-soft' : 'text-zinc-500')
      }
    >
      {KIND_LABEL[k]}
    </button>
  )

  const modeToggle = (
    <div className="flex gap-0.5 rounded-lg bg-black/[0.05] p-0.5" data-no-swipe>
      {(['eur', 'pct'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={
            'rounded-md px-2 py-0.5 text-[12px] font-medium transition-colors duration-150 ' +
            (mode === m ? 'bg-white text-zinc-900 shadow-soft' : 'text-zinc-500')
          }
        >
          {m === 'eur' ? '€' : '%'}
        </button>
      ))}
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {/* ── Zeitraum ──────────────────────────────────────────────────────── */}
      <section className={card}>
        <div className="flex items-center gap-2" data-no-swipe>
          <button
            onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
            aria-label="Vorheriger Zeitraum"
            className="flex h-8 w-8 shrink-0 rotate-180 items-center justify-center rounded-full text-zinc-500 active:bg-black/[0.06]"
          >
            <ChevronRightIcon size={17} />
          </button>
          <span className="min-w-0 flex-1 truncate text-center text-[16px] font-semibold tracking-[-0.3px] text-zinc-900">
            {period.label}
          </span>
          <button
            onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
            aria-label="Nächster Zeitraum"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 active:bg-black/[0.06]"
          >
            <ChevronRightIcon size={17} />
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2" data-no-swipe>
          <div className="flex gap-0.5 rounded-xl bg-black/[0.05] p-0.5">
            {(['month', 'quarter', 'year'] as PeriodKind[]).map(kindButton)}
          </div>
          {!isCurrent(period, todayISO()) && (
            <button
              onClick={() => setPeriod(periodOf(kind, todayISO()))}
              className="rounded-xl bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-600 active:bg-zinc-200"
            >
              Heute
            </button>
          )}
        </div>

        {/* Verlauf: gibt dem einzelnen Zeitraum einen Bezug. Antippen springt hin. */}
        <div className="mt-4 flex items-end gap-[3px]" data-no-swipe>
          {history.map((h) => {
            const active = h.period.start === period.start
            return (
              <button
                key={h.period.start}
                onClick={() => setPeriod(h.period)}
                className="group flex min-w-0 flex-1 flex-col items-center gap-1"
                aria-label={h.period.label}
              >
                <span className="flex h-14 w-full items-end justify-center gap-[2px]">
                  <span
                    className="w-1/3 rounded-t-[2px] bg-emerald-500"
                    style={{ height: `${Math.max(2, (h.income / historyMax) * 56)}px` }}
                  />
                  <span
                    className="w-1/3 rounded-t-[2px] bg-red-400"
                    style={{ height: `${Math.max(2, (h.expense / historyMax) * 56)}px` }}
                  />
                </span>
                <span
                  className={
                    'truncate text-[9px] leading-none ' +
                    (active ? 'font-semibold text-zinc-700' : 'text-zinc-400')
                  }
                >
                  {shortLabel(h.period)}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 border-t border-black/[0.06] pt-3">
          <MoneySummary flow={flow} />
        </div>
      </section>

      {/* ── Sankey ────────────────────────────────────────────────────────── */}
      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          {drillNode ? (
            <button
              onClick={() => setDrill(null)}
              className="flex min-w-0 items-center gap-1 text-[15px] font-semibold tracking-[-0.3px] text-zinc-900"
            >
              <ChevronRightIcon size={15} strokeWidth={2.5} className="rotate-180 text-zinc-400" />
              <span className="truncate">{drillNode.name}</span>
            </button>
          ) : (
            <p className={sLabel}>Geldfluss</p>
          )}
          {modeToggle}
        </div>

        {busy ? (
          <SkeletonBlock className="mt-3 h-64 w-full rounded-2xl" />
        ) : flow.nodes.length === 0 ? (
          <p className="mt-3 text-[13px] leading-snug text-zinc-500">
            Für {period.label} sind keine Umsätze erfasst. Trag welche unter „Umsätze" ein oder
            importiere eine CSV — dann zeigt sich hier, wohin das Geld geflossen ist.
          </p>
        ) : (
          <>
            <div className="mt-2">
              <SankeyChart
                flow={visible}
                totals={{ income: flow.income, expense: flow.expense }}
                mode={mode}
                onSelect={onSelect}
              />
            </div>
            {!isWide && !drill && flow.nodes.some((n) => n.depth === 3) && (
              <p className="mt-1 text-center text-[11px] text-zinc-400">
                Kategorie antippen zeigt ihre Unterkategorien
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Donut ─────────────────────────────────────────────────────────── */}
      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          <p className={sLabel}>Kategorien</p>
          {modeToggle}
        </div>
        <div className="mt-2 flex gap-0.5 rounded-xl bg-black/[0.05] p-0.5" data-no-swipe>
          {([
            ['expense', 'Ausgaben'],
            ['income', 'Einnahmen'],
            ['sub', 'Unterkategorien'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSide(id)}
              className={
                'flex-1 rounded-lg px-2 py-1 text-[12px] font-medium transition-colors duration-150 ' +
                (side === id ? 'bg-white text-zinc-900 shadow-soft' : 'text-zinc-500')
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <DonutChart
            slices={slices}
            total={donutTotal}
            centerValue={sliceSum}
            mode={mode}
            centerLabel={
              side === 'income' ? 'Einnahmen' : side === 'sub' ? 'Unterkategorien' : 'Ausgaben'
            }
            onSelect={(s) => {
              const node = flow.nodes.find((n) => n.id === s.id)
              if (node) setPicked(node)
            }}
          />
        </div>
      </section>

      {flow.uncategorizedExpense > 0 && (
        <p className="px-1 text-[12px] leading-snug text-zinc-400">
          {formatMoney(flow.uncategorizedExpense)} an Ausgaben haben noch keine Kategorie und
          stehen als „Ohne Kategorie" im Fluss.
        </p>
      )}

      <BookingsSheet
        open={picked !== null}
        onClose={() => setPicked(null)}
        title={picked?.name ?? ''}
        color={picked?.color ?? '#94a3b8'}
        periodLabel={period.label}
        transactions={picked ? bookingsFor(picked) : []}
      />
    </div>
  )
}
