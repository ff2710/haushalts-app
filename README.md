# Haushalts-App

Eine private WebApp für zwei Personen – gemeinsame Einkaufsliste und Ausgabenverwaltung à la Splitwise. Änderungen erscheinen dank Supabase Realtime sofort bei beiden.

**Live:** [ff2710.github.io/haushalts-app](https://ff2710.github.io/haushalts-app)

---

## Features

**Einkaufsliste**
- Artikel mit Menge, Einheit, Laden und Kategorie erfassen
- Drei Ansichten: Alle / Nach Laden / Nach Kategorie
- Sortierung: Manuell per Drag-and-Drop, nach Datum oder Name
- Artikel abhaken und löschen

**Finanzen**
- Ausgaben erfassen (Betrag, Beschreibung, Datum, wer bezahlt, wer profitiert)
- Live-Saldo: wer schuldet wem wie viel
- Zahlungsausgleich vermerken + vollständiger Verlauf

**Einstellungen**
- Eigenes Profilbild und Name
- Läden, Kategorien und Einheiten verwalten

---

## Tech-Stack

React · TypeScript · Vite · Tailwind CSS · Supabase (Auth, PostgreSQL, Realtime) · GitHub Pages

---

## Lokaler Start

```bash
npm install
# .env mit VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY befüllen (siehe .env.example)
npm run dev
```

---

## Deployment — nur EIN Weg: GitHub Actions

Das Deployment läuft **ausschließlich automatisch** über GitHub Actions
(`.github/workflows/deploy.yml`). Es gibt bewusst **keinen** manuellen
`gh-pages`-Weg mehr, damit sich nicht zwei Mechanismen in die Quere kommen.

**So funktioniert es:**

1. Code nach `main` pushen → die Action baut und deployt automatisch.
2. Fertig. Nichts manuell bauen, kein `dist` committen.

**Einmalige Einrichtung (nur einmal nötig):**

1. **Settings → Pages → Build and deployment → Source:** auf **"GitHub Actions"** stellen.
   (NICHT "Deploy from a branch".)
2. **Settings → Secrets and variables → Actions** → diese zwei Repository-Secrets anlegen:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   Diese Werte werden beim Build eingebacken. Ohne sie zeigt die App eine
   Hinweisseite ("App nicht konfiguriert") statt einer weißen Seite.

**So vermeidest du künftig Chaos:**

- Es gibt genau eine Pages-Quelle: "GitHub Actions". Nie auf einen Branch umstellen.
- Deployt wird nur durch Push auf `main` (oder manuell im Actions-Tab via "Run workflow").
- Secrets sind die einzige Stelle für die Supabase-Zugangsdaten im Build — die
  lokale `.env` gilt nur für `npm run dev` auf deinem Rechner.
- Asset-Dateinamen enthalten einen Content-Hash (Vite-Default) → Browser laden
  nach jedem Deploy automatisch die neue Version, kein Cache-Problem.
