export const REALTIME_CHANNEL = 'haushalt-realtime'

/** Eigener Channel fuer den Persoenlich-Bereich (getrennt vom gemeinsamen). */
export const REALTIME_CHANNEL_PERSONAL = 'personal-realtime'

export const SETTINGS_ID = 1

export const UNDO_DELAY_MS = 4000

export const TABLE = {
  SETTINGS:       'settings',
  PROFILES:       'profiles',
  STORES:         'stores',
  CATEGORIES:     'categories',
  SHOPPING_ITEMS: 'shopping_items',
  EXPENSES:       'expenses',
  SETTLEMENTS:    'settlements',
  UNITS:          'units',

  // Persoenlich-Bereich (privat pro Person, RLS owner_id = auth.uid())
  PF_ACCOUNTS:       'pf_accounts',
  PF_CATEGORIES:     'pf_categories',
  PF_TRANSACTIONS:   'pf_transactions',
  PF_IMPORT_BATCHES: 'pf_import_batches',

  // Planungs-Ebene (Phase 2)
  PF_FIXED_COSTS:        'pf_fixed_costs',
  PF_RECURRING_INCOME:   'pf_recurring_income',
  PF_VARIABLE_ESTIMATES: 'pf_variable_estimates',
  PF_MONTHLY_PLAN:       'pf_monthly_plan',
} as const

/** Obergrenze fuer die Umsaetze, aus denen der Ausgaben-Vorschlag der Prognose
 *  berechnet wird. Deckt bei realistischem Volumen weit mehr als die noetigen
 *  drei Vormonate ab. */
export const PF_SUGGESTION_SCAN_LIMIT = 1000

/** Wie viele Umsaetze die Liste initial laedt. */
export const PF_TX_PAGE_SIZE = 100

/** Standard-Kategorien, die beim ersten Oeffnen des Persoenlich-Bereichs
 *  je Person angelegt werden (Port aus dem Finanztracker). */
export const PF_DEFAULT_CATEGORIES = [
  { name: 'Gehalt',              type: 'income',  color: '#16a34a' },
  { name: 'Sonstige Einnahmen',  type: 'income',  color: '#22c55e' },
  { name: 'Lebensmittel',        type: 'expense', color: '#ef4444' },
  { name: 'Miete & Wohnen',      type: 'expense', color: '#f97316' },
  { name: 'Mobilität',           type: 'expense', color: '#eab308' },
  { name: 'Freizeit',            type: 'expense', color: '#8b5cf6' },
  { name: 'Abos & Verträge',     type: 'expense', color: '#ec4899' },
  { name: 'Sonstiges',           type: 'expense', color: '#64748b' },
] as const

/** Auswahlfarben fuer HAUPTkategorien. Unterkategorien bekommen keine eigene
 *  Farbe, sondern eine Abstufung der Elternfarbe (src/lib/categoryColors.ts) —
 *  sonst waere im Sankey nicht mehr zu sehen, was zu wem gehoert.
 *  Gut unterscheidbare Farbtoene, bewusst in gleicher Helligkeit gehalten,
 *  damit die abgeleiteten Stufen darueber noch Luft nach oben haben. */
export const PF_CATEGORY_COLORS = [
  '#ef4444', // Rot
  '#f97316', // Orange
  '#eab308', // Gelb
  '#16a34a', // Grün
  '#0ea5e9', // Hellblau
  '#3b82f6', // Blau
  '#8b5cf6', // Violett
  '#ec4899', // Pink
  '#14b8a6', // Türkis
  '#64748b', // Grau
] as const

export const STORAGE_BUCKET = {
  AVATARS: 'avatars',
} as const

export const DEFAULT_UNITS = ['Stück', 'g', 'kg', 'L', 'ml', 'cl'] as const
