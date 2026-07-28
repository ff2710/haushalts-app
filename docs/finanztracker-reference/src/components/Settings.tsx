import { useState } from "react";
import type { Category, CategoryInput, TxType } from "../lib/types";
import { api } from "../lib/api";
import IncomeStreams from "./IncomeStreams";
import RecurringIncome from "./RecurringIncome";
import FixedCosts from "./FixedCosts";
import VariableEstimate from "./VariableEstimate";

interface Props {
  month: string;
  categories: Category[];
  variableSuggestion: number | null;
  onCategoriesChanged: () => Promise<void>;
  onPlanChanged: () => Promise<void>;
}

export default function Settings({
  month,
  categories,
  variableSuggestion,
  onCategoriesChanged,
  onPlanChanged,
}: Props) {
  return (
    <div className="settings">
      <RecurringIncome month={month} categories={categories} onChanged={onPlanChanged} />
      <IncomeStreams month={month} categories={categories} onChanged={onPlanChanged} />
      <FixedCosts month={month} categories={categories} onChanged={onPlanChanged} />
      <VariableEstimate suggestion={variableSuggestion} onChanged={onPlanChanged} />
      <CategoryManager categories={categories} onChanged={onCategoriesChanged} />
    </div>
  );
}

// --- Kategorien --------------------------------------------------------
const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];

function CategoryManager({ categories, onChanged }: { categories: Category[]; onChanged: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TxType>("expense");
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    const input: CategoryInput = { name: name.trim(), type, color, monthly_budget: null };
    if (!input.name) return setError("Bitte einen Namen eingeben.");
    try {
      await api.addCategory(input);
      setName("");
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Kategorie "${c.name}" löschen? Bestehende Buchungen bleiben erhalten (ohne Kategorie).`)) return;
    await api.deleteCategory(c.id);
    await onChanged();
  }

  const income = categories.filter((c) => c.type === "income");
  const expense = categories.filter((c) => c.type === "expense");

  return (
    <div className="card">
      <h3 className="section-title">Kategorien</h3>
      <div className="cat-add-row">
        <input placeholder="Neue Kategorie" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value as TxType)}>
          <option value="expense">Ausgabe</option>
          <option value="income">Einnahme</option>
        </select>
        <div className="color-picker">
          {COLORS.map((col) => (
            <button
              key={col}
              type="button"
              className={color === col ? "active" : ""}
              style={{ background: col }}
              onClick={() => setColor(col)}
              aria-label={`Farbe ${col}`}
            />
          ))}
        </div>
        <button className="submit-btn" onClick={add}>Hinzufügen</button>
      </div>
      {error && <p className="form-error">{error}</p>}

      <div className="cat-columns">
        <CategoryList title="Ausgaben" items={expense} onRemove={remove} />
        <CategoryList title="Einnahmen" items={income} onRemove={remove} />
      </div>
    </div>
  );
}

function CategoryList({ title, items, onRemove }: { title: string; items: Category[]; onRemove: (c: Category) => void }) {
  return (
    <div>
      <h4 className="cat-subtitle">{title}</h4>
      <ul className="cat-list">
        {items.map((c) => (
          <li key={c.id}>
            <span className="tx-dot" style={{ background: c.color }} />
            <span className="cat-name">{c.name}</span>
            <button className="cat-del" onClick={() => onRemove(c)} title="Löschen">✕</button>
          </li>
        ))}
        {items.length === 0 && <li className="muted-note">Keine</li>}
      </ul>
    </div>
  );
}
