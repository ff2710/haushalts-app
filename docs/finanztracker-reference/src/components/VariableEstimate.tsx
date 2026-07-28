import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { parseAmount } from "../lib/amount";
import { formatEuro } from "../lib/format";

interface Props {
  suggestion: number | null; // Ø Ausgaben der letzten Monate
  onChanged: () => Promise<void>;
}

interface Row {
  name: string;
  amount: string;
}

export default function VariableEstimate({ suggestion, onChanged }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    const items = await api.variableEstimates();
    setRows(items.map((i) => ({ name: i.name, amount: String(i.amount) })));
  }
  useEffect(() => {
    load();
  }, []);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { name: "", amount: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setError(null);
    const items: { name: string; amount: number }[] = [];
    for (const r of rows) {
      if (!r.name.trim()) continue; // leere Zeilen ignorieren
      const amt = parseAmount(r.amount);
      if (amt == null || amt < 0) {
        setError(`Ungültiger Betrag bei „${r.name}".`);
        return;
      }
      items.push({ name: r.name.trim(), amount: amt });
    }
    try {
      await api.saveVariableEstimates(items);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  }

  const total = rows.reduce((s, r) => s + (parseAmount(r.amount) ?? 0), 0);

  return (
    <div className="card">
      <h3 className="section-title">Variable Ausgaben (Schätzung)</h3>
      <p className="muted-note">
        Grobe Schätzung deiner variablen Ausgaben für die Monats-Prognose. Passe die
        Posten an oder übernimm den Durchschnitt deiner letzten Monate.
      </p>

      <div className="ve-list">
        {rows.map((r, i) => (
          <div className="ve-row" key={i}>
            <input placeholder="Posten (z. B. Leben)" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
            <div className="stream-input">
              <input inputMode="decimal" placeholder="0,00" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
              <span className="euro">€</span>
            </div>
            <button className="cat-del" onClick={() => removeRow(i)} title="Entfernen">✕</button>
          </div>
        ))}
      </div>

      <div className="ve-actions">
        <button className="mini-btn" onClick={addRow}>+ Posten</button>
        {suggestion != null && (
          <button
            className="mini-btn"
            onClick={() => setRows([{ name: "Ausgaben (geschätzt)", amount: String(suggestion) }])}
            title="Ersetzt die Posten durch den Durchschnitt deiner letzten Monate"
          >
            Ø letzter Monate übernehmen ({formatEuro(suggestion)})
          </button>
        )}
        <span className="ve-total">Summe: <strong>{formatEuro(total)}</strong></span>
        <button className="submit-btn" onClick={save}>{saved ? "✓ Gespeichert" : "Speichern"}</button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
