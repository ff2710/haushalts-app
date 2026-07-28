// Deterministische Dubletten-Erkennung. Port aus dem Finanztracker
// (docs/finanztracker-reference/server/dedup.js) — die REGEL ist woertlich
// uebernommen, nur die Datenquelle wechselt von SQLite zu Supabase.
//
// NICHT VERHANDELBAR (CLAUDE.md): Es wird nie geraten. Was die Regel als
// verdaechtig markiert, geht in den Review-Screen; der Mensch entscheidet.
// Es wird nichts still doppelt angelegt und nichts still geloescht.

/** Beschreibung normalisieren: Kleinbuchstaben, typische Banking-Prefixe und
 *  Sonderzeichen raus, Mehrfach-Leerzeichen zusammenfassen. */
export function normalizeDescription(raw: string | null | undefined): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(
      /\b(kartenzahlung|lastschrift|ueberweisung|überweisung|dauerauftrag|sepa|paypal|visa|mastercard)\b/g,
      '',
    )
    .replace(/[^a-z0-9äöüß ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Stabiler Schluessel fuer exakte Dubletten (gleicher Tag, Typ, Betrag, Text).
 *  Das +/-3-Tage-Fenster wird zusaetzlich in findDuplicate geprueft. */
export function makeDedupKey(row: {
  date: string
  type: string
  amount: number
  description?: string | null
}): string {
  const cents = Math.round(Number(row.amount) * 100)
  return [row.date, row.type, cents, normalizeDescription(row.description)].join('|')
}

/** Tagesabstand zwischen zwei ISO-Daten (YYYY-MM-DD), immer >= 0. */
function dayDistance(a: string, b: string): number {
  const ms = Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')
  return Math.abs(ms) / 86_400_000
}

export interface DedupRow {
  date: string
  type: string
  amount: number
  description?: string | null
}

/**
 * Deterministische Regel: Ein Kandidat gilt als Dublette einer bestehenden
 * Transaktion, wenn ALLE Bedingungen erfuellt sind:
 *   1. gleicher Typ und gleicher Betrag (auf den Cent),
 *   2. Datum innerhalb +/-3 Tage,
 *   3. normalisierte Beschreibung stimmt ueberein (leere Texte zaehlen nicht).
 *
 * `existing` sind die bereits gespeicherten Transaktionen im relevanten
 * Zeitfenster (siehe personalService.fetchTransactionsInRange) — RLS sorgt
 * dafuer, dass das ausschliesslich eigene Zeilen sind.
 *
 * Gibt die passende bestehende Transaktion zurueck oder null.
 */
export function findDuplicate<T extends DedupRow>(existing: T[], row: DedupRow): T | null {
  const cents = Math.round(Number(row.amount) * 100)
  const normRow = normalizeDescription(row.description)

  for (const c of existing) {
    if (c.type !== row.type) continue
    if (Math.round(Number(c.amount) * 100) !== cents) continue
    if (dayDistance(c.date, row.date) > 3) continue

    const normC = normalizeDescription(c.description)
    // Bei vorhandenem Text: exakte Uebereinstimmung nach Normalisierung.
    // Ohne Text auf beiden Seiten: Betrag+Datum+Typ reichen als Signal.
    if ((normRow && normC && normRow === normC) || (!normRow && !normC)) {
      return c
    }
  }
  return null
}

/** Datumsfenster (+/-3 Tage) um eine Menge von Zeilen — fuer die Abfrage der
 *  Vergleichsdaten. Gibt null zurueck, wenn keine Zeilen vorliegen. */
export function dedupWindow(rows: DedupRow[]): { from: string; to: string } | null {
  if (rows.length === 0) return null
  const dates = rows.map((r) => r.date).sort()
  const shift = (iso: string, days: number) =>
    new Date(Date.parse(iso + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10)
  return { from: shift(dates[0], -3), to: shift(dates[dates.length - 1], 3) }
}
