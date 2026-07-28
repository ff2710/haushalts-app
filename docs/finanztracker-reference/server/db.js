import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "finanztracker.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Schema (idempotent) — beim Start ausgeführt.
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    type           TEXT NOT NULL CHECK (type IN ('income','expense')),
    color          TEXT NOT NULL DEFAULT '#8884d8',
    monthly_budget REAL,
    UNIQUE (name, type)
  );

  CREATE TABLE IF NOT EXISTS import_batches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    filename    TEXT NOT NULL,
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),
    row_count   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    date            TEXT NOT NULL,                 -- ISO YYYY-MM-DD
    type            TEXT NOT NULL CHECK (type IN ('income','expense')),
    amount          REAL NOT NULL CHECK (amount >= 0),
    category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    description     TEXT NOT NULL DEFAULT '',
    source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','csv')),
    import_batch_id INTEGER REFERENCES import_batches(id) ON DELETE CASCADE,
    dedup_key       TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_tx_dedup ON transactions(dedup_key);

  CREATE TABLE IF NOT EXISTS monthly_plan (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month       TEXT NOT NULL UNIQUE,         -- YYYY-MM
    planned_income   REAL NOT NULL DEFAULT 0,
    planned_expense  REAL NOT NULL DEFAULT 0,
    notes            TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS savings_goals (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    target_amount  REAL NOT NULL CHECK (target_amount > 0),
    current_amount REAL NOT NULL DEFAULT 0,
    target_date    TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Sichere Nachrüst-Migrationen für bereits existierende Datenbanken:
// fehlende Spalten additiv ergänzen (ALTER TABLE ist idempotent-geschützt).
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn("savings_goals", "current_amount", "REAL NOT NULL DEFAULT 0");
// Herkunft einer übernommenen Buchung (z. B. "fixed_cost:3" / "recurring_income:5")
// — dient der pro-Eintrag-genauen Idempotenz beim „übernehmen".
ensureColumn("transactions", "source_ref", "TEXT");

// Ein paar sinnvolle Standard-Kategorien beim allerersten Start anlegen.
const catCount = db.prepare("SELECT COUNT(*) AS n FROM categories").get();
if (catCount.n === 0) {
  const insert = db.prepare(
    "INSERT INTO categories (name, type, color) VALUES (?, ?, ?)"
  );
  const seed = [
    ["Gehalt", "income", "#16a34a"],
    ["Sonstige Einnahmen", "income", "#22c55e"],
    ["Lebensmittel", "expense", "#ef4444"],
    ["Miete & Wohnen", "expense", "#f97316"],
    ["Mobilität", "expense", "#eab308"],
    ["Freizeit", "expense", "#8b5cf6"],
    ["Abos & Verträge", "expense", "#ec4899"],
    ["Sonstiges", "expense", "#64748b"],
  ];
  const tx = db.transaction((rows) => rows.forEach((r) => insert.run(...r)));
  tx(seed);
}

// --- Planungs-Ebene (v1.2): Fixkosten, regelmäßige Einnahmen, Schätzung ----
db.exec(`
  CREATE TABLE IF NOT EXISTS fixed_costs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    amount      REAL NOT NULL CHECK (amount >= 0),
    cadence     TEXT NOT NULL CHECK (cadence IN ('monthly','quarterly','half_yearly','yearly','once')),
    due_month   TEXT,                              -- YYYY-MM (nicht-monatliche)
    start_month TEXT,                              -- YYYY-MM ("ab wann zurücklegen")
    amortize    INTEGER NOT NULL DEFAULT 1,        -- bool: auf monatlich umrechnen
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recurring_income (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    amount      REAL NOT NULL CHECK (amount >= 0),
    start_month TEXT NOT NULL,                     -- YYYY-MM
    end_month   TEXT,                              -- YYYY-MM, NULL = laufend
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS variable_estimates (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name   TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0
  );
`);

// Standard-Schätzposten beim ersten Start (editierbar).
const veCount = db.prepare("SELECT COUNT(*) AS n FROM variable_estimates").get();
if (veCount.n === 0) {
  const insertVe = db.prepare("INSERT INTO variable_estimates (name, amount) VALUES (?, ?)");
  const veTx = db.transaction(() => {
    insertVe.run("Leben", 400);
    insertVe.run("Spaß", 200);
  });
  veTx();
}
