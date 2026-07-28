import { useEffect, useState } from "react";
import type { Category, Summary } from "../lib/types";
import { api } from "../lib/api";
import { parseAmount } from "../lib/amount";
import { formatEuro, formatMonth } from "../lib/format";

interface Props {
  month: string; // YYYY-MM
  categories: Category[];
  onChanged: () => Promise<void>;
}

// Schnelle Erfassung der monatlich wechselnden Einkommens-Ströme.
// Ströme = Einnahme-Kategorien (Praktikum, Eltern, BAföG, Nebenjob …).
// Jeder eingetragene Betrag wird als Einnahme-Buchung (datiert auf den 1.
// des Monats) angelegt — additiv und konsistent mit dem restlichen Modell.
export default function IncomeStreams({ month, categories, onChanged }: Props) {
  const incomeCats = categories.filter((c) => c.type === "income");
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [recorded, setRecorded] = useState<Summary["byIncomeCategory"]>([]);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadRecorded() {
    const s = await api.summary(month);
    setRecorded(s.byIncomeCategory);
    setIncomeTotal(s.income);
  }
  useEffect(() => {
    loadRecorded();
    setAmounts({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  function recordedFor(name: string): number {
    return recorded.find((r) => r.name === name)?.total ?? 0;
  }

  async function submit() {
    if (saving) return; // Doppelklick-Schutz
    setError(null);

    // Erst alle ausgefüllten Felder validieren — ungültige Beträge NICHT
    // still überspringen (sonst glaubt man, etwas erfasst zu haben).
    const filled = incomeCats.filter((c) => (amounts[c.id] ?? "").trim() !== "");
    if (filled.length === 0) {
      setError("Trage bei mindestens einem Strom einen Betrag ein.");
      return;
    }
    const entries: { c: Category; amt: number }[] = [];
    for (const c of filled) {
      const amt = parseAmount(amounts[c.id] ?? "");
      if (amt == null || amt <= 0) {
        setError(`Ungültiger Betrag bei „${c.name}".`);
        return;
      }
      entries.push({ c, amt });
    }

    setSaving(true);
    try {
      // Jede erfolgreiche Buchung sofort aus dem Formular entfernen, damit
      // ein Fehler mitten im Batch bei erneutem Klick nichts doppelt bucht.
      for (const { c, amt } of entries) {
        await api.addTransaction({
          date: `${month}-01`,
          type: "income",
          amount: amt,
          category_id: c.id,
          description: `${c.name} · ${formatMonth(month)}`,
        });
        setAmounts((prev) => {
          const next = { ...prev };
          delete next[c.id];
          return next;
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eintragen fehlgeschlagen. Bereits gebuchte Ströme wurden entfernt.");
    } finally {
      setSaving(false);
      await Promise.all([loadRecorded(), onChanged()]);
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">Einnahmen · {formatMonth(month)}</h3>
      <p className="muted-note">
        Dein Einkommens-Mix ändert sich jeden Monat. Trage hier je Strom den
        Betrag für diesen Monat ein — jeder Eintrag wird als Einnahme gebucht.
        Neue Ströme legst du unten als Einnahme-Kategorie an.
      </p>

      {incomeCats.length === 0 ? (
        <p className="muted-note">Noch keine Einnahme-Kategorien angelegt.</p>
      ) : (
        <div className="stream-list">
          {incomeCats.map((c) => (
            <div className="stream-row" key={c.id}>
              <span className="stream-name">
                <span className="tx-dot" style={{ background: c.color }} />
                {c.name}
              </span>
              <span className="stream-recorded">
                {recordedFor(c.name) > 0 ? `bisher ${formatEuro(recordedFor(c.name))}` : "—"}
              </span>
              <div className="stream-input">
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amounts[c.id] ?? ""}
                  onChange={(e) => setAmounts({ ...amounts, [c.id]: e.target.value })}
                />
                <span className="euro">€</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="stream-footer">
        <span className="stream-total">
          Einnahmen bisher: <strong>{formatEuro(incomeTotal)}</strong>
        </span>
        <button className="submit-btn" onClick={submit} disabled={saving}>
          {saving ? "…" : saved ? "✓ Eingetragen" : "Einnahmen eintragen"}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
