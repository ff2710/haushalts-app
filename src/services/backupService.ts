import { supabase } from '../lib/supabase'
import { ALL_TABLES, buildBackup, type BackupFile } from '../lib/backup'

// Holt den kompletten Bestand fuer den Export.
//
// RLS entscheidet auch hier, was zurueckkommt: die Gemeinsam-Tabellen liefern
// beiden Personen dieselben Zeilen, die pf_-Tabellen nur die eigenen. Es wird
// nirgends nach owner_id gefiltert — das waere doppelt gemoppelt und koennte
// bei einem Tippfehler mehr filtern als gewollt.

export interface BackupResult {
  file: BackupFile | null
  /** Gesetzt, wenn IRGENDEINE Tabelle nicht geladen werden konnte. */
  error: string | null
}

export async function createBackup(ownerEmail: string | null): Promise<BackupResult> {
  const results = await Promise.all(
    ALL_TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select('*')
      return { table, data: data ?? [], error }
    }),
  )

  // Entweder vollstaendig oder gar nicht: eine Datei, der eine Tabelle fehlt,
  // sieht vollstaendig aus und ist es nicht. Lieber kein Backup als ein
  // Backup, dem man faelschlich vertraut.
  const failed = results.filter((r) => r.error)
  if (failed.length > 0) {
    const names = failed.map((f) => f.table).join(', ')
    return {
      file: null,
      error: `Nicht alle Daten konnten gelesen werden (${names}). Es wurde keine Datei erstellt — ein unvollständiges Backup wäre gefährlicher als keins.`,
    }
  }

  const rows = Object.fromEntries(results.map((r) => [r.table, r.data as unknown[]]))
  return { file: buildBackup(rows, ownerEmail), error: null }
}
