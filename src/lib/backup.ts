// Vollstaendiger Export des Datenbestands.
//
// Nicht verhandelbar laut CLAUDE.md — und zwar aus einem Grund, den man erst
// merkt, wenn es zu spaet ist: Kontostaende, Topfstaende und Schuldenstaende
// werden von Hand gepflegt. Sie stehen in keiner Bank-CSV und lassen sich aus
// nichts wiederherstellen. Geht die Datenbank verloren, ist genau dieser Teil
// unwiederbringlich.
//
// Zwei Regeln, die die Datei brauchbar machen:
//
// 1. ENTWEDER VOLLSTAENDIG ODER GAR NICHT. Schlaegt auch nur eine Tabelle
//    fehl, entsteht keine Datei. Ein Backup, dem eine Tabelle fehlt, ist
//    schlimmer als keins — man verlaesst sich darauf und merkt die Luecke
//    erst beim Zurueckspielen.
// 2. Die Datei zaehlt ihre eigenen Zeilen mit. So sieht man beim Oeffnen
//    sofort, ob sie plausibel ist, ohne sie durchzulesen.
//
// Die Datei landet ueber den Browser im Download-Ordner. Sie darf NIE im
// Repo-Baum liegen — das Repo ist oeffentlich.

/** Steigt, wenn sich die Struktur der Datei aendert. */
export const BACKUP_VERSION = 1

export const BACKUP_FORMAT = 'haushalts-app-backup'

/** Tabellen des gemeinsamen Bereichs — beide Personen sehen dieselben Zeilen. */
export const SHARED_TABLES = [
  'settings',
  'profiles',
  'stores',
  'categories',
  'units',
  'shopping_items',
  'expenses',
  'settlements',
] as const

/** Tabellen des persoenlichen Bereichs — RLS liefert nur eigene Zeilen. */
export const PERSONAL_TABLES = [
  'pf_accounts',
  'pf_cash_locations',
  'pf_categories',
  'pf_transactions',
  'pf_import_batches',
  'pf_fixed_costs',
  'pf_recurring_income',
  'pf_variable_estimates',
  'pf_monthly_plan',
  'pf_pots',
  'pf_debts',
  'pf_allocation_steps',
] as const

export type SharedTable = (typeof SHARED_TABLES)[number]
export type PersonalTable = (typeof PERSONAL_TABLES)[number]
export type BackupTable = SharedTable | PersonalTable

export const ALL_TABLES: BackupTable[] = [...SHARED_TABLES, ...PERSONAL_TABLES]

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  createdAt: string
  /** Wem der persoenliche Teil gehoert — beim Zurueckspielen der Prueffall. */
  ownerEmail: string | null
  /** Zeilen je Tabelle. Beim Oeffnen sofort auf Plausibilitaet pruefbar. */
  counts: Record<string, number>
  shared: Record<string, unknown[]>
  personal: Record<string, unknown[]>
}

export function buildBackup(
  rows: Record<string, unknown[]>,
  ownerEmail: string | null,
  now: Date = new Date(),
): BackupFile {
  const pick = (tables: readonly string[]) =>
    Object.fromEntries(tables.map((t) => [t, rows[t] ?? []]))

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    ownerEmail,
    counts: Object.fromEntries(ALL_TABLES.map((t) => [t, (rows[t] ?? []).length])),
    shared: pick(SHARED_TABLES),
    personal: pick(PERSONAL_TABLES),
  }
}

/** Dateiname mit Zeitstempel — sortiert sich im Ordner von selbst. */
export function backupFilename(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}`
  return `haushalt-backup-${stamp}.json`
}

/** Gesamtzahl der Zeilen — die eine Zahl, die man dem Nutzer zeigt. */
export function totalRows(file: BackupFile): number {
  return Object.values(file.counts).reduce((s, n) => s + n, 0)
}
