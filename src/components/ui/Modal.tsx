import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { hasOverlayAbove } from '../../lib/overlayLayer'
import { CloseIcon } from './Icon'

interface ModalProps {
  open:     boolean
  onClose:  () => void
  title:    string
  children: ReactNode
}

/**
 * Uebergeordneter Dialog: schwebt zentriert ueber der GESAMTEN App — auch ueber
 * der unteren Navigationsleiste (z-[60]) — und fuellt fast den ganzen Schirm.
 * Solange er offen ist, laesst sich nichts anderes bedienen: der Scrim liegt
 * ueber allem und faengt jeden Klick ab.
 *
 * Bewusst OHNE Transform-Animation (nur Deckkraft): Ein transformierter
 * Vorfahre wuerde zum Bezugsrahmen fuer `position: fixed`-Kinder — verschachtelte
 * Overlays wie das "Haushalt zuruecksetzen"-Modal waeren dann auf die Breite
 * dieses Dialogs eingeklemmt statt bildschirmfuellend.
 */
export default function Modal({ open, onClose, title, children }: ModalProps) {
  // Escape schliesst — aber nur, wenn nichts darueber liegt. Ist gerade ein
  // Sheet oder das Reset-Modal offen, gehoert Escape der obersten Ebene.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !hasOverlayAbove()) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px]"
          />

          {/* Wrapper zentriert nur; Klicks daneben fallen auf den Scrim durch. */}
          <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              data-no-swipe
              className="pointer-events-auto flex h-[93dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-[#F5F5F2]"
              style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(0,0,0,0.06)' }}
            >
              <div className="flex flex-none items-center justify-between px-5 pt-4 pb-3">
                <h2 className="text-[19px] font-semibold tracking-[-0.4px] text-zinc-900">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Schließen"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-opacity duration-150 active:opacity-70"
                >
                  <CloseIcon size={16} strokeWidth={2.5} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-6 sm:px-5">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
