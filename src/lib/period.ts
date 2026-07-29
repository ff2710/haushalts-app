// Zeitraum der Analyse-Ansicht: Monat, Quartal oder Jahr, mit Blaettern.
//
// Alles auf 'YYYY-MM-DD'-Strings gerechnet statt auf Date-Objekten. Date
// rechnet in Ortszeit, und beim Monatswechsel um Mitternacht faengt man sich
// damit Verschiebungen um einen Tag ein — bei Monatsgrenzen genau das, was man
// nicht gebrauchen kann.

export type PeriodKind = 'month' | 'quarter' | 'year'

export interface Period {
  kind: PeriodKind
  /** Erster Tag, ISO 'YYYY-MM-DD' — inklusive. */
  start: string
  /** Erster Tag DANACH, ISO — exklusiv. Passt direkt auf gte/lt in Abfragen. */
  endExclusive: string
  /** Was in der Kopfzeile steht: "August 2025", "Q3 2025", "2025". */
  label: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/** Monat (1-basiert) um `delta` verschieben, mit Jahresuebertrag. */
function addMonths(y: number, m: number, delta: number): [number, number] {
  const total = y * 12 + (m - 1) + delta
  return [Math.floor(total / 12), (total % 12) + 1]
}

/** Zeitraum, in dem `anchor` ('YYYY-MM-DD') liegt. */
export function periodOf(kind: PeriodKind, anchor: string): Period {
  const y = Number(anchor.slice(0, 4))
  const m = Number(anchor.slice(5, 7))

  if (kind === 'year') {
    return {
      kind,
      start: iso(y, 1, 1),
      endExclusive: iso(y + 1, 1, 1),
      label: String(y),
    }
  }

  if (kind === 'quarter') {
    const q = Math.floor((m - 1) / 3)
    const startMonth = q * 3 + 1
    const [ey, em] = addMonths(y, startMonth, 3)
    return {
      kind,
      start: iso(y, startMonth, 1),
      endExclusive: iso(ey, em, 1),
      label: `Q${q + 1} ${y}`,
    }
  }

  const [ey, em] = addMonths(y, m, 1)
  return {
    kind,
    start: iso(y, m, 1),
    endExclusive: iso(ey, em, 1),
    label: `${MONTHS[m - 1]} ${y}`,
  }
}

/** Einen Zeitraum vor oder zurueck blaettern. */
export function shiftPeriod(p: Period, delta: number): Period {
  const y = Number(p.start.slice(0, 4))
  const m = Number(p.start.slice(5, 7))
  const step = p.kind === 'year' ? 12 : p.kind === 'quarter' ? 3 : 1
  const [ny, nm] = addMonths(y, m, delta * step)
  return periodOf(p.kind, iso(ny, nm, 1))
}

/** Beim Wechsel der Koernung im selben Zeitpunkt bleiben (Monat -> sein Quartal). */
export function withKind(p: Period, kind: PeriodKind): Period {
  return periodOf(kind, p.start)
}

/** Liegt `today` im Zeitraum? Steuert, ob "Aktueller Monat" angeboten wird. */
export function isCurrent(p: Period, today: string): boolean {
  return today >= p.start && today < p.endExclusive
}

/**
 * Die `count` Zeitraeume bis einschliesslich `p`, aeltester zuerst — Grundlage
 * fuer den Balken-Verlauf ueber der Kopfzeile.
 */
export function trailingPeriods(p: Period, count: number): Period[] {
  const out: Period[] = []
  for (let i = count - 1; i >= 0; i--) out.push(shiftPeriod(p, -i))
  return out
}

/** Kurzform fuer die Balken-Achse: "Aug", "Q3", "2025". */
export function shortLabel(p: Period): string {
  if (p.kind === 'year') return p.label
  if (p.kind === 'quarter') return p.label.slice(0, 2)
  return MONTHS[Number(p.start.slice(5, 7)) - 1].slice(0, 3)
}
