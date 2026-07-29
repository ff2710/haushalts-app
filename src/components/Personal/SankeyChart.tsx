import { useEffect, useMemo, useRef, useState } from 'react'
import { layoutSankey } from '../../lib/sankeyLayout'
import { formatMoney } from '../../lib/utils'
import type { Cashflow, FlowNode } from '../../lib/cashflow'

interface Props {
  flow: Cashflow
  /**
   * Bezugswerte der Prozentansicht, getrennt nach Seite.
   *
   * Ein Ausgabenposten wird an den Ausgaben gemessen, ein Einnahmeposten an
   * den Einnahmen. Beides gegen einen gemeinsamen Nenner zu rechnen klingt
   * einheitlicher, waere aber falsch: der Donut darunter zeigt Anteile an den
   * Ausgaben, und dieselbe Kategorie stuende dann mit zwei verschiedenen
   * Prozentzahlen auf einem Bildschirm.
   */
  totals: { income: number; expense: number }
  mode: 'eur' | 'pct'
  /** Wird beim Antippen eines Knotens gerufen. */
  onSelect: (node: FlowNode) => void
}

/** Knoten unter dieser Hoehe bekommen keine Beschriftung — sie waeren nicht
 *  lesbar und wuerden die Nachbarn zudecken. In der Kategorieliste unter dem
 *  Donut steht ohnehin jeder Posten mit Betrag. */
const LABEL_MIN_HEIGHT = 9

const NODE_WIDTH = 9
const NODE_PADDING = 9

export default function SankeyChart({ flow, totals, mode, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [focus, setFocus] = useState<string | null>(null)

  // Die Breite kommt aus dem Layout, nicht aus Annahmen — die Ansicht steckt
  // mal in einem Telefon, mal in einer breiten Karte.
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Hoehe waechst mit der Zahl der Knoten in der vollsten Spalte, damit auch
  // bei vielen Kategorien noch Luft zwischen den Baendern bleibt.
  const height = useMemo(() => {
    const perColumn = new Map<number, number>()
    for (const n of flow.nodes) perColumn.set(n.depth, (perColumn.get(n.depth) ?? 0) + 1)
    const max = Math.max(1, ...perColumn.values())
    return Math.min(680, Math.max(260, max * 42))
  }, [flow])

  const layout = useMemo(
    () =>
      layoutSankey(flow, {
        width,
        height,
        nodeWidth: NODE_WIDTH,
        nodePadding: NODE_PADDING,
      }),
    [flow, width, height],
  )

  // Hervorheben: der angetippte Knoten, seine Kanten und die Knoten daran.
  const highlighted = useMemo(() => {
    if (!focus) return null
    const nodes = new Set<string>([focus])
    const links = new Set<string>()
    for (const l of flow.links) {
      if (l.source === focus || l.target === focus) {
        links.add(l.source + '>' + l.target)
        nodes.add(l.source)
        nodes.add(l.target)
      }
    }
    return { nodes, links }
  }, [focus, flow])

  // "Uebrig geblieben" ist kein Ausgabenposten, sondern der Teil der Einnahmen,
  // der liegen blieb — und wird deshalb an den Einnahmen gemessen.
  const referenceFor = (n: FlowNode) =>
    n.kind === 'income' || n.id === 'surplus' ? totals.income : totals.expense

  const label = (n: FlowNode) => {
    if (mode === 'eur') return formatMoney(n.value)
    const ref = referenceFor(n)
    if (ref <= 0) return '–'
    return `${((n.value / ref) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
  }

  const dim = (on: boolean) => (highlighted && !on ? 0.16 : 1)

  return (
    <div ref={wrap} className="w-full">
      {width > 0 && layout.nodes.length > 0 && (
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block touch-manipulation"
          onPointerLeave={() => setFocus(null)}
        >
          <g>
            {layout.links.map((l) => {
              const on = highlighted?.links.has(l.source + '>' + l.target) ?? true
              // Ein Band traegt die Farbe des Ziels — der Strom faechert sich ja
              // dorthin auf. Nur was ins Budget hineinfliesst, behaelt die Farbe
              // seiner Quelle; das Budget selbst ist bewusst neutral, und
              // graue Baender dorthin wuerden die Einnahmen unkenntlich machen.
              const target = layout.nodes.find((n) => n.id === l.target)
              const source = layout.nodes.find((n) => n.id === l.source)
              const tint = target?.kind === 'budget' ? source : target
              return (
                <path
                  key={l.source + '>' + l.target}
                  d={l.path}
                  fill={tint?.color ?? '#94a3b8'}
                  fillOpacity={0.38 * dim(on)}
                  className="transition-opacity duration-150"
                />
              )
            })}
          </g>

          <g>
            {layout.nodes.map((n) => {
              const on = highlighted?.nodes.has(n.id) ?? true
              return (
                <rect
                  key={n.id}
                  x={n.x0}
                  y={n.y0}
                  width={n.x1 - n.x0}
                  height={n.y1 - n.y0}
                  rx={2}
                  fill={n.color}
                  opacity={dim(on)}
                  className="cursor-pointer transition-opacity duration-150"
                  onPointerEnter={() => setFocus(n.id)}
                  onClick={() => onSelect(n)}
                />
              )
            })}
          </g>

          {/* Beschriftungen zuletzt, damit sie ueber den Baendern liegen. Der
              weisse Umriss (paint-order) ersetzt eine Hinterlegung — der wuerde
              man sonst die Textbreite ausrechnen muessen. */}
          <g>
            {layout.nodes.map((n) => {
              // Der Budget-Knoten bleibt unbeschriftet: er steht mitten im Bild,
              // wo sein Etikett zwangslaeufig auf den Kategorienamen liegt — und
              // seine Zahl steht ohnehin als "Einnahmen" in der Kopfzeile.
              if (n.kind === 'budget') return null
              if (n.y1 - n.y0 < LABEL_MIN_HEIGHT) return null
              const on = highlighted?.nodes.has(n.id) ?? true
              // Jedes Etikett steht unmittelbar VOR seinem Knoten, also auf der
              // Seite, aus der das Geld kommt. Nur die erste Spalte hat davor
              // nichts, deren Etikett steht rechts im eigenen Band. Andernfalls
              // saessen die Etiketten einer Spalte in der Luecke, in der schon
              // die der naechsten stehen — bei vier Ebenen ueberlagern sie sich
              // sonst gegenseitig.
              const first = n.column === 0
              const x = first ? n.x1 + 6 : n.x0 - 6
              const y = (n.y0 + n.y1) / 2
              return (
                <text
                  key={n.id}
                  x={x}
                  y={y}
                  textAnchor={first ? 'start' : 'end'}
                  dominantBaseline="central"
                  fontSize={11}
                  className="pointer-events-none select-none fill-zinc-700 transition-opacity duration-150"
                  opacity={dim(on)}
                  stroke="#ffffff"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {n.name}
                  <tspan className="fill-zinc-400"> {label(n)}</tspan>
                </text>
              )
            })}
          </g>
        </svg>
      )}
    </div>
  )
}
