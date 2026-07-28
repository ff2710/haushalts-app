import { useCallback, useEffect, useState } from "react";
import type {
  Category,
  Forecast as ForecastData,
  Summary,
  Transaction,
  TransactionInput,
  TrendPoint,
} from "./lib/types";
import { api } from "./lib/api";
import { currentMonth, formatMonth } from "./lib/format";
import QuickAdd from "./components/QuickAdd";
import TransactionList from "./components/TransactionList";
import Dashboard from "./components/Dashboard";
import Settings from "./components/Settings";
import SavingsGoals from "./components/SavingsGoals";
import CsvImport from "./components/CsvImport";
import Forecast from "./components/Forecast";

type View = "overview" | "manage" | "import";

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<View>("overview");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const loadCategories = useCallback(async () => {
    setCategories(await api.categories());
  }, []);

  const loadMonthData = useCallback(async () => {
    const [tx, sum, tr, fc] = await Promise.all([
      api.transactions(month),
      api.summary(month),
      api.trend(6),
      api.forecast(month),
    ]);
    setTransactions(tx);
    setSummary(sum);
    setTrend(tr);
    setForecast(fc);
  }, [month]);

  useEffect(() => {
    (async () => {
      try {
        await loadCategories();
        await loadMonthData();
        setConnected(true);
      } catch {
        setConnected(false);
      }
    })();
  }, [loadCategories, loadMonthData]);

  // Sheet-Verhalten: Escape schließt, Hintergrund wird gegen Scrollen gesperrt.
  useEffect(() => {
    if (!addOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [addOpen]);

  async function handleAdd(input: TransactionInput) {
    await api.addTransaction(input);
    await loadMonthData();
  }
  async function handleUpdate(id: number, input: TransactionInput) {
    await api.updateTransaction(id, input);
    await loadMonthData();
  }
  async function handleDelete(id: number) {
    await api.deleteTransaction(id);
    await loadMonthData();
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>💰 Finanztracker</h1>
        </div>
        {connected === false ? (
          <span className="status-pill err">Backend nicht erreichbar</span>
        ) : connected ? (
          <span className="status-pill ok">Verbunden</span>
        ) : (
          <span className="status-pill">Verbinde …</span>
        )}
      </header>

      <div className="toolbar">
        <div className="month-nav">
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Vorheriger Monat">‹</button>
          <span className="month-label">{formatMonth(month)}</span>
          <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Nächster Monat">›</button>
        </div>
        <div className="view-tabs">
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>
            Übersicht
          </button>
          <button className={view === "manage" ? "active" : ""} onClick={() => setView("manage")}>
            Planung
          </button>
          <button className={view === "import" ? "active" : ""} onClick={() => setView("import")}>
            Import
          </button>
        </div>
      </div>

      {view === "overview" ? (
        <>
          <button className="add-trigger" onClick={() => setAddOpen(true)}>
            <span className="add-plus" aria-hidden="true">＋</span>
            Ausgabe / Einnahme erfassen
          </button>
          {forecast && <Forecast forecast={forecast} />}
          {summary && <Dashboard summary={summary} trend={trend} />}
          <SavingsGoals />
          <TransactionList
            transactions={transactions}
            categories={categories}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </>
      ) : view === "manage" ? (
        <Settings
          month={month}
          categories={categories}
          variableSuggestion={forecast?.variableSuggestion ?? null}
          onCategoriesChanged={loadCategories}
          onPlanChanged={loadMonthData}
        />
      ) : (
        <CsvImport categories={categories} onImported={loadMonthData} />
      )}

      {/* Fixierter Schnell-Button (v. a. Mobil): immer ohne Scrollen erreichbar. */}
      {view === "overview" && !addOpen && (
        <button className="fab" onClick={() => setAddOpen(true)} aria-label="Buchung erfassen">
          ＋
        </button>
      )}

      {/* Erfassungs-Sheet: Bottom-Sheet auf Mobil, Dialog auf Desktop. */}
      {addOpen && (
        <div className="sheet-backdrop" onClick={() => setAddOpen(false)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Buchung erfassen"
            onClick={(e) => e.stopPropagation()}
          >
            <QuickAdd
              categories={categories}
              onAdd={handleAdd}
              onRequestClose={() => setAddOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
