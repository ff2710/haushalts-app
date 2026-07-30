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
  PF_CASH_LOCATIONS: 'pf_cash_locations',

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

/**
 * Standard-Kategorien, die beim ersten Oeffnen des Persoenlich-Bereichs je
 * Person angelegt werden.
 *
 * Bewusst nur HAUPTkategorien, und zwar nach der Frage geschnitten "wofuer ist
 * das Geld weg?" — nicht danach, wie es abgebucht wird. Deshalb gibt es hier
 * kein "Abos & Vertraege": Netflix ist Freizeit, die Hausratversicherung ist
 * Wohnen. Dass beides regelmaessig abgeht, ist eine Eigenschaft der Zahlung,
 * keine eigene Kategorie — sonst laege dieselbe Ausgabe je nach Zahlungsweise
 * in verschiedenen Toepfen und die Auswertung waere wertlos.
 *
 * Unterkategorien legt jede Person selbst an; ein Vorrat an geratenen
 * Unterkategorien waere vor allem Aufraeumarbeit.
 */
export const PF_DEFAULT_CATEGORIES = [
  { name: 'Gehalt',                 type: 'income',  color: '#16a34a' },
  { name: 'Sonstige Einnahmen',     type: 'income',  color: '#14b8a6' },
  { name: 'Miete & Wohnen',         type: 'expense', color: '#8b5cf6' },
  { name: 'Lebensmittel',           type: 'expense', color: '#16a34a' },
  { name: 'Täglicher Bedarf',       type: 'expense', color: '#0ea5e9' },
  { name: 'Mobilität',              type: 'expense', color: '#ef4444' },
  { name: 'Freizeit',               type: 'expense', color: '#ec4899' },
  { name: 'Reisen',                 type: 'expense', color: '#f97316' },
  { name: 'Versicherung & Gesundheit', type: 'expense', color: '#3b82f6' },
  { name: 'Sparen & Anlegen',       type: 'expense', color: '#14b8a6' },
  { name: 'Sonstiges',              type: 'expense', color: '#64748b' },
] as const

/** Auswahlfarben fuer HAUPTkategorien. Unterkategorien bekommen keine eigene
 *  Farbe, sondern eine Abstufung der Elternfarbe (src/lib/categoryColors.ts) —
 *  sonst waere im Sankey nicht mehr zu sehen, was zu wem gehoert.
 *  Die Farbtoene liegen mindestens 30 Grad auseinander. Das ist der
 *  entscheidende Abstand, nicht die Helligkeit: die Sankey-Baender werden mit
 *  38 Prozent Deckkraft gezeichnet, und dabei verwaschen zwei nah beieinander
 *  liegende Toene zur selben Farbe, egal wie verschieden hell sie waren.
 *  Vorher standen hier Hellblau (199) und Blau (217) nebeneinander — im
 *  Diagramm nicht auseinanderzuhalten.
 *
 *  Alle in aehnlicher Helligkeit gehalten, damit die abgeleiteten Stufen der
 *  Unterkategorien darueber noch Luft nach oben haben. */
export const PF_CATEGORY_COLORS = [
  '#ef4444', // Rot        (Farbton   0)
  '#f97316', // Orange     (Farbton  25)
  '#eab308', // Gelb       (Farbton  46)
  '#84cc16', // Limette    (Farbton  84)
  '#16a34a', // Grün       (Farbton 142)
  '#14b8a6', // Türkis     (Farbton 173)
  '#3b82f6', // Blau       (Farbton 217)
  '#8b5cf6', // Violett    (Farbton 258)
  '#ec4899', // Pink       (Farbton 330)
  '#64748b', // Grau       (neutral)
] as const

export const STORAGE_BUCKET = {
  AVATARS: 'avatars',
} as const

export const DEFAULT_UNITS = ['Stück', 'g', 'kg', 'L', 'ml', 'cl'] as const
