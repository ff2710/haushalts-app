import { useEffect, useRef, useState, type ComponentType, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import { PersonalProvider } from './context/PersonalContext'
import Login from './components/Auth/Login'
import Onboarding from './components/Auth/Onboarding'
import Spinner from './components/ui/Spinner'
import ErrorToast from './components/ui/ErrorToast'
import OfflineBanner from './components/ui/OfflineBanner'
import ShoppingList from './components/ShoppingList/ShoppingList'
import Finance from './components/Finance/Finance'
import Settings from './components/Settings/Settings'
import PersonalHome from './components/Personal/PersonalHome'
import type { Area } from './types'
import {
  BasketIcon,
  EuroIcon,
  GearIcon,
  HouseIcon,
  HeartIcon,
  MoneyFlyIcon,
  PersonIcon,
  EmbraceIcon,
} from './components/ui/Icon'

type Tab = 'shopping' | 'finance' | 'settings' | 'overview'

interface TabDef {
  id: Tab
  label: string
  Icon: ComponentType<{ size?: number; className?: string }>
}

// Zwei getrennte Welten: "Gemeinsam" (geteilte Daten, beide sehen alles) und
// "Persoenlich" (privat pro Person, per RLS isoliert). Jede Welt hat ihre
// eigene Tab-Leiste; der Umschalter oben wechselt zwischen ihnen.
const TABS: Record<Area, TabDef[]> = {
  shared: [
    { id: 'shopping', label: 'Einkauf',       Icon: BasketIcon },
    { id: 'finance',  label: 'Finanzen',      Icon: EuroIcon },
    { id: 'settings', label: 'Einstellungen', Icon: GearIcon },
  ],
  personal: [
    { id: 'overview', label: 'Übersicht', Icon: MoneyFlyIcon },
  ],
}

const AREAS: { id: Area; label: string; Icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'shared',   label: 'Gemeinsam',  Icon: EmbraceIcon },
  { id: 'personal', label: 'Persönlich', Icon: PersonIcon },
]

function NavIcon({ children, active }: { children: ReactNode; active: boolean }) {
  const controls = useAnimation()
  const wasActive = useRef(false)

  useEffect(() => {
    if (active && !wasActive.current) {
      void controls.start({
        rotate: [0, -16, 0],
        scale:  [1, 1.22, 1],
        transition: { duration: 0.36, times: [0, 0.38, 1], ease: 'easeInOut' },
      })
    }
    wasActive.current = active
  }, [active, controls])

  return (
    <motion.span animate={controls} className="inline-flex items-center justify-center">
      {children}
    </motion.span>
  )
}

function Shell() {
  const [area, setArea] = useState<Area>('shared')
  const [tab, setTab]   = useState<Tab>('shopping')
  const touchStart = useRef<{ x: number; y: number; ignore: boolean } | null>(null)

  const tabs = TABS[area]

  // Weltwechsel: immer auf dem ersten Tab der neuen Welt landen.
  const switchArea = (next: Area) => {
    if (next === area) return
    setArea(next)
    setTab(TABS[next][0].id)
  }

  // Wischen nach links -> nächster Tab, nach rechts -> vorheriger Tab
  const onTouchStart = (e: ReactTouchEvent<HTMLElement>) => {
    const t = e.touches[0]
    const el = e.target as HTMLElement
    const ignore = !!el.closest('input, select, textarea, button, a, [data-no-swipe]')
    touchStart.current = { x: t.clientX, y: t.clientY, ignore }
  }
  const onTouchEnd = (e: ReactTouchEvent<HTMLElement>) => {
    const s = touchStart.current
    touchStart.current = null
    if (!s || s.ignore) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    // Nur eindeutig horizontale Wischer akzeptieren
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return
    const idx = tabs.findIndex((tb) => tb.id === tab)
    if (dx < 0 && idx < tabs.length - 1) setTab(tabs[idx + 1].id)
    else if (dx > 0 && idx > 0) setTab(tabs[idx - 1].id)
  }

  return (
    // 1. ÄUSSERER WRAPPER: Exakt 100dvh hoch, kein globales Scrollen (overflow-hidden)
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F5F5F2]">
      <ErrorToast />
      
      {/* Header: 'flex-none' statt 'sticky top-0' */}
      <header className="flex-none z-[60] bg-[#F5F5F2]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-5 pt-3 pb-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-600 text-white shadow-soft">
            <HouseIcon size={18} />
          </div>
          <h1 className="flex items-center gap-1.5 truncate text-[16px] font-semibold tracking-[-0.3px] text-zinc-900">
            {area === 'shared' ? (
              <>
                Haushalt Caro &amp; Fidel
                <HeartIcon size={15} className="shrink-0 text-[#FF4D4D]" />
              </>
            ) : (
              'Meine Finanzen'
            )}
          </h1>
        </div>

        {/* Umschalter zwischen den beiden Welten */}
        <div className="mx-auto max-w-2xl px-5 pb-2.5">
          <div className="flex gap-1 rounded-2xl bg-black/[0.05] p-1" data-no-swipe>
            {AREAS.map(({ id, label, Icon }) => {
              const active = area === id
              return (
                <button
                  key={id}
                  onClick={() => switchArea(id)}
                  className="relative flex-1 rounded-xl px-3 py-1.5 transition-opacity duration-150 active:opacity-70"
                >
                  {active && (
                    <motion.div
                      layoutId="area-pill"
                      className="absolute inset-0 rounded-xl bg-white shadow-soft"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span
                    className={
                      'relative flex items-center justify-center gap-1.5 text-[13px] font-medium tracking-[-0.1px] transition-colors duration-200 ' +
                      (active ? 'text-zinc-900' : 'text-zinc-500')
                    }
                  >
                    <Icon size={16} />
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-px bg-black/[0.07]" />
      </header>

      {/* Content: 'flex-1' füllt den Platz, 'overflow-y-auto' macht NUR diesen Bereich scrollbar. 
          Das alte 'pb-32' (Padding unten) kann weg, da die Navbar jetzt eh darunter liegt! */}
      <main
        className="flex-1 overflow-x-hidden overflow-y-auto px-4 pt-4 pb-6 sm:px-5"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={area + ':' + tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {tab === 'shopping' ? (
              <ShoppingList />
            ) : tab === 'finance' ? (
              <Finance />
            ) : tab === 'settings' ? (
              <Settings />
            ) : (
              <PersonalHome />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation: 'flex-none' statt 'fixed bottom-0...'. mt-auto drückt sie ganz nach unten. */}
      <nav className="flex-none z-[60] bg-white/85 backdrop-blur-2xl shadow-[0_-0.5px_0_rgba(0,0,0,0.12)] mt-auto">
        <div className="mx-auto flex max-w-2xl pb-safe">
          {tabs.map(({ id, label, Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="relative flex flex-1 flex-col items-center gap-[3px] py-2.5 transition-opacity duration-150 active:opacity-60"
              >
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute top-0 h-[2px] w-7 rounded-full bg-brand-600"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <NavIcon active={active}>
                  <Icon
                    size={23}
                    className={
                      'transition-colors duration-200 ' +
                      (active ? 'text-brand-600' : 'text-zinc-400')
                    }
                  />
                </NavIcon>
                <span
                  className={
                    'text-[10px] font-medium leading-none tracking-[-0.1px] transition-colors duration-200 ' +
                    (active ? 'text-brand-600' : 'text-zinc-400')
                  }
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F2]">
        <Spinner />
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <AppProvider>
      <PersonalProvider>
        <OfflineBanner />
        {!profile ? <Onboarding /> : <Shell />}
      </PersonalProvider>
    </AppProvider>
  )
}
