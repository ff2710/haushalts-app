// Layout des Sankey-Diagramms: aus Knoten und Kanten werden Rechtecke und
// Baender in SVG-Koordinaten.
//
// Bewusst selbst gerechnet statt mit d3-sankey — anders als im Bauplan
// vorgesehen. Grund: d3-sankey loest ein Problem, das dieser Fluss nicht hat.
// Seine Staerke ist die iterative Entzerrung ueberkreuzender Kanten in einem
// beliebigen Graphen. Unser Fluss ist ein Baum (jede Kategorie hat genau ein
// Elternteil), da kreuzt sich nichts, solange die Reihenfolge der Kinder der
// ihrer Eltern folgt — und genau das liefert buildCashflow bereits.
//
// Was bleibt, sind knapp hundert Zeilen Stapel-Arithmetik, die dafuer
// programmatisch pruefbar sind: dass die Baender einer Ebene ihren Elternknoten
// exakt ausfuellen, verlangt der Bauplan als Nachweis. Bei fremdem Layout-Code
// haette man das nur nachgemessen statt garantiert.

import type { Cashflow, FlowLink, FlowNode } from './cashflow'

export interface LayoutNode extends FlowNode {
  x0: number
  x1: number
  y0: number
  y1: number
  /** Spaltenindex im gezeichneten Diagramm (nicht identisch mit depth). */
  column: number
}

export interface LayoutLink extends FlowLink {
  /** Pfad des Bandes, fertig fuer <path d=...>. */
  path: string
  /** Mitte des Bandes an der Quelle — Ansatzpunkt fuer Beschriftungen. */
  midY: number
}

export interface SankeyLayout {
  nodes: LayoutNode[]
  links: LayoutLink[]
  /**
   * Tatsaechlich benoetigte Hoehe — und der Wert, mit dem gezeichnet werden
   * MUSS, nicht die vorgegebene.
   *
   * Sie kann die Vorgabe leicht ueberschreiten: Knoten unterhalb von
   * minNodeHeight werden angehoben, damit Winzigposten nicht verschwinden, und
   * diese Anhebung passt naturgemaess nicht mehr in den urspruenglichen
   * Massstab. Wer mit der Vorgabe zeichnet statt mit diesem Wert, schneidet
   * die letzten Knoten ab.
   */
  height: number
}

export interface SankeyOptions {
  width: number
  height: number
  /** Breite der Knotenbalken. */
  nodeWidth?: number
  /** Senkrechter Abstand zwischen Knoten derselben Spalte. */
  nodePadding?: number
  /** Mindesthoehe eines Knotens, damit Winzigposten nicht verschwinden. */
  minNodeHeight?: number
}

/**
 * Rechnet Knoten und Kanten in Koordinaten um.
 *
 * `flow` darf bereits gefiltert sein (etwa nur zwei Ebenen fuer die
 * Hineinzoom-Ansicht auf dem Telefon) — die Spalten ergeben sich aus den
 * tatsaechlich vorhandenen depth-Werten, nicht aus festen Annahmen.
 */
export function layoutSankey(flow: Cashflow, opts: SankeyOptions): SankeyLayout {
  const nodeWidth     = opts.nodeWidth     ?? 10
  const nodePadding   = opts.nodePadding   ?? 10
  const minNodeHeight = opts.minNodeHeight ?? 2

  const depths = [...new Set(flow.nodes.map((n) => n.depth))].sort((a, b) => a - b)
  if (depths.length === 0 || opts.width <= 0 || opts.height <= 0) {
    return { nodes: [], links: [], height: 0 }
  }

  const columnOf = new Map(depths.map((d, i) => [d, i]))
  const columns: FlowNode[][] = depths.map(() => [])
  for (const n of flow.nodes) columns[columnOf.get(n.depth) as number].push(n)

  // Der Abstand zwischen Knoten schrumpft mit, wenn eine Spalte sehr viele
  // Knoten hat. Ohne das koennten die Abstaende allein hoeher werden als das
  // Diagramm: die verbleibende Hoehe fuer die Knoten waere negativ, der
  // Massstab damit negativ, und der Leerfall-Guard weiter unten wuerde
  // faelschlich greifen — das Diagramm verschwaende kommentarlos, obwohl
  // Daten da sind. Deshalb bleibt mindestens die halbe Hoehe fuer Knoten.
  let padding = nodePadding
  for (const col of columns) {
    if (col.length < 2) continue
    padding = Math.min(padding, (opts.height * 0.5) / (col.length - 1))
  }

  // Ein gemeinsamer Massstab fuer alle Spalten — sonst waere ein Euro links
  // laenger als rechts und das Bild vergleicht Aepfel mit Birnen. Es gewinnt
  // die Spalte, die am wenigsten Platz uebrig hat.
  let scale = Infinity
  for (const col of columns) {
    const total = col.reduce((s, n) => s + n.value, 0)
    if (total <= 0) continue
    const free = opts.height - (col.length - 1) * padding
    scale = Math.min(scale, free / total)
  }
  if (!Number.isFinite(scale) || scale <= 0) return { nodes: [], links: [], height: 0 }

  const columnX = (i: number) =>
    depths.length === 1 ? 0 : ((opts.width - nodeWidth) * i) / (depths.length - 1)

  const nodes: LayoutNode[] = []
  const byId = new Map<string, LayoutNode>()
  let usedHeight = 0

  columns.forEach((col, i) => {
    const heights = col.map((n) => Math.max(minNodeHeight, n.value * scale))
    const colHeight = heights.reduce((s, h) => s + h, 0) + (col.length - 1) * padding
    // Spalten mittig — bei sehr unterschiedlichen Knotenzahlen laufen die
    // Baender sonst alle schraeg nach oben.
    let y = Math.max(0, (opts.height - colHeight) / 2)
    usedHeight = Math.max(usedHeight, y + colHeight)

    col.forEach((n, j) => {
      const node: LayoutNode = {
        ...n,
        column: i,
        x0: columnX(i),
        x1: columnX(i) + nodeWidth,
        y0: y,
        y1: y + heights[j],
      }
      nodes.push(node)
      byId.set(node.id, node)
      y = node.y1 + padding
    })
  })

  // Reihenfolge der Baender innerhalb eines Knotens: dieselbe wie die
  // Reihenfolge der Knoten in der Nachbarspalte. Damit kreuzt sich nichts.
  const order = new Map(nodes.map((n, i) => [n.id, i]))
  const outgoing = new Map<string, FlowLink[]>()
  const incoming = new Map<string, FlowLink[]>()
  for (const l of flow.links) {
    if (!byId.has(l.source) || !byId.has(l.target)) continue
    const o = outgoing.get(l.source)
    if (o) o.push(l)
    else outgoing.set(l.source, [l])
    const t = incoming.get(l.target)
    if (t) t.push(l)
    else incoming.set(l.target, [l])
  }
  for (const list of outgoing.values())
    list.sort((a, b) => (order.get(a.target) ?? 0) - (order.get(b.target) ?? 0))
  for (const list of incoming.values())
    list.sort((a, b) => (order.get(a.source) ?? 0) - (order.get(b.source) ?? 0))

  const sourceCursor = new Map<string, number>()
  const targetCursor = new Map<string, number>()
  const links: LayoutLink[] = []

  for (const node of nodes) {
    for (const l of outgoing.get(node.id) ?? []) {
      const src = byId.get(l.source) as LayoutNode
      const dst = byId.get(l.target) as LayoutNode

      // Baender werden anteilig an der Knotenhoehe gestapelt statt am rohen
      // Massstab: bei angehobenen Winzigknoten (minNodeHeight) passt sonst die
      // Summe der Baender nicht mehr in den Knoten.
      const srcTotal = (outgoing.get(src.id) ?? []).reduce((s, x) => s + x.value, 0)
      const dstTotal = (incoming.get(dst.id) ?? []).reduce((s, x) => s + x.value, 0)
      const srcSpan = srcTotal > 0 ? ((src.y1 - src.y0) * l.value) / srcTotal : 0
      const dstSpan = dstTotal > 0 ? ((dst.y1 - dst.y0) * l.value) / dstTotal : 0

      const sy0 = sourceCursor.get(src.id) ?? src.y0
      const ty0 = targetCursor.get(dst.id) ?? dst.y0
      const sy1 = sy0 + srcSpan
      const ty1 = ty0 + dstSpan
      sourceCursor.set(src.id, sy1)
      targetCursor.set(dst.id, ty1)

      const xa = src.x1
      const xb = dst.x0
      const xm = (xa + xb) / 2

      links.push({
        ...l,
        midY: (sy0 + sy1) / 2,
        path:
          `M${xa},${sy0}` +
          `C${xm},${sy0} ${xm},${ty0} ${xb},${ty0}` +
          `L${xb},${ty1}` +
          `C${xm},${ty1} ${xm},${sy1} ${xa},${sy1}` +
          'Z',
      })
    }
  }

  return { nodes, links, height: usedHeight }
}
