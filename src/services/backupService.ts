import { supabase } from '../lib/supabase'
import { ALL_TABLES, buildBackup, type BackupFile } from '../lib/backup'

// Holt den kompletten Bestand fuer den Export.
//
// RLS entscheidet auch hier, was zurueckkommt: die Gemeinsam-Tabellen liefern
// beiden Personen dieselben Zeilen, die pf_-Tabellen nur die eigenen. Es wird
// nirgends nach owner_id gefiltert — das waere doppelt gemoppelt und koennte
// bei einem Tippfehler mehr filtern als gewollt.
//
// WICHTIG, und der Grund fuer die Seitenlogik unten: Ein blosses select('*')
// liefert NICHT zwingend alle Zeilen. PostgREST deckelt die Antwort
// serverseitig (ueblich bei 1000) und meldet dabei KEINEN Fehler — man bekaeme
// Status 200 mit abgeschnittener Liste. Eine Backup-Datei, die sich aus so
// einer Antwort selbst zaehlt, behauptet vollstaendig zu sein und ist es
// nicht. Genau davor soll diese Funktion schuetzen, also wird hier
// seitenweise geladen UND gegen die echte Zeilenzahl der Datenbank geprueft.

/** Seitengroesse. Kleiner als jedes uebliche Serverlimit. */
const PAGE_SIZE = 500

/** Notbremse gegen eine Endlosschleife, falls der Server sich unerwartet verhaelt. */
const MAX_ROWS = 500_000

interface TableResult {
  table: string
  rows: unknown[]
  error: string | null
}

/**
 * Laedt eine Tabelle vollstaendig — seitenweise, nach id sortiert.
 *
 * Die Sortierung ist nicht Kosmetik: ohne feste Reihenfolge darf die Datenbank
 * zwischen zwei Seiten anders sortieren, und dann fehlen Zeilen, waehrend
 * andere doppelt kommen.
 */
async function fetchTable(table: string): Promise<TableResult> {
  const rows: unknown[] = []
  let expected: number | null = null
  let from = 0

  for (;;) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) return { table, rows: [], error: error.message }
    if (expected === null) expected = count ?? null

    const batch = data ?? []
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE

    if (rows.length > MAX_ROWS) {
      return { table, rows: [], error: `mehr als ${MAX_ROWS} Zeilen` }
    }
  }

  // Gegenprobe gegen die Datenbank selbst. Weicht es ab, wurde entweder
  // abgeschnitten oder jemand hat waehrend des Exports geschrieben — in beiden
  // Faellen ist die Datei nicht das, was sie zu sein behauptet.
  if (expected !== null && rows.length !== expected) {
    return { table, rows: [], error: `${rows.length} statt ${expected} Zeilen` }
  }

  return { table, rows, error: null }
}

export interface BackupResult {
  file: BackupFile | null
  /** Gesetzt, wenn IRGENDEINE Tabelle unvollstaendig war. */
  error: string | null
}

export async function createBackup(ownerEmail: string | null): Promise<BackupResult> {
  const results = await Promise.all(ALL_TABLES.map(fetchTable))

  // Entweder vollstaendig oder gar nicht: eine Datei, der eine Tabelle fehlt,
  // sieht vollstaendig aus und ist es nicht. Lieber kein Backup als eines, dem
  // man faelschlich vertraut.
  const failed = results.filter((r) => r.error)
  if (failed.length > 0) {
    const details = failed.map((f) => `${f.table} (${f.error})`).join(', ')
    return {
      file: null,
      error: `Nicht alle Daten konnten vollständig gelesen werden: ${details}. Es wurde keine Datei erstellt — ein unvollständiges Backup wäre gefährlicher als keins. Versuch es gleich noch einmal.`,
    }
  }

  const rows = Object.fromEntries(results.map((r) => [r.table, r.rows]))
  return { file: buildBackup(rows, ownerEmail), error: null }
}
