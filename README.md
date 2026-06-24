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
- Partner-Profil einsehen
- Läden, Kategorien und Einheiten verwalten
- Haushalt zurücksetzen

---

## Tech-Stack

React · TypeScript · Vite · Tailwind CSS · Supabase (Auth, PostgreSQL, Realtime, Storage) · GitHub Pages

---

## Lokaler Start

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY eintragen
npm run dev
```

---

## Deployment

Push auf `main` → GitHub Actions baut und deployt automatisch auf GitHub Pages. Keine manuellen Schritte nötig.

Voraussetzungen (einmalig in den Repo-Settings):
- **Pages → Source:** "GitHub Actions"
- **Secrets → Actions:** `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`
