export const REALTIME_CHANNEL = 'haushalt-realtime'

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
} as const

export const STORAGE_BUCKET = {
  AVATARS: 'avatars',
} as const

export const DEFAULT_UNITS = ['Stück', 'g', 'kg', 'L', 'ml', 'cl'] as const
