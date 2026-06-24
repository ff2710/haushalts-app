import { motion, AnimatePresence } from 'framer-motion'

interface UndoToastProps {
  label:    string | null
  onUndo:   () => void
  maxWidth?: string
}

export default function UndoToast({ label, onUndo, maxWidth = '160px' }: UndoToastProps) {
  return (
    <AnimatePresence>
      {label && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          data-no-swipe
          className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 86px)' }}
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-zinc-900 py-2 pl-4 pr-2 shadow-card-lg">
            <span
              className="truncate text-[13px] font-medium text-white"
              style={{ maxWidth }}
            >
              {label}
            </span>
            <button
              onClick={onUndo}
              className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-white/25"
            >
              Rückgängig
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
