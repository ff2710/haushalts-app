import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// WICHTIG: 'base' muss dem Namen deines GitHub-Repositories entsprechen.
// Beispiel: Repo "haushalts-app" -> base: '/haushalts-app/'
// Bei einem User-/Org-Page-Repo (z.B. username.github.io) stattdessen base: '/'
export default defineConfig({
  plugins: [react()],
  base: '/haushalts-app/',
  // Keine festen Dateinamen: Vite vergibt Content-Hashes (z. B. index-a1b2c3.js).
  // Das ist der korrekte Cache-Buster — nach jedem Deploy aendert sich der
  // Dateiname, sodass Browser (auch Safari) garantiert die neue Version laden
  // statt einer veralteten, evtl. kaputten Datei aus dem Cache.
})
