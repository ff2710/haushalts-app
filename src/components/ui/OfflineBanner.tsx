import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -40 }}
          animate={{ y: 0 }}
          exit={{ y: -40 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed inset-x-0 top-0 z-[70] bg-zinc-900 px-4 py-2 text-center text-[13px] font-medium text-white"
        >
          Keine Verbindung · Änderungen werden synchronisiert
        </motion.div>
      )}
    </AnimatePresence>
  )
}
