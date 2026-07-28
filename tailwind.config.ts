import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Übergeordnete Theme-Farbe der App: seriöses Anthrazit.
        // Gilt für alles Allgemeine — Buttons, Fokus-Ringe, Login, Dialoge.
        brand: {
          // 50/100 bewusst nicht fast-weiss: sie tragen Auswahl-Zustaende
          // (z. B. ausgewaehlte Person im EntrySheet) und muessen sich vom
          // Seitenhintergrund #F5F5F2 sichtbar abheben.
          50:  '#E9ECEF',
          100: '#DDE2E7',
          200: '#C3CAD2',
          400: '#8B939C',
          500: '#5F6871',
          600: '#3C444D',
          700: '#2E353C',
          800: '#22282E',
        },
        // Bereichsfarben — nur zum Unterscheiden der beiden Welten
        // (Tab-Leiste, Header-Symbol, Welt-Umschalter). Sonst nirgends.
        shared: {
          50:  '#F4F3FF',
          100: '#EBE9FE',
          200: '#D0CCFF',
          400: '#9896F0',
          500: '#7876E8',
          600: '#5856D6',
          700: '#4645C0',
          800: '#3634A8',
        },
        personal: {
          50:  '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        'soft':    '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
        'card':    '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
        'card-lg': '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        '2.5xl': '20px',
        '3xl':   '24px',
        '4xl':   '32px',
      },
    },
  },
  plugins: [],
} satisfies Config
