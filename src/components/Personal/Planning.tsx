import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePersonal } from '../../context/PersonalContext'
import { SkeletonBlock } from '../ui/Skeleton'
import PlanningGoals from './PlanningGoals'
import PlanningCascade from './PlanningCascade'
import PlanningPots from './PlanningPots'
import PlanningDebts from './PlanningDebts'
import PlanningBudget from './PlanningBudget'
import PlanningCategories from './PlanningCategories'

// Die Soll-Welt: Ziele, Verteilung, Rücklagen, Fixkosten, Struktur.
//
// Eigene Unter-Navigation statt weiterer Tabs — die untere Leiste steht bei
// fünf und trägt keine sechs. Und thematisch gehört das alles zusammen: hier
// steht, was passieren SOLL, während Übersicht und Analyse zeigen, was
// passiert IST.

const VIEWS = [
  { id: 'goals',      label: 'Ziele' },
  { id: 'cascade',    label: 'Kaskade' },
  { id: 'pots',       label: 'Töpfe' },
  { id: 'debts',      label: 'Schulden' },
  { id: 'budget',     label: 'Fixkosten' },
  { id: 'categories', label: 'Kategorien' },
] as const

type ViewId = (typeof VIEWS)[number]['id']

export default function Planning() {
  const { loading } = usePersonal()
  const [view, setView] = useState<ViewId>('goals')

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <SkeletonBlock className="h-10 w-full rounded-2xl" />
        <SkeletonBlock className="h-40 w-full rounded-2xl" />
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Waagerecht scrollbar: sechs Punkte passen auf 375 px nicht nebeneinander,
          und Umbrechen würde die Leiste zweizeilig und unruhig machen. */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-no-swipe>
        <div className="flex w-max gap-1 rounded-2xl bg-black/[0.05] p-1">
          {VIEWS.map((v) => {
            const active = view === v.id
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className="relative rounded-xl px-3 py-1.5 transition-opacity duration-150 active:opacity-70"
              >
                {active && (
                  <motion.div
                    layoutId="planning-pill"
                    className="absolute inset-0 rounded-xl bg-white shadow-soft"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span
                  className={
                    'relative whitespace-nowrap text-[13px] font-medium tracking-[-0.1px] transition-colors duration-200 ' +
                    (active ? 'text-zinc-900' : 'text-zinc-500')
                  }
                >
                  {v.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {view === 'goals' ? (
        <PlanningGoals />
      ) : view === 'cascade' ? (
        <PlanningCascade />
      ) : view === 'pots' ? (
        <PlanningPots />
      ) : view === 'debts' ? (
        <PlanningDebts />
      ) : view === 'budget' ? (
        <PlanningBudget />
      ) : (
        <PlanningCategories />
      )}
    </div>
  )
}
