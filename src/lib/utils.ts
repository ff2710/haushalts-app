import type { Expense, Person, Settlement } from '../types'

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

export function formatMoney(value: number): string {
  return eur.format(value)
}

export function formatDate(iso: string): string {
  // iso ist 'YYYY-MM-DD' oder ein vollstaendiger Zeitstempel
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function todayISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10)
}

/**
 * Wandelt ein gemeinsames Mengen-/Einheitsfeld in {quantity, unit} um.
 * - Reine Zahl  ("3")      -> quantity "3",  unit "Stück"
 * - Zahl + Text ("500 g")  -> quantity "500", unit "g"   (Einheit bleibt erhalten)
 * - Reiner Text ("etwas")  -> quantity null, unit "etwas"
 * - Leer                   -> beide null
 */
export function parseQuantity(input: string): {
  quantity: string | null
  unit: string | null
} {
  const t = input.trim()
  if (!t) return { quantity: null, unit: null }

  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  if (m) {
    const rest = m[2].trim()
    return { quantity: m[1], unit: rest || 'Stück' }
  }
  return { quantity: null, unit: t }
}

export interface Balance {
  paidA: number       // gesamt von A bezahlt
  paidB: number       // gesamt von B bezahlt
  shareA: number      // Konsum-Anteil von A
  shareB: number      // Konsum-Anteil von B
  /**
   * net > 0  => B schuldet A diesen Betrag
   * net < 0  => A schuldet B den Betrag (Math.abs)
   * net == 0 => ausgeglichen
   */
  net: number
}

export function computeBalance(
  expenses: Expense[],
  settlements: Settlement[]
): Balance {
  let paidA = 0
  let paidB = 0
  let shareA = 0
  let shareB = 0

  for (const e of expenses) {
    const amount = Number(e.amount)
    if (e.paid_by === 'A') paidA += amount
    else paidB += amount

    if (e.split === 'both') {
      shareA += amount / 2
      shareB += amount / 2
    } else if (e.split === 'A') {
      shareA += amount
    } else {
      shareB += amount
    }
  }

  // Grundsaldo aus Ausgaben: positiver Wert = B schuldet A
  let net = paidA - shareA

  // Ausgleichszahlungen verrechnen
  for (const s of settlements) {
    const amount = Number(s.amount)
    // from=A zahlt an B  => A baut eigene Schulden ab  => net steigt
    // from=B zahlt an A  => B baut Schulden ab          => net sinkt
    net += s.from_person === 'A' ? amount : -amount
  }

  // Float-Rauschen gegen Null gluetten
  if (Math.abs(net) < 0.005) net = 0

  return { paidA, paidB, shareA, shareB, net }
}

export function personName(
  p: Person,
  names: { person_a: string; person_b: string }
): string {
  return p === 'A' ? names.person_a : names.person_b
}
