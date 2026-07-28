import { useEffect, useState } from "react";
import type { Cadence, Category, FixedCost } from "../lib/types";
import { api } from "../lib/api";
import { parseAmount } from "../lib/amount";
import { formatEuro, formatMonth } from "../lib/format";

interface Props {
  month: string;
  categories: Category[];
  onChanged: () => Promise<void>;
}

const CADENCE_LABEL: Record<Cadence, string> = {
  monthly: "monatlich",
  quarterly: "vierteljährlich",
  half_yearly: "halbjährlich",
  yearly: "jährlich",
  once: "einmalig",
};

export default function FixedCosts({ month, categories, onChanged }: Props) {
  const [items, setItems] = useState<FixedCost[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formularfelder
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [dueMonth, setDueMonth] = useState("");
  const [startMonth, setStartMonth] = useState(month);
  const [amortize, setAmortize] = useState(true);
  const [categoryId, setCategoryId] = useState("");

  const expenseCats = categories.filter((c) => c.type === "expense");
  const nonMonthly = cadence !== "monthly";

  async function load() {
    setItems(await api.fixedCosts(month));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  function resetForm() {
    setName("");
    setAmount("");
    setCadence("monthly");
    setDueMonth("");
    setStartMonth(month);
    setAmortize(true);
    setCategoryId("");
  }

  async function add() {
    setError(null);
    const amt = parseAmount(amount);
    if (!name.trim()) return setError("Bitte einen Namen eingeben.");
    if (amt == null || amt <= 0) return setError("Bitte einen gültigen Betrag eingeben.");
    if (nonMonthly && !dueMonth) return setError("Bitte den Fälligkeitsmonat wählen.");
    try {
      await api.addFixedCost({
        name: name.trim(),
        amount: amt,
        cadence,
        due_month: nonMonthly ? dueMonth : null,
        start_month: startMonth || null,
        amortize,
        category_id: categoryId ? Number(categoryId) : null,
      });
      resetForm();
      setAdding(false);
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.");
    }
  }

  async function apply(fc: FixedCost) {
    try {
      const res = await api.applyFixedCost(fc.id, month);
      if (res.skipped) setError(`„${fc.name}" ist für ${formatMonth(month)} bereits gebucht.`);
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Übernehmen fehlgeschlagen.");
    }
  }

  async function remove(fc: FixedCost) {
    if (!confirm(`Fixkosten „${fc.name}" löschen?`)) return;
    await api.deleteFixedCost(fc.id);
    await load();
    await onChanged();
  }

  const totalMonthly = items.reduce((s, f) => s + f.monthlyEquivalent, 0);

  return (
    <div className="card">
      <div className="savings-header">
        <h3 className="section-title" style={{ margin: 0 }}>Fixkosten</h3>
        <button className="mini-btn" onClick={() => setAdding((v) => !v)}>
          {adding ? "Abbrechen" : "+ Neue Fixkosten"}
        </button>
      </div>
      <p className="muted-note">
        Wiederkehrende Kosten. Nicht-monatliche kannst du auf einen Monatsbetrag
        umrechnen lassen — ab dem gewählten Monat bis zur Fälligkeit.
      </p>

      {adding && (
        <div className="fc-form">
          <div className="fc-form-row">
            <input placeholder="Name (z. B. Miete)" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Betrag" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
              {(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => (
                <option key={c} value={c}>{CADENCE_LABEL[c]}</option>
              ))}
            </select>
          </div>
          {nonMonthly && (
            <div className="fc-form-row">
              <label className="fc-field">
                <span>Fällig im Monat</span>
                <input type="month" value={dueMonth} onChange={(e) => setDueMonth(e.target.value)} />
              </label>
              <label className="fc-field">
                <span>Ab wann zurücklegen</span>
                <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
              </label>
              <label className="checkbox-row" style={{ marginBottom: 0 }}>
                <input type="checkbox" checked={amortize} onChange={(e) => setAmortize(e.target.checked)} />
                auf Monat umrechnen
              </label>
            </div>
          )}
          <div className="fc-form-row">
            <label className="fc-field">
              <span>Kategorie (optional)</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">– keine –</option>
                {expenseCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <button className="submit-btn" onClick={add}>Anlegen</button>
          </div>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      {items.length === 0 ? (
        <p className="muted-note">Noch keine Fixkosten angelegt.</p>
      ) : (
        <>
          <ul className="fc-list">
            {items.map((fc) => (
              <li key={fc.id} className="fc-row">
                <div className="fc-main">
                  <span className="fc-name">{fc.name}</span>
                  <span className="fc-meta">
                    {formatEuro(fc.amount)} {CADENCE_LABEL[fc.cadence]}
                    {fc.cadence !== "monthly" && fc.due_month ? ` · fällig ${formatMonth(fc.due_month)}` : ""}
                    {fc.cadence !== "monthly" && fc.amortize ? " · umgerechnet" : ""}
                  </span>
                </div>
                <span className="fc-monthly" title="Monats-Äquivalent">{formatEuro(fc.monthlyEquivalent)}/M</span>
                <div className="fc-actions">
                  {fc.appliedThisMonth ? (
                    <span className="applied-badge">✓ übernommen</span>
                  ) : fc.dueThisMonth ? (
                    <button className="mini-btn" onClick={() => apply(fc)}>übernehmen</button>
                  ) : fc.monthlyEquivalent > 0 ? (
                    <span className="fc-saving">wird angespart</span>
                  ) : (
                    <span className="fc-saving">nicht in diesem Monat</span>
                  )}
                  <button className="cat-del" onClick={() => remove(fc)} title="Löschen">✕</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="fc-total">Fixkosten diesen Monat (umgerechnet): <strong>{formatEuro(totalMonthly)}</strong></p>
        </>
      )}
    </div>
  );
}
