import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { PlusIcon } from '../ui/Icon'
import { UNDO_DELAY_MS } from '../../constants'
import BalanceCard from './BalanceCard'
import History from './History'
import EntrySheet from './EntrySheet'

export default function Finance() {
  const { deleteExpense, deleteSettlement } = useApp()

  const [sheetOpen, setSheetOpen]   = useState(false)
  const [hiddenId, setHiddenId]     = useState<string | null>(null)
  const [undoLabel, setUndoLabel]   = useState<string | null>(null)

  const pendingRef = useRef<{ kind: 'expense' | 'settlement'; id: string } | null>(null)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable ref so timer callbacks can access current functions without stale closure
  const fns = useRef({ deleteExpense, deleteSettlement })
  fns.current = { deleteExpense, deleteSettlement }

  const clearPending = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    pendingRef.current = null
    setHiddenId(null)
    setUndoLabel(null)
  }

  const handleDeleteRequest = useCallback(
    (kind: 'expense' | 'settlement', id: string, label: string) => {
      // Cancel any previous pending delete first
      if (timerRef.current) clearTimeout(timerRef.current)

      pendingRef.current = { kind, id }
      setHiddenId(id)
      setUndoLabel(label)

      timerRef.current = setTimeout(() => {
        const p = pendingRef.current
        if (!p) return
        if (p.kind === 'expense')    void fns.current.deleteExpense(p.id)
        else                         void fns.current.deleteSettlement(p.id)
        pendingRef.current = null
        setHiddenId(null)
        setUndoLabel(null)
      }, UNDO_DELAY_MS)
    },
    []
  )

  const handleUndo = useCallback(() => {
    clearPending()
  }, [])

  return (
      <div className="mx-auto max-w-2xl space-y-4 pb-20">
      <div className="space-y-5 pb-24">
        <BalanceCard />
        <History onDelete={handleDeleteRequest} hiddenId={hiddenId} />
      </div>

      {/* FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_4px_20px_rgba(0,0,0,0.22)] transition-all duration-150 hover:bg-brand-700 active:scale-95"
        aria-label="Neuer Eintrag"
      >
        <PlusIcon size={24} strokeWidth={2.2} />
      </button>

      {/* Entry sheet */}
      <EntrySheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      {/* Undo toast */}
      <AnimatePresence>
        {undoLabel && (
          <motion.div
            key="finance-undo"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+80px)] z-[45] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl bg-zinc-900 px-4 py-3.5 shadow-card-lg"
          >
            <p className="min-w-0 truncate text-[13px] font-medium text-white">
              {undoLabel} gelöscht
            </p>
            <button
              onClick={handleUndo}
              className="shrink-0 text-[13px] font-bold text-white underline underline-offset-2 transition-opacity duration-100 active:opacity-60"
            >
              Rückgängig
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
