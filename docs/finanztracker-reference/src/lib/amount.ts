// Zentrale, robuste Betrags-Erkennung für ALLE manuellen Eingabepfade
// (QuickAdd, IncomeStreams, Monatsplan, Sparziele) und den CSV-Import.
// Versteht deutsche UND englische Schreibweise inkl. Tausendertrenner.
// Gibt null zurück, wenn kein gültiger Betrag erkennbar ist.
//
//   "1.234,56" -> 1234.56   "1,234.56" -> 1234.56   "-42,90" -> -42.9
//   "1.500"    -> 1500       "12,50"    -> 12.5       "1.5"    -> 1.5
export function parseAmount(raw: string): number | null {
  const s = String(raw).trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;

  const commas = (s.match(/,/g) || []).length;
  const dots = (s.match(/\./g) || []).length;
  let normalized: string;

  if (commas && dots) {
    // Beide vorhanden: der zuletzt stehende Trenner ist der Dezimaltrenner.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      normalized = s.replace(/\./g, "").replace(",", "."); // deutsch
    } else {
      normalized = s.replace(/,/g, ""); // englisch
    }
  } else if (commas || dots) {
    // Nur EIN Trennzeichen-Typ — mehrdeutig ("1.500" = 1500 oder 1,5?).
    const sep = commas ? "," : ".";
    const parts = s.split(sep);
    if (parts.length > 2) {
      normalized = parts.join(""); // mehrfach -> Tausendertrenner
    } else if (parts[1].length === 3) {
      normalized = parts[0] + parts[1]; // 3 Stellen dahinter -> Tausender
    } else {
      normalized = parts[0] + "." + parts[1]; // sonst Dezimaltrenner
    }
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
