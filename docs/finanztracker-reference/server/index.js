import express from "express";
import { db } from "./db.js";
import { makeDedupKey, findDuplicate } from "./dedup.js";
import { monthlyContribution, isDueInMonth } from "./forecast.js";

const app = express();
// Höheres Limit, damit auch große Kontoauszüge (viele Zeilen als JSON) durchgehen.
app.use(express.json({ limit: "10mb" }));

// --- Health ------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM transactions").get();
  res.json({ ok: true, transactions: n });
});

// --- Kategorien --------------------------------------------------------
app.get("/api/categories", (_req, res) => {
  const rows = db.prepare("SELECT * FROM categories ORDER BY type, name").all();
  res.json(rows);
});

function parseCategory(body) {
  const { name, type, color, monthly_budget } = body ?? {};
  if (!name || !String(name).trim()) return { error: "Name fehlt." };
  if (type !== "income" && type !== "expense") return { error: "Typ ungültig." };
  let budget = null;
  if (monthly_budget != null && monthly_budget !== "") {
    budget = Number(monthly_budget);
    if (!Number.isFinite(budget) || budget < 0) return { error: "Budget ungültig." };
  }
  return {
    value: {
      name: String(name).trim(),
      type,
      color: color || "#8884d8",
      monthly_budget: budget,
    },
  };
}

app.post("/api/categories", (req, res) => {
  const parsed = parseCategory(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const info = db
      .prepare(
        "INSERT INTO categories (name, type, color, monthly_budget) VALUES (@name, @type, @color, @monthly_budget)"
      )
      .run(parsed.value);
    res.status(201).json(db.prepare("SELECT * FROM categories WHERE id = ?").get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return res.status(409).json({ error: "Kategorie existiert bereits." });
    throw e;
  }
});

app.put("/api/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Nicht gefunden." });
  const parsed = parseCategory(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  db.prepare(
    "UPDATE categories SET name=@name, type=@type, color=@color, monthly_budget=@monthly_budget WHERE id=@id"
  ).run({ ...parsed.value, id });
  res.json(db.prepare("SELECT * FROM categories WHERE id = ?").get(id));
});

app.delete("/api/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  // Transaktionen behalten ihre Historie; category_id wird per ON DELETE SET NULL gelöst.
  const info = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ error: "Nicht gefunden." });
  res.json({ ok: true });
});

// --- Monatsplan --------------------------------------------------------
app.get("/api/monthly-plan/:month", (req, res) => {
  const month = req.params.month;
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Monat YYYY-MM erwartet." });
  const row = db.prepare("SELECT * FROM monthly_plan WHERE year_month = ?").get(month);
  res.json(row ?? { year_month: month, planned_income: 0, planned_expense: 0, notes: "" });
});

app.put("/api/monthly-plan/:month", (req, res) => {
  const month = req.params.month;
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Monat YYYY-MM erwartet." });
  const income = Math.max(0, Number(req.body?.planned_income) || 0);
  const expense = Math.max(0, Number(req.body?.planned_expense) || 0);
  const notes = String(req.body?.notes ?? "");
  db.prepare(
    `INSERT INTO monthly_plan (year_month, planned_income, planned_expense, notes)
     VALUES (@month, @income, @expense, @notes)
     ON CONFLICT(year_month) DO UPDATE SET
       planned_income=@income, planned_expense=@expense, notes=@notes`
  ).run({ month, income, expense, notes });
  res.json(db.prepare("SELECT * FROM monthly_plan WHERE year_month = ?").get(month));
});

// --- Dashboard-Aggregationen ------------------------------------------
app.get("/api/summary/:month", (req, res) => {
  const month = req.params.month;
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Monat YYYY-MM erwartet." });

  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type='income'  THEN amount END), 0) AS income,
         COALESCE(SUM(CASE WHEN type='expense' THEN amount END), 0) AS expense
       FROM transactions WHERE substr(date,1,7) = ?`
    )
    .get(month);

  const byCategory = db
    .prepare(
      `SELECT COALESCE(c.name,'Ohne Kategorie') AS name,
              COALESCE(c.color,'#64748b') AS color,
              SUM(t.amount) AS total
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.type='expense' AND substr(t.date,1,7) = ?
       GROUP BY t.category_id
       ORDER BY total DESC`
    )
    .all(month);

  const byIncomeCategory = db
    .prepare(
      `SELECT COALESCE(c.name,'Ohne Kategorie') AS name,
              COALESCE(c.color,'#64748b') AS color,
              SUM(t.amount) AS total
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.type='income' AND substr(t.date,1,7) = ?
       GROUP BY t.category_id
       ORDER BY total DESC`
    )
    .all(month);

  const plan = db.prepare("SELECT * FROM monthly_plan WHERE year_month = ?").get(month);

  res.json({
    month,
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
    planned_income: plan?.planned_income ?? 0,
    planned_expense: plan?.planned_expense ?? 0,
    byCategory,
    byIncomeCategory,
  });
});

// Verlauf der letzten N Monate (inkl. aktuellem).
app.get("/api/trend", (req, res) => {
  const n = Math.min(24, Math.max(1, Number(req.query.months) || 6));
  const rows = db
    .prepare(
      `SELECT substr(date,1,7) AS month,
              COALESCE(SUM(CASE WHEN type='income'  THEN amount END),0) AS income,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) AS expense
       FROM transactions
       GROUP BY month`
    )
    .all();
  const map = new Map(rows.map((r) => [r.month, r]));

  // Lückenlose Reihe der letzten n Monate erzeugen.
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const r = map.get(m);
    out.push({ month: m, income: r?.income ?? 0, expense: r?.expense ?? 0 });
  }
  res.json(out);
});

// --- Transaktionen -----------------------------------------------------

// Liste, optional nach Monat gefiltert (?month=YYYY-MM). Neueste zuerst.
app.get("/api/transactions", (req, res) => {
  const { month } = req.query;
  const base = `
    SELECT t.*, c.name AS category_name, c.color AS category_color
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
  `;
  const rows = month
    ? db
        .prepare(base + " WHERE substr(t.date,1,7) = ? ORDER BY t.date DESC, t.id DESC")
        .all(month)
    : db.prepare(base + " ORDER BY t.date DESC, t.id DESC").all();
  res.json(rows);
});

// Validierung einer eingehenden Transaktion. Gibt {error} oder ein sauberes
// Objekt zurück.
function parseTransaction(body) {
  const { date, type, amount, category_id, description } = body ?? {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Ungültiges Datum (YYYY-MM-DD erwartet)." };
  if (type !== "income" && type !== "expense") return { error: "Typ muss 'income' oder 'expense' sein." };
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return { error: "Betrag muss eine positive Zahl sein." };
  const cat = category_id == null ? null : Number(category_id);
  if (cat != null && !Number.isInteger(cat)) return { error: "Ungültige Kategorie." };
  return {
    value: {
      date,
      type,
      amount: Math.round(amt * 100) / 100,
      category_id: cat,
      description: String(description ?? "").trim(),
    },
  };
}

// Neu anlegen (manuell).
app.post("/api/transactions", (req, res) => {
  const parsed = parseTransaction(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const v = parsed.value;
  const dedup_key = makeDedupKey(v);
  const info = db
    .prepare(
      `INSERT INTO transactions (date, type, amount, category_id, description, source, dedup_key)
       VALUES (@date, @type, @amount, @category_id, @description, 'manual', @dedup_key)`
    )
    .run({ ...v, dedup_key });
  const row = db.prepare("SELECT * FROM transactions WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

// Bearbeiten.
app.put("/api/transactions/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Nicht gefunden." });
  const parsed = parseTransaction(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const v = parsed.value;
  const dedup_key = makeDedupKey(v);
  db.prepare(
    `UPDATE transactions
     SET date=@date, type=@type, amount=@amount, category_id=@category_id,
         description=@description, dedup_key=@dedup_key
     WHERE id=@id`
  ).run({ ...v, dedup_key, id });
  res.json(db.prepare("SELECT * FROM transactions WHERE id = ?").get(id));
});

// Löschen.
app.delete("/api/transactions/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ error: "Nicht gefunden." });
  res.json({ ok: true });
});

// --- Sparziele ---------------------------------------------------------
app.get("/api/savings-goals", (_req, res) => {
  res.json(db.prepare("SELECT * FROM savings_goals ORDER BY created_at").all());
});

app.post("/api/savings-goals", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const target = Number(req.body?.target_amount);
  const target_date = req.body?.target_date || null;
  if (!name) return res.status(400).json({ error: "Name fehlt." });
  if (!Number.isFinite(target) || target <= 0) return res.status(400).json({ error: "Zielbetrag muss > 0 sein." });
  const info = db
    .prepare("INSERT INTO savings_goals (name, target_amount, target_date) VALUES (?, ?, ?)")
    .run(name, Math.round(target * 100) / 100, target_date);
  res.status(201).json(db.prepare("SELECT * FROM savings_goals WHERE id = ?").get(info.lastInsertRowid));
});

app.put("/api/savings-goals/:id", (req, res) => {
  const id = Number(req.params.id);
  const g = db.prepare("SELECT * FROM savings_goals WHERE id = ?").get(id);
  if (!g) return res.status(404).json({ error: "Nicht gefunden." });
  const name = String(req.body?.name ?? g.name).trim();
  const target = Number(req.body?.target_amount ?? g.target_amount);
  const target_date = req.body?.target_date ?? g.target_date;
  if (!name) return res.status(400).json({ error: "Name fehlt." });
  if (!Number.isFinite(target) || target <= 0) return res.status(400).json({ error: "Zielbetrag muss > 0 sein." });
  db.prepare("UPDATE savings_goals SET name=?, target_amount=?, target_date=? WHERE id=?").run(
    name,
    Math.round(target * 100) / 100,
    target_date,
    id
  );
  res.json(db.prepare("SELECT * FROM savings_goals WHERE id = ?").get(id));
});

// Einzahlung/Abhebung auf ein Ziel (delta darf negativ sein), nie unter 0.
app.post("/api/savings-goals/:id/contribute", (req, res) => {
  const id = Number(req.params.id);
  const g = db.prepare("SELECT * FROM savings_goals WHERE id = ?").get(id);
  if (!g) return res.status(404).json({ error: "Nicht gefunden." });
  const delta = Number(req.body?.amount);
  if (!Number.isFinite(delta)) return res.status(400).json({ error: "Betrag ungültig." });
  const next = Math.max(0, Math.round((g.current_amount + delta) * 100) / 100);
  db.prepare("UPDATE savings_goals SET current_amount=? WHERE id=?").run(next, id);
  res.json(db.prepare("SELECT * FROM savings_goals WHERE id = ?").get(id));
});

app.delete("/api/savings-goals/:id", (req, res) => {
  const info = db.prepare("DELETE FROM savings_goals WHERE id = ?").run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: "Nicht gefunden." });
  res.json({ ok: true });
});

// --- CSV-Import --------------------------------------------------------

// Eingehende Zeilen validieren (vom Frontend bereits strukturiert).
function normalizeImportRows(rows) {
  const clean = [];
  const errors = [];
  (rows ?? []).forEach((r, i) => {
    const parsed = parseTransaction(r);
    if (parsed.error) errors.push({ index: i, error: parsed.error });
    else clean.push({ ...parsed.value, _index: i });
  });
  return { clean, errors };
}

// Vorschau: markiert jede Zeile als Dublette (gegen DB) oder als Dublette
// innerhalb der Datei selbst. Schreibt noch nichts.
app.post("/api/import/preview", (req, res) => {
  const { clean, errors } = normalizeImportRows(req.body?.rows);
  const seen = new Map(); // dedup_key -> erster Index in dieser Datei
  const result = clean.map((row) => {
    const key = makeDedupKey(row);
    const dbMatch = findDuplicate(db, row);
    const inFileDup = seen.has(key);
    if (!seen.has(key)) seen.set(key, row._index);
    return {
      index: row._index,
      date: row.date,
      type: row.type,
      amount: row.amount,
      description: row.description,
      duplicate: Boolean(dbMatch) || inFileDup,
      reason: dbMatch
        ? "Bereits erfasst (gleicher Betrag, Datum ±3 Tage, Text)"
        : inFileDup
        ? "Doppelt in dieser Datei"
        : null,
      matched: dbMatch ? { id: dbMatch.id, date: dbMatch.date, description: dbMatch.description } : null,
    };
  });
  const dupCount = result.filter((r) => r.duplicate).length;
  res.json({ rows: result, total: result.length, duplicates: dupCount, errors });
});

// Commit: schreibt die ausgewählten Zeilen als ein rückgängig machbares Batch.
app.post("/api/import/commit", (req, res) => {
  const filename = String(req.body?.filename ?? "import.csv");
  const category_id = req.body?.category_id != null ? Number(req.body.category_id) : null;
  const { clean, errors } = normalizeImportRows(req.body?.rows);
  if (clean.length === 0) return res.status(400).json({ error: "Keine gültigen Zeilen zum Import.", errors });

  const insertBatch = db.prepare("INSERT INTO import_batches (filename, row_count) VALUES (?, ?)");
  const insertTx = db.prepare(
    `INSERT INTO transactions (date, type, amount, category_id, description, source, import_batch_id, dedup_key)
     VALUES (@date, @type, @amount, @category_id, @description, 'csv', @batch_id, @dedup_key)`
  );

  const run = db.transaction(() => {
    const batch = insertBatch.run(filename, clean.length);
    const batch_id = batch.lastInsertRowid;
    for (const row of clean) {
      insertTx.run({
        date: row.date,
        type: row.type,
        amount: row.amount,
        category_id: category_id ?? row.category_id ?? null,
        description: row.description,
        batch_id,
        dedup_key: makeDedupKey(row),
      });
    }
    return batch_id;
  });

  const batch_id = run();
  res.status(201).json({ ok: true, batch_id, imported: clean.length, errors });
});

app.get("/api/import-batches", (_req, res) => {
  res.json(db.prepare("SELECT * FROM import_batches ORDER BY imported_at DESC").all());
});

// Import rückgängig machen: löscht das Batch inkl. seiner Transaktionen (FK CASCADE).
app.delete("/api/import-batches/:id", (req, res) => {
  const info = db.prepare("DELETE FROM import_batches WHERE id = ?").run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: "Nicht gefunden." });
  res.json({ ok: true });
});

// --- Planung: Fixkosten / regelmäßige Einnahmen / Prognose -------------

const MONTH_RE = /^\d{4}-\d{2}$/;

// Wurde dieser konkrete Planungs-Eintrag (Fixkosten/regelmäßige Einnahme)
// in diesem Monat schon übernommen? Prüft die Herkunft (source_ref) — dadurch
// kollidieren zwei gleichartige Einträge NICHT (jeder bucht unabhängig genau
// einmal pro Monat).
function appliedInMonth(month, sourceRef) {
  const row = db
    .prepare("SELECT 1 FROM transactions WHERE substr(date,1,7)=? AND source_ref=? LIMIT 1")
    .get(month, sourceRef);
  return Boolean(row);
}

// Existiert die Kategorie? (null = keine Kategorie, ist erlaubt.)
function categoryExists(id) {
  if (id == null) return true;
  return Boolean(db.prepare("SELECT 1 FROM categories WHERE id=?").get(id));
}

// Betrag für einen regelmäßigen Einnahme-Eintrag im Monat M (0 wenn außerhalb).
function recurringAmountForMonth(ri, month) {
  if (!ri.active) return 0;
  if (month < ri.start_month) return 0;
  if (ri.end_month && month > ri.end_month) return 0;
  return Number(ri.amount) || 0;
}

// ---- Fixkosten ----
function parseFixedCost(body) {
  const name = String(body?.name ?? "").trim();
  const amount = Number(body?.amount);
  const cadence = body?.cadence;
  if (!name) return { error: "Name fehlt." };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Betrag ungültig." };
  if (!["monthly", "quarterly", "half_yearly", "yearly", "once"].includes(cadence))
    return { error: "Rhythmus ungültig." };
  const nonMonthly = cadence !== "monthly";
  const due_month = body?.due_month || null;
  const start_month = body?.start_month || null;
  if (nonMonthly && due_month && !MONTH_RE.test(due_month)) return { error: "Fälligkeitsmonat YYYY-MM erwartet." };
  if (start_month && !MONTH_RE.test(start_month)) return { error: "Startmonat YYYY-MM erwartet." };
  if (nonMonthly && !due_month) return { error: "Nicht-monatliche Fixkosten brauchen einen Fälligkeitsmonat." };
  if (nonMonthly && start_month && due_month && start_month > due_month)
    return { error: "Der Startmonat darf nicht nach dem Fälligkeitsmonat liegen." };
  const category_id = body?.category_id != null && body.category_id !== "" ? Number(body.category_id) : null;
  if (!categoryExists(category_id)) return { error: "Kategorie existiert nicht." };
  return {
    value: {
      name,
      amount: Math.round(amount * 100) / 100,
      cadence,
      due_month: nonMonthly ? due_month : null,
      start_month,
      amortize: body?.amortize ? 1 : 0,
      category_id,
    },
  };
}

function fixedCostView(fc, month) {
  return {
    ...fc,
    monthlyEquivalent: Math.round(monthlyContribution(fc, month) * 100) / 100,
    dueThisMonth: isDueInMonth(fc, month),
    appliedThisMonth: appliedInMonth(month, `fixed_cost:${fc.id}`),
  };
}

app.get("/api/fixed-costs", (req, res) => {
  const month = MONTH_RE.test(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
  const rows = db.prepare("SELECT * FROM fixed_costs ORDER BY name").all();
  res.json(rows.map((fc) => fixedCostView(fc, month)));
});

app.post("/api/fixed-costs", (req, res) => {
  const parsed = parseFixedCost(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const info = db
    .prepare(
      `INSERT INTO fixed_costs (name, amount, cadence, due_month, start_month, amortize, category_id)
       VALUES (@name, @amount, @cadence, @due_month, @start_month, @amortize, @category_id)`
    )
    .run(parsed.value);
  res.status(201).json(db.prepare("SELECT * FROM fixed_costs WHERE id = ?").get(info.lastInsertRowid));
});

app.put("/api/fixed-costs/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT id FROM fixed_costs WHERE id = ?").get(id)) return res.status(404).json({ error: "Nicht gefunden." });
  const parsed = parseFixedCost(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  db.prepare(
    `UPDATE fixed_costs SET name=@name, amount=@amount, cadence=@cadence, due_month=@due_month,
       start_month=@start_month, amortize=@amortize, category_id=@category_id WHERE id=@id`
  ).run({ ...parsed.value, id });
  res.json(db.prepare("SELECT * FROM fixed_costs WHERE id = ?").get(id));
});

app.delete("/api/fixed-costs/:id", (req, res) => {
  const info = db.prepare("DELETE FROM fixed_costs WHERE id = ?").run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: "Nicht gefunden." });
  res.json({ ok: true });
});

// Als echte Ausgabe übernehmen (dedup-geschützt, voller Betrag im Zielmonat).
app.post("/api/fixed-costs/:id/apply", (req, res) => {
  const id = Number(req.params.id);
  const fc = db.prepare("SELECT * FROM fixed_costs WHERE id = ?").get(id);
  if (!fc) return res.status(404).json({ error: "Nicht gefunden." });
  const month = MONTH_RE.test(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
  const sourceRef = `fixed_cost:${fc.id}`;
  if (appliedInMonth(month, sourceRef)) {
    return res.json({ ok: true, skipped: true, reason: "Für diesen Monat bereits übernommen." });
  }
  const row = { date: `${month}-01`, type: "expense", amount: fc.amount, category_id: fc.category_id, description: fc.name };
  db.prepare(
    `INSERT INTO transactions (date, type, amount, category_id, description, source, dedup_key, source_ref)
     VALUES (@date, @type, @amount, @category_id, @description, 'manual', @dedup_key, @source_ref)`
  ).run({ ...row, dedup_key: makeDedupKey(row), source_ref: sourceRef });
  res.status(201).json({ ok: true, skipped: false });
});

// ---- Regelmäßige Einnahmen ----
function parseRecurringIncome(body) {
  const amount = Number(body?.amount);
  const category_id = body?.category_id != null && body.category_id !== "" ? Number(body.category_id) : null;
  const start_month = body?.start_month;
  const end_month = body?.end_month || null;
  if (!Number.isFinite(amount) || amount < 0) return { error: "Betrag ungültig." };
  if (!start_month || !MONTH_RE.test(start_month)) return { error: "Startmonat YYYY-MM erwartet." };
  if (end_month && !MONTH_RE.test(end_month)) return { error: "Endmonat YYYY-MM erwartet." };
  if (end_month && end_month < start_month) return { error: "Endmonat liegt vor Startmonat." };
  if (!categoryExists(category_id)) return { error: "Kategorie existiert nicht." };
  return { value: { amount: Math.round(amount * 100) / 100, category_id, start_month, end_month } };
}

app.get("/api/recurring-income", (req, res) => {
  const month = MONTH_RE.test(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
  const rows = db
    .prepare(
      `SELECT ri.*, c.name AS category_name, c.color AS category_color
       FROM recurring_income ri LEFT JOIN categories c ON c.id = ri.category_id
       ORDER BY ri.start_month DESC`
    )
    .all();
  res.json(
    rows.map((ri) => ({
      ...ri,
      amountThisMonth: recurringAmountForMonth(ri, month),
      appliedThisMonth: appliedInMonth(month, `recurring_income:${ri.id}`),
    }))
  );
});

app.post("/api/recurring-income", (req, res) => {
  const parsed = parseRecurringIncome(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const info = db
    .prepare(
      `INSERT INTO recurring_income (category_id, amount, start_month, end_month)
       VALUES (@category_id, @amount, @start_month, @end_month)`
    )
    .run(parsed.value);
  res.status(201).json(db.prepare("SELECT * FROM recurring_income WHERE id = ?").get(info.lastInsertRowid));
});

app.put("/api/recurring-income/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT id FROM recurring_income WHERE id = ?").get(id)) return res.status(404).json({ error: "Nicht gefunden." });
  const parsed = parseRecurringIncome(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  db.prepare(
    `UPDATE recurring_income SET category_id=@category_id, amount=@amount, start_month=@start_month, end_month=@end_month WHERE id=@id`
  ).run({ ...parsed.value, id });
  res.json(db.prepare("SELECT * FROM recurring_income WHERE id = ?").get(id));
});

app.delete("/api/recurring-income/:id", (req, res) => {
  const info = db.prepare("DELETE FROM recurring_income WHERE id = ?").run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: "Nicht gefunden." });
  res.json({ ok: true });
});

app.post("/api/recurring-income/:id/apply", (req, res) => {
  const id = Number(req.params.id);
  const ri = db
    .prepare(
      "SELECT ri.*, c.name AS category_name FROM recurring_income ri LEFT JOIN categories c ON c.id = ri.category_id WHERE ri.id = ?"
    )
    .get(id);
  if (!ri) return res.status(404).json({ error: "Nicht gefunden." });
  const month = MONTH_RE.test(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
  const sourceRef = `recurring_income:${ri.id}`;
  if (appliedInMonth(month, sourceRef)) {
    return res.json({ ok: true, skipped: true, reason: "Für diesen Monat bereits übernommen." });
  }
  const desc = ri.category_name || "Einnahme";
  const row = { date: `${month}-01`, type: "income", amount: ri.amount, category_id: ri.category_id, description: desc };
  db.prepare(
    `INSERT INTO transactions (date, type, amount, category_id, description, source, dedup_key, source_ref)
     VALUES (@date, @type, @amount, @category_id, @description, 'manual', @dedup_key, @source_ref)`
  ).run({ ...row, dedup_key: makeDedupKey(row), source_ref: sourceRef });
  res.status(201).json({ ok: true, skipped: false });
});

// ---- Variable Schätzung ----
app.get("/api/variable-estimates", (_req, res) => {
  res.json(db.prepare("SELECT * FROM variable_estimates ORDER BY id").all());
});

// Komplette Liste ersetzen (einfachstes Modell für die Bearbeitung).
app.put("/api/variable-estimates", (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  for (const it of items) {
    if (!String(it?.name ?? "").trim()) return res.status(400).json({ error: "Name fehlt." });
    if (!Number.isFinite(Number(it?.amount)) || Number(it.amount) < 0) return res.status(400).json({ error: "Betrag ungültig." });
  }
  const replace = db.transaction(() => {
    db.prepare("DELETE FROM variable_estimates").run();
    const ins = db.prepare("INSERT INTO variable_estimates (name, amount) VALUES (?, ?)");
    for (const it of items) ins.run(String(it.name).trim(), Math.round(Number(it.amount) * 100) / 100);
  });
  replace();
  res.json(db.prepare("SELECT * FROM variable_estimates ORDER BY id").all());
});

// ---- Prognose ----
app.get("/api/forecast/:month", (req, res) => {
  const month = req.params.month;
  if (!MONTH_RE.test(month)) return res.status(400).json({ error: "Monat YYYY-MM erwartet." });

  const recs = db.prepare("SELECT * FROM recurring_income WHERE active = 1").all();
  const expectedIncome = recs.reduce((s, ri) => s + recurringAmountForMonth(ri, month), 0);

  const fixed = db.prepare("SELECT * FROM fixed_costs WHERE active = 1").all();
  const fixedBreakdown = fixed
    .map((fc) => ({ id: fc.id, name: fc.name, monthly: Math.round(monthlyContribution(fc, month) * 100) / 100 }))
    .filter((f) => f.monthly > 0);
  const fixedMonthly = fixedBreakdown.reduce((s, f) => s + f.monthly, 0);

  const veItems = db.prepare("SELECT * FROM variable_estimates").all();
  const variableEstimate = veItems.reduce((s, v) => s + (Number(v.amount) || 0), 0);

  // Vorschlag: Ø Gesamt-Ausgaben der letzten bis zu 3 Monate MIT Daten (ohne
  // den aktuellen Monat).
  const monthsWithExpense = db
    .prepare(
      `SELECT substr(date,1,7) AS m, SUM(amount) AS total
       FROM transactions WHERE type='expense' AND substr(date,1,7) < ?
       GROUP BY m ORDER BY m DESC LIMIT 3`
    )
    .all(month);
  const variableSuggestion =
    monthsWithExpense.length > 0
      ? Math.round((monthsWithExpense.reduce((s, r) => s + r.total, 0) / monthsWithExpense.length) * 100) / 100
      : null;

  res.json({
    month,
    expectedIncome: Math.round(expectedIncome * 100) / 100,
    fixedMonthly: Math.round(fixedMonthly * 100) / 100,
    fixedBreakdown,
    variableEstimate: Math.round(variableEstimate * 100) / 100,
    variableItems: veItems,
    leftover: Math.round((expectedIncome - fixedMonthly - variableEstimate) * 100) / 100,
    variableSuggestion,
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[server] Finanztracker-Backend läuft auf http://localhost:${PORT}`);
});
