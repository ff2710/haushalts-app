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
  PF_ACCOUNTS:    'pf_accounts',
  PF_CATEGORIES:  'pf_categories',
} as const

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

export const STORAGE_BUCKET = {
  AVATARS: 'avatars',
} as const

export const DEFAULT_UNITS = ['Stück', 'g', 'kg', 'L', 'ml', 'cl'] as const
