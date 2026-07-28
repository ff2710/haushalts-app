# Finanztracker

> **Hinweis (28.07.2026):** Dieses Projekt wird nicht mehr eigenständig
> weitergebaut. Es verschmilzt in die All-in-One Finanz- & Haushalts-App
> (Bau-Stamm: `Coding/Haushalts App/`, Supabase). Dieser Ordner dient nur
> noch als **Logik-Quelle** zum Portieren. Bauplan:
> `Coding/Haushalts App/docs/all-in-one-plan.md`.

Persönliches, lokales Finanzmanagement-Tool für Fidel. Oberstes Ziel:
**einfache tägliche Maintenance** (Umsätze schnell erfassen), interaktives,
intuitives Dashboard. Vollständiger Entwicklungsplan:
`~/.claude/plans/eventual-swimming-cosmos.md`.

## Stack & Start
- **Frontend:** React + Vite + TypeScript (`src/`), Charts mit Recharts.
- **Backend:** Express + better-sqlite3 (`server/`), Daten in lokaler
  SQLite-Datei `finanztracker.db` (nicht eingecheckt, siehe `.gitignore`).
- **Start:** `npm run dev` → Backend (Port 3001) + Frontend (Port 5173) parallel.
  Vite proxyt `/api` ans Backend.
- Sprache im UI: **Deutsch**. Beträge in Euro, deutsches Zahlenformat.

## Konventionen
- Backend ist die einzige Quelle der Wahrheit für Daten; Frontend spricht nur
  über `/api/*` mit ihm. Keine Geschäftslogik doppelt im Frontend.
- Beträge in `transactions.amount` immer **positiv** speichern; Richtung über
  `type` (`income`|`expense`). Nie negative Beträge in die DB.
- Geldwerte als `REAL` (Euro). Für Anzeige runden, nicht in der DB.
- Datum als ISO-String `YYYY-MM-DD`, Monat als `YYYY-MM`.
- Schema-Änderungen idempotent in `server/db.js` (CREATE TABLE IF NOT EXISTS).

## Datenmodell (SQLite)
`categories`, `transactions`, `monthly_plan`, `savings_goals`, `import_batches`
— Felder siehe `server/db.js`.

## Wichtige Prinzipien (bei Geld nicht verhandelbar)
- **Dubletten-Erkennung ist deterministisch/regelbasiert**, nie „geraten".
  Regel: gleicher Betrag + Datum ±3 Tage + normalisierter Text. Verdächtige
  Dubletten kommen in einen Review-Screen; der Mensch entscheidet. Nichts wird
  still doppelt gezählt oder gelöscht.
- Löschen/Überschreiben von Finanzdaten immer nachvollziehbar (Import als
  rückgängig machbarer Batch).

## Roadmap (noch nicht gebaut)
- **v2:** eingebauter KI-Agent (Express-Proxy zur Anthropic-API, Key nur im
  Backend-`.env`, nie im Frontend). Vor dem Bau `claude-api`-Skill lesen.
- **v3:** Supabase für Teilen mit Freundin + Geräte-Sync.

## Review
Vor „fertig" den globalen `code-reviewer`-Agent über die Änderungen laufen
lassen; er liest diese Datei als Projektregeln.
