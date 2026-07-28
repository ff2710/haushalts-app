import { useState } from "react";
import type { Category, Transaction, TransactionInput } from "../lib/types";
import { parseAmount } from "../lib/amount";
import { formatDate, formatSigned } from "../lib/format";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  onUpdate: (id: number, input: TransactionInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function TransactionList({ transactions, categories, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);

  if (transactions.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <h2>Noch keine Einträge in diesem Monat</h2>
          <p>Erfasse oben deine erste Einnahme oder Ausgabe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card list-card">
      <h3 className="section-title">Buchungen</h3>
      <ul className="tx-list">
        {transactions.map((t) =>
          editingId === t.id ? (
            <EditRow
              key={t.id}
              tx={t}
              categories={categories}
              onCancel={() => setEditingId(null)}
              onSave={async (input) => {
                try {
                  await onUpdate(t.id, input);
                  setEditingId(null);
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
                }
              }}
            />
          ) : (
            <li key={t.id} className="tx-row">
              <span
                className="tx-dot"
                style={{ background: t.category_color || "#64748b" }}
              />
              <div className="tx-main">
                <span className="tx-desc">
                  {t.description || t.category_name || "Ohne Beschreibung"}
                </span>
                <span className="tx-meta">
                  {formatDate(t.date)}
                  {t.category_name ? ` · ${t.category_name}` : ""}
                  {t.source === "csv" ? " · Import" : ""}
                </span>
              </div>
              <span className={`tx-amount ${t.type}`}>
                {formatSigned(t.amount, t.type)}
              </span>
              <div className="tx-actions">
                <button title="Bearbeiten" onClick={() => setEditingId(t.id)}>
                  ✎
                </button>
                <button
                  title="Löschen"
                  className="danger"
                  onClick={async () => {
                    if (!confirm("Diese Buchung wirklich löschen?")) return;
                    try {
                      await onDelete(t.id);
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  );
}

function EditRow({
  tx,
  categories,
  onSave,
  onCancel,
}: {
  tx: Transaction;
  categories: Category[];
  onSave: (input: TransactionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(tx.amount).replace(".", ","));
  const [categoryId, setCategoryId] = useState(String(tx.category_id ?? ""));
  const [date, setDate] = useState(tx.date);
  const [description, setDescription] = useState(tx.description);
  const visible = categories.filter((c) => c.type === tx.type);

  return (
    <li className="tx-row editing">
      <input
        className="edit-amount"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">– keine –</option>
        {visible.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <input
        className="grow"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="tx-actions">
        <button
          onClick={() => {
            const amt = parseAmount(amount);
            if (amt == null || amt <= 0) {
              alert("Bitte einen gültigen Betrag größer als 0 eingeben.");
              return;
            }
            onSave({
              date,
              type: tx.type,
              amount: amt,
              category_id: categoryId ? Number(categoryId) : null,
              description: description.trim(),
            });
          }}
        >
          ✓
        </button>
        <button onClick={onCancel}>↩</button>
      </div>
    </li>
  );
}
