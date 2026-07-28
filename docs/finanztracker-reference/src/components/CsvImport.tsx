import { useEffect, useMemo, useState } from "react";
import type { Category, ImportBatch, ImportRow, PreviewResult } from "../lib/types";
import { api } from "../lib/api";
import { parseCsv, parseDate, parseNumber, type ParsedCsv } from "../lib/csv";
import { formatDate, formatEuro } from "../lib/format";

type Step = "upload" | "map" | "review";

interface Props {
  categories: Category[];
  onImported: () => Promise<void>;
}

export default function CsvImport({ categories, onImported }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);

  // Mapping-Auswahl
  const [dateCol, setDateCol] = useState<number>(-1);
  const [amountCol, setAmountCol] = useState<number>(-1);
  const [descCol, setDescCol] = useState<number>(-1);
  const [negIsExpense, setNegIsExpense] = useState(true);
  const [categoryId, setCategoryId] = useState<string>("");

  // Review
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadBatches() {
    setBatches(await api.importBatches());
  }
  useEffect(() => {
    loadBatches();
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const p = parseCsv(String(reader.result));
      setParsed(p);
      // Spalten grob vorbelegen anhand üblicher Namen.
      p.headers.forEach((h, i) => {
        const low = h.toLowerCase();
        if (dateColGuess(low) && dateCol === -1) setDateCol(i);
        if (/betrag|amount|umsatz|wert/.test(low)) setAmountCol(i);
        if (/verwendung|beschreib|buchungstext|description|zweck|name|empf/.test(low)) setDescCol(i);
      });
      setStep("map");
    };
    reader.readAsText(file, "utf-8");
  }

  // Aus dem Mapping die strukturierten Import-Zeilen bauen.
  const builtRows = useMemo<ImportRow[]>(() => {
    if (!parsed || dateCol < 0 || amountCol < 0) return [];
    const out: ImportRow[] = [];
    for (const r of parsed.rows) {
      const date = parseDate(r[dateCol] ?? "");
      const num = parseNumber(r[amountCol] ?? "");
      if (!date || num == null || num === 0) continue;
      const isExpense = negIsExpense ? num < 0 : num > 0;
      out.push({
        date,
        type: isExpense ? "expense" : "income",
        amount: Math.abs(num),
        description: descCol >= 0 ? (r[descCol] ?? "").trim() : "",
      });
    }
    return out;
  }, [parsed, dateCol, amountCol, descCol, negIsExpense]);

  async function goToReview() {
    setError(null);
    if (builtRows.length === 0) {
      setError("Keine gültigen Zeilen erkannt. Prüfe die Spalten-Zuordnung.");
      return;
    }
    try {
      const result = await api.importPreview(builtRows);
      setPreview(result);
      // Standard: alle Nicht-Dubletten ausgewählt, Dubletten übersprungen.
      setSelected(new Set(result.rows.filter((r) => !r.duplicate).map((r) => r.index)));
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vorschau fehlgeschlagen.");
    }
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  async function commit() {
    if (!preview) return;
    const rows = preview.rows.filter((r) => selected.has(r.index)).map((r) => ({
      date: r.date,
      type: r.type,
      amount: r.amount,
      description: r.description,
    }));
    if (rows.length === 0) {
      setError("Nichts ausgewählt.");
      return;
    }
    setError(null);
    try {
      const res = await api.importCommit(filename, rows, categoryId ? Number(categoryId) : null);
      setMessage(`${res.imported} Buchungen importiert.`);
      reset();
      await Promise.all([loadBatches(), onImported()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import fehlgeschlagen.");
    }
  }

  function reset() {
    setStep("upload");
    setParsed(null);
    setPreview(null);
    setDateCol(-1);
    setAmountCol(-1);
    setDescCol(-1);
    setCategoryId("");
    setFilename("");
  }

  async function undoBatch(b: ImportBatch) {
    if (!confirm(`Import "${b.filename}" (${b.row_count} Buchungen) rückgängig machen?`)) return;
    await api.deleteImportBatch(b.id);
    await Promise.all([loadBatches(), onImported()]);
  }

  return (
    <div className="import-view">
      <div className="card">
        <h3 className="section-title">CSV-Import</h3>

        {message && <p className="import-success">✓ {message}</p>}
        {error && <p className="form-error">{error}</p>}

        {step === "upload" && (
          <div className="import-upload">
            <p className="muted-note">
              Lade einen Kontoauszug als CSV hoch. Im nächsten Schritt ordnest du die
              Spalten zu. Bereits erfasste Buchungen werden automatisch als Dubletten
              erkannt und nicht doppelt gezählt.
            </p>
            <label className="file-drop">
              <input type="file" accept=".csv,text/csv" onChange={handleFile} />
              <span>📄 CSV-Datei auswählen</span>
            </label>
          </div>
        )}

        {step === "map" && parsed && (
          <div className="import-map">
            <p className="muted-note">Datei: <strong>{filename}</strong> · {parsed.rows.length} Zeilen erkannt</p>
            <div className="map-grid">
              <ColSelect label="Datum" headers={parsed.headers} value={dateCol} onChange={setDateCol} />
              <ColSelect label="Betrag" headers={parsed.headers} value={amountCol} onChange={setAmountCol} />
              <ColSelect label="Beschreibung" headers={parsed.headers} value={descCol} onChange={setDescCol} optional />
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={negIsExpense} onChange={(e) => setNegIsExpense(e.target.checked)} />
              Negative Beträge sind Ausgaben (üblich bei Kontoauszügen)
            </label>
            <label className="field" style={{ maxWidth: 260 }}>
              <span>Kategorie für alle (optional)</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">– keine –</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.type === "income" ? "E" : "A"})</option>
                ))}
              </select>
            </label>

            <div className="map-preview">
              <span className="muted-note">Vorschau ({builtRows.length} gültige Zeilen):</span>
              <ul className="mini-preview">
                {builtRows.slice(0, 3).map((r, i) => (
                  <li key={i}>
                    {formatDate(r.date)} · {r.type === "income" ? "+" : "−"}{formatEuro(r.amount)} · {r.description || "—"}
                  </li>
                ))}
              </ul>
            </div>

            <div className="import-actions">
              <button className="mini-btn" onClick={reset}>Zurück</button>
              <button className="submit-btn" onClick={goToReview}>Weiter zur Prüfung</button>
            </div>
          </div>
        )}

        {step === "review" && preview && (
          <div className="import-review">
            <p className="review-summary">
              {selected.size} von {preview.total} werden importiert.{" "}
              {preview.duplicates > 0 && (
                <span className="dup-note">{preview.duplicates} mögliche Dublette(n) erkannt und vorab übersprungen.</span>
              )}
            </p>
            <div className="review-table-wrap">
              <table className="review-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Datum</th>
                    <th>Betrag</th>
                    <th>Beschreibung</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.index} className={r.duplicate ? "is-dup" : ""}>
                      <td>
                        <input type="checkbox" checked={selected.has(r.index)} onChange={() => toggle(r.index)} />
                      </td>
                      <td>{formatDate(r.date)}</td>
                      <td className={`num ${r.type}`}>{r.type === "income" ? "+" : "−"}{formatEuro(r.amount)}</td>
                      <td className="desc-cell">{r.description || "—"}</td>
                      <td>{r.duplicate ? <span className="dup-badge" title={r.reason ?? ""}>Dublette</span> : <span className="new-badge">Neu</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="import-actions">
              <button className="mini-btn" onClick={() => setStep("map")}>Zurück</button>
              <button className="submit-btn" onClick={commit}>{selected.size} importieren</button>
            </div>
          </div>
        )}
      </div>

      {batches.length > 0 && (
        <div className="card">
          <h3 className="section-title">Frühere Importe</h3>
          <ul className="batch-list">
            {batches.map((b) => (
              <li key={b.id}>
                <span>📄 {b.filename}</span>
                <span className="muted">{b.row_count} Buchungen · {b.imported_at.slice(0, 16)}</span>
                <button className="cat-del" onClick={() => undoBatch(b)}>Rückgängig</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ColSelect({
  label,
  headers,
  value,
  onChange,
  optional,
}: {
  label: string;
  headers: string[];
  value: number;
  onChange: (v: number) => void;
  optional?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}{optional ? " (optional)" : ""}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value={-1}>– wählen –</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>{h || `Spalte ${i + 1}`}</option>
        ))}
      </select>
    </label>
  );
}

function dateColGuess(low: string): boolean {
  return /datum|date|buchung|valuta|wertstellung/.test(low);
}
