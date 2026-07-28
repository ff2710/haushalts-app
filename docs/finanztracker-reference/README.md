# Finanztracker — Referenz-Schnappschuss (Logik-Quelle)

**Nur zum Nachschlagen beim Portieren — nicht bauen, nicht deployen, nicht importieren.**

Dies ist eine eingefrorene Kopie des alten lokalen Finanztrackers (Express + better-sqlite3, React). Original liegt in `dev-workspace/finanztracker/` und wird nicht weitergebaut. Diese Kopie liegt hier im Repo, damit Claude Code die zu portierende Logik direkt zur Hand hat, ohne ordnerübergreifende Zugriffe.

## Was hier die relevante Logik ist

- `server/db.js` — Datenmodell (SQLite): `categories`, `transactions`, `monthly_plan`, `savings_goals`, `fixed_costs`, `recurring_income`, `variable_estimates`, `import_batches`. Vorlage fürs Supabase-`pf_`-Schema.
- `server/dedup.js` — **deterministische** Dubletten-Erkennung (Betrag + Datum ±3 Tage + normalisierter Text). Regel 1:1 übernehmen.
- `server/forecast.js` — Monatsend-Prognose-Logik.
- `server/index.js` — API-/Geschäftslogik (Endpunkte, Validierung).
- `src/lib/` — `amount.ts` (Beträge immer positiv, Richtung via type), `csv.ts` (Import-Parsing), `format.ts` (dt. Zahlenformat), `types.ts`.
- `src/components/` — bestehende UX als Referenz (QuickAdd, FixedCosts, RecurringIncome, SavingsGoals, VariableEstimate, Forecast, CsvImport, TransactionList, Dashboard).

## Wichtig beim Port

- SQLite → Supabase/Postgres: Tabellen mit Prefix `pf_` und `owner_id`-Scoping (RLS), siehe `../all-in-one-plan.md` §3.
- Die Backend-Logik (Express) entfällt — Supabase ist das Backend. Nur die *Regeln* (Dedup, Prognose, Kaskaden-Rechnung) und das Datenmodell portieren, nicht die Express-Endpunkte 1:1.

## Danach

Nach Abschluss der Phasen 1–3 (Umsätze, Fixkosten/Prognose, Kaskade) ist diese Referenz überflüssig und kann gelöscht werden.
