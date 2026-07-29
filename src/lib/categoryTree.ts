// Kategorien in Anzeigereihenfolge bringen: Hauptkategorie, direkt gefolgt von
// ihren Unterkategorien, alles alphabetisch. Genau zwei Ebenen — mehr laesst
// die Datenbank nicht zu (siehe supabase/schema-personal.sql, Abschnitt 6).
//
// An einer Stelle, weil Planung, Sankey und Donut dieselbe Reihenfolge zeigen
// muessen; zwei Listen mit unterschiedlicher Sortierung wirken wie zwei
// verschiedene Datenbestaende.

export interface TreeCategory {
  id: string
  name: string
  parent_id: string | null
}

export interface CategoryRow<T> {
  category: T
  /** 0 = Hauptkategorie, 1 = Unterkategorie. */
  depth: 0 | 1
  /** Nur bei Hauptkategorien gefuellt. */
  children: T[]
}

const byName = (a: TreeCategory, b: TreeCategory) => a.name.localeCompare(b.name, 'de')

/**
 * Flache Liste in Anzeigereihenfolge, jede Zeile mit ihrer Ebene.
 *
 * Eine Unterkategorie, deren Elternteil nicht in `categories` steckt (etwa
 * weil die Liste nach Typ gefiltert wurde), wird als Hauptkategorie gefuehrt —
 * lieber einmal zu weit oben als unsichtbar.
 */
export function orderedCategories<T extends TreeCategory>(categories: T[]): CategoryRow<T>[] {
  const ids = new Set(categories.map((c) => c.id))

  const roots = categories.filter((c) => !c.parent_id || !ids.has(c.parent_id)).sort(byName)
  const childrenOf = new Map<string, T[]>()
  for (const c of categories) {
    if (!c.parent_id || !ids.has(c.parent_id)) continue
    const list = childrenOf.get(c.parent_id)
    if (list) list.push(c)
    else childrenOf.set(c.parent_id, [c])
  }
  for (const list of childrenOf.values()) list.sort(byName)

  const rows: CategoryRow<T>[] = []
  for (const root of roots) {
    const children = childrenOf.get(root.id) ?? []
    rows.push({ category: root, depth: 0, children })
    for (const child of children) rows.push({ category: child, depth: 1, children: [] })
  }
  return rows
}
