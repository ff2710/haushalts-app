import { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface BottomSheetProps {
  open:       boolean
  onClose:    () => void
  children:   ReactNode
  maxHeight?: string
  paddingBottom?: string
}

export default function BottomSheet({
  open,
  onClose,
  children,
  maxHeight     = 'calc(100dvh - 56px)',
  paddingBottom = 'calc(env(safe-area-inset-bottom) + 64px)',
}: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[30] bg-black/35"
          />

          <motion.div
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.45 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose()
            }}
            data-no-swipe
            className="fixed inset-x-0 bottom-0 z-[40] mx-auto max-w-2xl overflow-y-auto rounded-t-3xl bg-white"
            style={{
              maxHeight,
              paddingBottom,
              boxShadow: '0 -10px 44px rgba(0,0,0,0.16), 0 -1px 0 rgba(0,0,0,0.05)',
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-10 cursor-grab rounded-full bg-zinc-200 active:cursor-grabbing" />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
