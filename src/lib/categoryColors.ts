// Farbsystem der Kategorien: eine Basisfarbe je Hauptkategorie, die
// Unterkategorien als abgestufte Varianten daraus abgeleitet.
//
// Bewusst NICHT frei waehlbar pro Unterkategorie: sonst zerfaellt im Sankey und
// im Donut die visuelle Zuordnung "welche Unterkategorie gehoert zu welcher
// Hauptkategorie". Die Ableitung steht deshalb hier an einer Stelle und wird
// von Editor und Diagrammen gemeinsam benutzt, nicht je Komponente neu erfunden.

/** Wie stark je Rang aufgehellt bzw. entsaettigt wird (Prozentpunkte). */
const LIGHTNESS_STEP  = 7
const SATURATION_STEP = 4
/** Grenzen, damit auch der zehnte Rang noch als Farbe lesbar bleibt. */
const MAX_LIGHTNESS   = 82
const MIN_SATURATION  = 25

interface Hsl {
  h: number
  s: number
  l: number
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/** '#rrggbb' oder '#rgb' -> HSL. Bei Unlesbarem ein neutrales Grau, damit die
 *  Diagramme nie mit NaN-Farben rendern. */
export function hexToHsl(hex: string): Hsl {
  const raw = hex.trim().replace('#', '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return { h: 0, s: 0, l: 50 }

  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min

  if (d === 0) return { h: 0, s: 0, l: l * 100 }

  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360

  return { h, s: s * 100, l: l * 100 }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sN = clamp(s, 0, 100) / 100
  const lN = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * lN - 1)) * sN
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lN - c / 2

  const [r, g, b] =
    h < 60   ? [c, x, 0] :
    h < 120  ? [x, c, 0] :
    h < 180  ? [0, c, x] :
    h < 240  ? [0, x, c] :
    h < 300  ? [x, 0, c] :
               [c, 0, x]

  const hex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/**
 * Farbe einer Unterkategorie: dieselbe Farbfamilie wie die Hauptkategorie,
 * nur heller und etwas blasser. `rank` ist die 0-basierte Position unter den
 * Geschwistern (stabile Reihenfolge = nach Name, wie ueberall in der App).
 *
 * Rang 0 ist bereits eine Stufe heller als das Elternteil — die Hauptkategorie
 * behaelt ihre Basisfarbe fuer sich, sonst waeren Elternteil und erstes Kind im
 * Sankey nicht auseinanderzuhalten.
 *
 * Bewusste Grenze: Die Schrittweite ist auf den Normalfall von zwei bis fuenf
 * Unterkategorien ausgelegt, die dadurch deutlich auseinanderliegen. Ab etwa
 * Rang 4 stoesst die Helligkeit an MAX_LIGHTNESS, ab da unterscheiden sich die
 * Stufen nur noch ueber die Saettigung und liegen entsprechend naeher
 * beieinander. Umgekehrt (kleinere Schritte, damit auch Rang 10 noch passt)
 * waeren die ersten, haeufigen Faelle schlechter unterscheidbar — deshalb so
 * herum.
 */
export function subCategoryColor(parentHex: string, rank: number): string {
  const base = hexToHsl(parentHex)
  const step = Math.max(0, rank) + 1
  return hslToHex({
    h: base.h,
    s: clamp(base.s - SATURATION_STEP * step, MIN_SATURATION, 100),
    l: clamp(base.l + LIGHTNESS_STEP * step, 0, MAX_LIGHTNESS),
  })
}

/** Minimalform einer Kategorie fuer die Farbzuordnung. */
export interface ColorableCategory {
  id: string
  name: string
  color: string
  parent_id: string | null
}

/**
 * Farbe je Kategorie-ID fuer einen kompletten Kategoriebaum — Hauptkategorien
 * mit ihrer eigenen Farbe, Unterkategorien abgeleitet vom Elternteil.
 *
 * An einer Stelle fuer alle: Sankey, Donut und Editor zeigen so garantiert
 * dieselbe Farbe fuer dieselbe Kategorie.
 */
export function categoryColorMap(categories: ColorableCategory[]): Map<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const map = new Map<string, string>()

  // Geschwister je Elternteil, nach Name — dieselbe Ordnung wie in den Listen.
  const siblings = new Map<string, ColorableCategory[]>()
  for (const c of categories) {
    if (!c.parent_id) continue
    const list = siblings.get(c.parent_id)
    if (list) list.push(c)
    else siblings.set(c.parent_id, [c])
  }
  for (const list of siblings.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }

  for (const c of categories) {
    if (!c.parent_id) {
      map.set(c.id, c.color)
      continue
    }
    const parent = byId.get(c.parent_id)
    // Elternteil nicht geladen (z. B. gefilterte Liste): eigene Farbe behalten,
    // statt mit einer erfundenen Ableitung zu raten.
    if (!parent) {
      map.set(c.id, c.color)
      continue
    }
    const rank = siblings.get(c.parent_id)?.findIndex((s) => s.id === c.id) ?? 0
    map.set(c.id, subCategoryColor(parent.color, rank))
  }

  return map
}
