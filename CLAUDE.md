# CLAUDE.md — All-in-One Finanz- & Haushalts-App

Projektregeln für Claude Code in diesem Repo. Voller Bauplan: `docs/all-in-one-plan.md` (Phasen, Datenmodell, Reihenfolge). Diese Datei = Stack + Konventionen + nicht verhandelbare Regeln.

## Zweck

Ehemals reine „Haushalts-App", jetzt der **Bau-Stamm für die ultimative persönliche Finanz- & Haushalts-WebApp** — für Fidel, und nutzbar von Caro für ihre eigenen persönlichen Finanzen. Zwei Bereiche:

- **Gemeinsam** (geteilt, beide sehen alles): Einkaufsliste + gemeinsame Ausgaben/Saldo. Bestand.
- **Persönlich** (privat pro Person, RLS-isoliert): portierter Finanztracker — Konten, Spar-Kaskade, Budgets, Töpfe, Prognose, Abo-Tracker, Vermögen/ETF, Reports.

Der alte Finanztracker (`dev-workspace/finanztracker/`) ist reine **Logik-Quelle** zum Portieren, wird nicht weitergebaut.

## Stack & Start

- **Frontend:** React + TypeScript + Vite + Tailwind. Animationen framer-motion, Drag&Drop dnd-kit.
- **Backend:** Supabase — Auth, Postgres, Realtime, Storage. Schema in `supabase/schema.sql`.
- **Start:** `npm install`, `.env` aus `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), `npm run dev`.
- **Deploy:** Push auf `main` → GitHub Actions → GitHub Pages. Automatisch.
- **Sprache im UI:** Deutsch. Beträge in Euro, deutsches Zahlenformat.

## Konventionen

- Supabase ist die Quelle der Wahrheit; keine Geschäftslogik doppelt.
- **Gemeinsam-Tabellen:** RLS `authenticated_all` (Bestand: `settings`, `stores`, `categories`, `shopping_items`, `expenses`, `settlements`).
- **Persönlich-Tabellen:** Prefix `pf_`, Spalte `owner_id uuid not null references auth.users(id) default auth.uid()`, RLS `using (owner_id = auth.uid()) with check (owner_id = auth.uid())`.
- Schema-Änderungen idempotent (`create table if not exists`, Policies `drop policy if exists` davor).
- Neue realtime-relevante Tabellen zur Publication + `replica identity full` hinzufügen (Muster siehe `schema.sql`).
- Datum ISO `YYYY-MM-DD`, Monat `YYYY-MM`.

## Nicht verhandelbar (bei Geld)

- **Bestandsdaten unantastbar:** Live-Daten der Gemeinsam-Tabellen (Einkaufsliste, `expenses`, `settlements` → Saldo/Schuldenstand) werden nie gelöscht/überschrieben. Alle Schema-Änderungen additiv & idempotent — kein `drop`/`rewrite` bestehender Tabellen/Spalten, keine destruktiven Migrationen. Vor der ersten Schema-Änderung Voll-Backup ziehen.
- Transaktionsbeträge **immer positiv**; Richtung über `type` (`income`|`expense`). Nie negativ in der DB.
- Dubletten-Erkennung **deterministisch/regelbasiert** (Betrag + Datum ±3 Tage + normalisierter Text), nie geraten. Verdächtiges → Review-Screen, Mensch entscheidet, nichts still doppelt/gelöscht.
- Löschen/Überschreiben nachvollziehbar: Import = rückgängig machbarer Batch (`pf_import_batches`).
- **RLS-Isolation strikt:** Privatdaten sieht die Partnerin nie. Kein Service-Role-Key im Frontend. Gegen Leaks testen (User B darf Zeilen von User A nie lesen).
- **Repo ist öffentlich:** Backups/Exporte mit echten Daten (Namen, E-Mails, Ausgaben) dürfen **nie** in den Repo-Baum. Außerhalb ablegen; `docs/backups/` ist gitignored. Gilt auch für die spätere „Backup jetzt"-Funktion (Phase 7) — schreibt nie ins Repo.
- **Backup:** Export-Funktion (kompletter Bestand als JSON/CSV) ist Pflichtteil, kein Nice-to-have.

## Review

Vor „fertig" je Feature-Häppchen den globalen `code-reviewer`-Agent über die Änderungen laufen lassen; er liest diese Datei als Projektregeln.
