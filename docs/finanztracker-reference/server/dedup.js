// Deterministische Helfer für Dubletten-Erkennung.
// Wird bei jeder Transaktion (manuell + CSV) genutzt, damit spätere
// Import-Vergleiche auf einer stabilen, normalisierten Basis laufen.

// Beschreibung normalisieren: Kleinbuchstaben, typische Banking-Prefixe und
// Sonderzeichen raus, Mehrfach-Leerzeichen zusammenfassen.
export function normalizeDescription(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\b(kartenzahlung|lastschrift|ueberweisung|überweisung|dauerauftrag|sepa|paypal|visa|mastercard)\b/g, "")
    .replace(/[^a-z0-9äöüß ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Stabiler Schlüssel für exakte Dubletten (gleicher Tag, Typ, Betrag, Text).
// Das ±3-Tage-Fenster wird beim Import zusätzlich per Abfrage geprüft.
export function makeDedupKey({ date, type, amount, description }) {
  const cents = Math.round(Number(amount) * 100);
  return [date, type, cents, normalizeDescription(description)].join("|");
}

// Deterministische Regel: Ein Kandidat gilt als Dublette einer bestehenden
// Transaktion, wenn ALLE Bedingungen erfüllt sind:
//   1. gleicher Typ und gleicher Betrag (auf den Cent),
//   2. Datum innerhalb ±3 Tage,
//   3. normalisierte Beschreibung stimmt überein (leere Texte zählen nicht).
// Gibt die passende bestehende Transaktion zurück oder null.
export function findDuplicate(db, row) {
  const cents = Math.round(Number(row.amount) * 100);
  const candidates = db
    .prepare(
      `SELECT id, date, type, amount, description
       FROM transactions
       WHERE type = @type
         AND ROUND(amount * 100) = @cents
         AND date BETWEEN date(@date, '-3 days') AND date(@date, '+3 days')`
    )
    .all({ type: row.type, cents, date: row.date });

  const normRow = normalizeDescription(row.description);
  for (const c of candidates) {
    const normC = normalizeDescription(c.description);
    // Bei vorhandenem Text: exakte Übereinstimmung nach Normalisierung.
    // Ohne Text auf beiden Seiten: Betrag+Datum+Typ reichen als Signal.
    if ((normRow && normC && normRow === normC) || (!normRow && !normC)) {
      return c;
    }
  }
  return null;
}
