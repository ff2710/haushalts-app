import { useMemo, useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import { ChevronRightIcon } from '../ui/Icon'
import AddButton from '../ui/AddButton'
import { formatMoney } from '../../lib/utils'
import { budgetStatus } from '../../lib/budget'
import { categoryColorMap } from '../../lib/categoryColors'
import { orderedCategories } from '../../lib/categoryTree'
import BudgetSheet from './BudgetSheet'
import CategorySheet from './CategorySheet'
import { EmptyRow, SectionHead, card, rowCls, sep } from './planningShared'
import type { PfCategory, PfCategoryType } from '../../types'

// Die Struktur, auf der Budgets, Analyse und die 50/30/20-Toepfe aufsetzen.

export default function PlanningCategories() {
  const { categories, monthTransactions } = usePersonal()

  const [budgetOpen, setBudgetOpen] = useState(false)
  const [budgetCat, setBudgetCat] = useState<PfCategory | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const [catEdit, setCatEdit] = useState<PfCategory | null>(null)
  const [catType, setCatType] = useState<PfCategoryType>('expense')
  const [catParent, setCatParent] = useState<string | null>(null)

  const colors = useMemo(() => categoryColorMap(categories), [categories])

  const openCategory = (cat: PfCategory | null, type: PfCategoryType, parentId: string | null) => {
    setCatEdit(cat)
    setCatType(type)
    setCatParent(parentId)
    setCatOpen(true)
  }

  const spentByCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of monthTransactions) {
      if (t.type !== 'expense' || !t.category_id) continue
      m.set(t.category_id, (m.get(t.category_id) ?? 0) + Number(t.amount))
    }
    return m
  }, [monthTransactions])

  const catRows = useMemo(
    () => ({
      expense: orderedCategories(categories.filter((c) => c.type === 'expense')),
      income:  orderedCategories(categories.filter((c) => c.type === 'income')),
    }),
    [categories],
  )
  const budgetRows = catRows.expense

  return (
    <div className="space-y-6">
      {/* ── Kategorien ────────────────────────────────────────────────────── */}
      {/* Erst hier entsteht die Struktur, auf der Budgets und die Analyse-
          Ansicht aufsetzen: Hauptkategorien mit je einer Ebene Unterkategorien. */}
      {(['expense', 'income'] as PfCategoryType[]).map((t) => {
        const rows = catRows[t]
        return (
          <section key={t}>
            <SectionHead title={t === 'expense' ? 'Ausgaben-Kategorien' : 'Einnahme-Kategorien'} add={{
              label: t === 'expense' ? 'Ausgaben-Kategorie hinzufügen' : 'Einnahme-Kategorie hinzufügen',
              onClick: () => openCategory(null, t, null),
            }} />
            <div className={card}>
              {rows.length === 0
                ? <EmptyRow>Noch keine Kategorien</EmptyRow>
                : rows.map(({ category: c, depth, children }, i) => (
                    <div key={c.id}>
                      {i > 0 && sep}
                      <div className="flex items-center">
                        <button
                          onClick={() => openCategory(c, t, c.parent_id)}
                          className={`${rowCls} min-w-0 flex-1 transition-colors duration-100 active:bg-zinc-50`}
                          style={depth === 1 ? { paddingLeft: 34 } : undefined}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                              style={{ backgroundColor: colors.get(c.id) ?? c.color }}
                            />
                            <span className="min-w-0">
                              <span
                                className={
                                  'block truncate ' +
                                  (depth === 1
                                    ? 'text-[14px] text-zinc-600'
                                    : 'text-[15px] font-medium text-zinc-900')
                                }
                              >
                                {c.name}
                              </span>
                              {depth === 0 && children.length > 0 && (
                                <span className="mt-0.5 block text-[12px] text-zinc-400">
                                  {children.length}{' '}
                                  {children.length === 1 ? 'Unterkategorie' : 'Unterkategorien'}
                                </span>
                              )}
                            </span>
                          </span>
                          <ChevronRightIcon size={14} strokeWidth={2.5} className="shrink-0 text-zinc-300" />
                        </button>
                        {/* Nur an Hauptkategorien: eine Ebene tiefer geht nicht. */}
                        {depth === 0 && (
                          <span className="mr-1.5">
                            <AddButton
                              subtle
                              onClick={() => openCategory(null, t, c.id)}
                              label={`Unterkategorie unter ${c.name} anlegen`}
                            />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
            </div>
          </section>
        )
      })}

      {/* ── Budgets ───────────────────────────────────────────────────────── */}
      <section>
        <SectionHead title={'Budgets je Kategorie'} />
        <div className={card}>
          {budgetRows.length === 0
            ? <EmptyRow>Keine Ausgaben-Kategorien vorhanden</EmptyRow>
            : budgetRows.map(({ category: c, depth }, i) => {
                const budget = c.monthly_budget == null ? null : Number(c.monthly_budget)
                const spent = spentByCategory.get(c.id) ?? 0
                const { level, ratio, overBy } = budgetStatus(spent, budget, Number(c.warn_ratio))
                const over = level === 'over'
                const warn = level === 'warn'
                return (
                  <div key={c.id}>
                    {i > 0 && sep}
                    <button
                      onClick={() => {
                        setBudgetCat(c)
                        setBudgetOpen(true)
                      }}
                      className={`${rowCls} transition-colors duration-100 active:bg-zinc-50`}
                      style={depth === 1 ? { paddingLeft: 34 } : undefined}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={
                            'block truncate ' +
                            (depth === 1
                              ? 'text-[14px] text-zinc-600'
                              : 'text-[15px] font-medium text-zinc-900')
                          }
                        >
                          {c.name}
                        </span>
                        {level === 'none' ? (
                          <span className="mt-0.5 block text-[12px] text-zinc-400">
                            Kein Budget gesetzt
                          </span>
                        ) : (
                          <>
                            <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                              <span
                                className={
                                  'block h-full rounded-full ' +
                                  (over ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-brand-600')
                                }
                                style={{ width: `${Math.min(100, ratio * 100)}%` }}
                              />
                            </span>
                            <span
                              className={
                                'mt-1 block text-[12px] ' +
                                (over ? 'text-red-500' : warn ? 'text-amber-600' : 'text-zinc-400')
                              }
                            >
                              {formatMoney(spent)} von {formatMoney(budget as number)}
                              {over
                                ? ` · ${formatMoney(overBy)} drüber`
                                : warn
                                  ? ' · Schwelle erreicht'
                                  : ''}
                            </span>
                          </>
                        )}
                      </span>
                      <ChevronRightIcon size={14} strokeWidth={2.5} className="shrink-0 text-zinc-300" />
                    </button>
                  </div>
                )
              })}
        </div>
      </section>

      <BudgetSheet open={budgetOpen} onClose={() => setBudgetOpen(false)} category={budgetCat} />
      <CategorySheet
        open={catOpen}
        onClose={() => setCatOpen(false)}
        category={catEdit}
        type={catType}
        parentId={catParent}
      />
    </div>
  )
}
