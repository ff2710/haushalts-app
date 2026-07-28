import { useEffect, useState } from "react";
import type { SavingsGoal } from "../lib/types";
import { api } from "../lib/api";
import { parseAmount } from "../lib/amount";
import { formatDate, formatEuro } from "../lib/format";

export default function SavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setGoals(await api.savingsGoals());
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    const amt = parseAmount(target);
    if (!name.trim()) return setError("Bitte einen Namen eingeben.");
    if (amt == null || amt <= 0) return setError("Zielbetrag muss größer als 0 sein.");
    try {
      await api.addSavingsGoal({ name: name.trim(), target_amount: amt, target_date: date || null });
      setName("");
      setTarget("");
      setDate("");
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.");
    }
  }

  async function contribute(g: SavingsGoal, sign: 1 | -1) {
    const raw = prompt(sign > 0 ? `Wie viel auf "${g.name}" einzahlen?` : `Wie viel abheben?`, "");
    if (raw == null) return;
    const amt = parseAmount(raw);
    if (amt == null || amt <= 0) return;
    try {
      await api.contributeSavingsGoal(g.id, sign * amt);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen.");
    }
  }

  async function remove(g: SavingsGoal) {
    if (!confirm(`Sparziel "${g.name}" löschen?`)) return;
    try {
      await api.deleteSavingsGoal(g.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  }

  return (
    <div className="card savings-card">
      <div className="savings-header">
        <h3 className="section-title" style={{ margin: 0 }}>Sparziele</h3>
        <button className="mini-btn" onClick={() => setAdding((v) => !v)}>
          {adding ? "Abbrechen" : "+ Neues Ziel"}
        </button>
      </div>

      {adding && (
        <div className="goal-add">
          <input placeholder="Name (z. B. Urlaub)" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Zielbetrag" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="submit-btn" onClick={create}>Anlegen</button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      {goals.length === 0 && !adding ? (
        <p className="muted-note">Noch keine Sparziele. Lege eins an, um deinen Fortschritt zu verfolgen.</p>
      ) : (
        <div className="goal-grid">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
            const done = g.current_amount >= g.target_amount;
            return (
              <div key={g.id} className={`goal ${done ? "done" : ""}`}>
                <div className="goal-top">
                  <span className="goal-name">{g.name}</span>
                  <button className="cat-del" onClick={() => remove(g)} title="Löschen">✕</button>
                </div>
                <div className="goal-amounts">
                  <strong>{formatEuro(g.current_amount)}</strong>
                  <span className="muted"> / {formatEuro(g.target_amount)}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill goal-bar" style={{ width: `${pct}%` }} />
                </div>
                <div className="goal-footer">
                  <span className="goal-pct">{pct}%{done ? " · erreicht 🎉" : ""}</span>
                  {g.target_date && <span className="muted">bis {formatDate(g.target_date)}</span>}
                </div>
                <div className="goal-actions">
                  <button onClick={() => contribute(g, 1)}>+ Einzahlen</button>
                  <button onClick={() => contribute(g, -1)}>− Abheben</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
