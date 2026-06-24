import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toastEmitter } from '../../lib/toastEmitter'

interface Toast { id: number; msg: string }
let _id = 0

export default function ErrorToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    return toastEmitter.on((msg) => {
      const id = ++_id
      setToasts((prev) => [...prev, { id, msg }])
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
    })
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[200] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center gap-2.5 rounded-full bg-zinc-900 py-2.5 pl-4 pr-5 shadow-card-lg"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
            <span className="text-[13px] font-medium text-white">{t.msg}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
