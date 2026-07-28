import { useEffect, useState } from "react";
import type { Category, RecurringIncomeItem } from "../lib/types";
import { api } from "../lib/api";
import { parseAmount } from "../lib/amount";
import { formatEuro, formatMonth } from "../lib/format";

interface Props {
  month: string;
  categories: Category[];
  onChanged: () => Promise<void>;
}

export default function RecurringIncome({ month, categories, onChanged }: Props) {
  const [items, setItems] = useState<RecurringIncomeItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [startMonth, setStartMonth] = useState(month);
  const [endMonth, setEndMonth] = useState("");

  const incomeCats = categories.filter((c) => c.type === "income");

  async function load() {
    setItems(await api.recurringIncome(month));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function add() {
    setError(null);
    const amt = parseAmount(amount);
    if (!categoryId) return setError("Bitte einen Einnahme-Strom (Kategorie) wählen.");
    if (amt == null || amt <= 0) return setError("Bitte einen gültigen Betrag eingeben.");
    if (!startMonth) return setError("Bitte den Startmonat wählen.");
    try {
      await api.addRecurringIncome({
        category_id: Number(categoryId),
        amount: amt,
        start_month: startMonth,
        end_month: endMonth || null,
      });
      setCategoryId("");
      setAmount("");
      setEndMonth("");
      setAdding(false);
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.");
    }
  }

  async function apply(ri: RecurringIncomeItem) {
    try {
      const res = await api.applyRecurringIncome(ri.id, month);
      if (res.skipped) setError(`„${ri.category_name}" ist für ${formatMonth(month)} bereits gebucht.`);
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Übernehmen fehlgeschlagen.");
    }
  }

  async function remove(ri: RecurringIncomeItem) {
    if (!confirm(`Regelmäßige Einnahme „${ri.category_name}" löschen?`)) return;
    await api.deleteRecurringIncome(ri.id);
    await load();
    await onChanged();
  }

  return (
    <div className="card">
      <div className="savings-header">
        <h3 className="section-title" style={{ margin: 0 }}>Regelmäßige Einnahmen</h3>
        <button className="mini-btn" onClick={() => setAdding((v) => !v)}>
          {adding ? "Abbrechen" : "+ Neue Einnahme"}
        </button>
      </div>
      <p className="muted-note">
        Einnahmen über mehrere Monate (z. B. BAföG bis März, Praktikum bis Oktober).
        Zählt automatisch in die Prognose der abgedeckten Monate.
      </p>

      {adding && (
        <div className="fc-form">
          <div className="fc-form-row">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">– Strom wählen –</option>
              {incomeCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input placeholder="Betrag / Monat" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="fc-form-row">
            <label className="fc-field">
              <span>Von Monat</span>
              <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
            </label>
            <label className="fc-field">
              <span>Bis Monat (leer = laufend)</span>
              <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
            </label>
            <button className="submit-btn" onClick={add}>Anlegen</button>
          </div>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      {items.length === 0 ? (
        <p className="muted-note">Noch keine regelmäßigen Einnahmen.</p>
      ) : (
        <ul className="fc-list">
          {items.map((ri) => {
            const coversThisMonth = ri.amountThisMonth > 0;
            return (
              <li key={ri.id} className="fc-row">
                <div className="fc-main">
                  <span className="fc-name">
                    <span className="tx-dot" style={{ background: ri.category_color || "#22c55e" }} />
                    {ri.category_name || "Einnahme"}
                  </span>
                  <span className="fc-meta">
                    {formatEuro(ri.amount)}/M · {formatMonth(ri.start_month)}
                    {ri.end_month ? ` – ${formatMonth(ri.end_month)}` : " – laufend"}
                  </span>
                </div>
                <div className="fc-actions">
                  {!coversThisMonth ? (
                    <span className="fc-saving">nicht in diesem Monat</span>
                  ) : ri.appliedThisMonth ? (
                    <span className="applied-badge">✓ übernommen</span>
                  ) : (
                    <button className="mini-btn" onClick={() => apply(ri)}>übernehmen</button>
                  )}
                  <button className="cat-del" onClick={() => remove(ri)} title="Löschen">✕</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
