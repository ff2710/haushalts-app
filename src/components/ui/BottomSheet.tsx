import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, type PanInfo, AnimatePresence } from 'framer-motion'
import { popOverlay, pushOverlay } from '../../lib/overlayLayer'

interface BottomSheetProps {
  open:       boolean
  onClose:    () => void
  children:   ReactNode
  maxHeight?: string
  paddingBottom?: string
  /**
   * Hebt das Sheet ueber einen bereits offenen Dialog (Modal, z-[70]/[80]).
   * Noetig fuer Sheets, die AUS einem Dialog heraus geoeffnet werden — etwa
   * "Passwort aendern" in den Einstellungen. Ohne das laege das Sheet hinter
   * dem Dialog, da beide per Portal an <body> haengen und rein die z-Ebene
   * entscheidet. Standard false = bisheriges Verhalten.
   */
  elevated?: boolean
}

export default function BottomSheet({
  open,
  onClose,
  children,
  maxHeight     = 'calc(100dvh - 56px)',
  paddingBottom = 'calc(env(safe-area-inset-bottom) + 64px)',
  elevated      = false,
}: BottomSheetProps) {
  const zScrim = elevated ? 'z-[90]'  : 'z-[30]'
  const zPanel = elevated ? 'z-[100]' : 'z-[40]'

  // Als oberste Ebene anmelden, solange offen: der darunterliegende Dialog
  // darf dann nicht mehr auf Escape reagieren. Zusaetzlich schliesst Escape
  // dieses Sheet selbst.
  useEffect(() => {
    if (!open || !elevated) return
    pushOverlay()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      popOverlay()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, elevated, onClose])

  // Direkt an <body> haengen. Grund: Das Panel wird per framer-motion
  // transformiert, und ein transformierter Vorfahre wird zum Bezugsrahmen fuer
  // `position: fixed`-Kinder. Ohne Portal waeren verschachtelte Overlays samt
  // Abdunklung auf die Breite des aeusseren Containers begrenzt statt auf den
  // ganzen Bildschirm.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className={'fixed inset-0 bg-black/35 ' + zScrim}
          />

          <motion.div
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.45 }}
            onDragEnd={(_: unknown, info: PanInfo) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose()
            }}
            data-no-swipe
            className={
              'fixed inset-x-0 bottom-0 mx-auto max-w-2xl overflow-y-auto rounded-t-3xl bg-white ' +
              zPanel
            }
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
    </AnimatePresence>,
    document.body,
  )
}
