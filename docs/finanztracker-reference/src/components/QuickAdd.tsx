import { useMemo, useState } from "react";
import type { Category, TransactionInput, TxType } from "../lib/types";
import { today } from "../lib/format";
import { parseAmount } from "../lib/amount";

interface Props {
  categories: Category[];
  onAdd: (input: TransactionInput) => Promise<void>;
  onRequestClose?: () => void;
}

export default function QuickAdd({ categories, onAdd, onRequestClose }: Props) {
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  function switchType(next: TxType) {
    setType(next);
    setCategoryId(""); // Kategorie zurücksetzen, da typgebunden
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = parseAmount(amount);
    if (amt == null || amt <= 0) {
      setError("Bitte einen gültigen Betrag größer als 0 eingeben.");
      return;
    }
    setSaving(true);
    try {
      await onAdd({
        date,
        type,
        amount: amt,
        category_id: categoryId ? Number(categoryId) : null,
        description: description.trim(),
      });
      // Formular für den nächsten schnellen Eintrag bereit halten,
      // Datum & Typ beibehalten.
      setAmount("");
      setDescription("");
      setCategoryId("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card quick-add" onSubmit={submit}>
      {onRequestClose && (
        <div className="quick-add-header">
          <span className="quick-add-title">Neue Buchung</span>
          <button type="button" className="sheet-close" onClick={onRequestClose} aria-label="Schließen">
            ✕
          </button>
        </div>
      )}

      <div className="type-toggle" role="group" aria-label="Typ">
        <button
          type="button"
          className={type === "expense" ? "active expense" : ""}
          onClick={() => switchType("expense")}
        >
          Ausgabe
        </button>
        <button
          type="button"
          className={type === "income" ? "active income" : ""}
          onClick={() => switchType("income")}
        >
          Einnahme
        </button>
      </div>

      <div className="quick-add-row">
        <label className="field amount-field">
          <span>Betrag</span>
          <div className="amount-input">
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              autoFocus
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="euro">€</span>
          </div>
        </label>

        <label className="field">
          <span>Kategorie</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">– keine –</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Datum</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <div className="quick-add-row">
        <label className="field grow">
          <span>Beschreibung (optional)</span>
          <input
            placeholder="z. B. Wocheneinkauf Rewe"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button className="submit-btn" type="submit" disabled={saving}>
          {saving ? "…" : "Erfassen"}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {saved && <p className="form-success">✓ Gespeichert</p>}
    </form>
  );
}
