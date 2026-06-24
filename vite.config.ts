import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// WICHTIG: 'base' muss dem Namen deines GitHub-Repositories entsprechen.
// Beispiel: Repo "haushalts-app" -> base: '/haushalts-app/'
// Bei einem User-/Org-Page-Repo (z.B. username.github.io) stattdessen base: '/'
export default defineConfig({
  plugins: [react()],
  base: '/haushalts-app/',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
})
