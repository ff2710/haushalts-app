import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { animate, motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { CameraIcon, ChevronRightIcon, PlusIcon, TrashIcon } from '../ui/Icon'

type SettingsView = 'list' | 'profile' | 'stores' | 'categories' | 'units'

const EINKAUF_ROWS: { key: SettingsView; label: string; sg: string; pl: string }[] = [
  { key: 'stores',     label: 'Läden',      sg: 'Laden',     pl: 'Läden'      },
  { key: 'categories', label: 'Kategorien', sg: 'Kategorie', pl: 'Kategorien' },
  { key: 'units',      label: 'Einheiten',  sg: 'Einheit',   pl: 'Einheiten'  },
]

const VIEW_TITLES: Record<SettingsView, string> = {
  list: '', profile: 'Mein Profil', stores: 'Läden', categories: 'Kategorien', units: 'Einheiten',
}

// ── Slide-to-confirm ──────────────────────────────────────────────────────────
function SlideToReset({ onConfirm }: { onConfirm: () => void }) {
  const trackRef  = useRef<HTMLDivElement>(null)
  const x         = useMotionValue(0)
  const HANDLE    = 52
  const labelOpacity = useTransform(x, [0, 80], [1, 0])

  const handleDragEnd = () => {
    const tw   = trackRef.current?.getBoundingClientRect().width ?? 280
    const maxX = tw - HANDLE
    if (x.get() >= maxX * 0.82) {
      void animate(x, maxX, { type: 'spring', stiffness: 400, damping: 40 })
      setTimeout(onConfirm, 280)
    } else {
      void animate(x, 0, { type: 'spring', stiffness: 400, damping: 35 })
    }
  }

  return (
    <div
      ref={trackRef}
      className="relative h-[52px] overflow-hidden rounded-full bg-red-100"
    >
      <motion.span
        className="pointer-events-none absolute inset-0 flex select-none items-center justify-center text-[13px] font-medium text-red-400"
        style={{ opacity: labelOpacity }}
      >
        Nach rechts schieben zum Bestätigen
      </motion.span>
      <motion.div
        drag="x"
        dragConstraints={trackRef}
        dragElastic={0}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={handleDragEnd}
        className="absolute left-0 top-0 flex h-[52px] w-[52px] cursor-grab items-center justify-center rounded-full bg-red-500 text-white shadow active:cursor-grabbing"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </motion.div>
    </div>
  )
}

// ── Mini-Avatar ────────────────────────────────────────────────────────────────
function MiniAvatar({ name, avatarUrl, size = 36 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const initial = name.trim()[0]?.toUpperCase() ?? '?'
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full bg-brand-600/10"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[13px] font-bold text-brand-600">
          {initial}
        </div>
      )}
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function Settings() {
  const {
    myRole, profileA, profileB,
    stores, addStore, deleteStore,
    categories, addCategory, deleteCategory,
    units, addUnit, removeUnit,
    resetHousehold,
  } = useApp()
  const { signOut, session, profile, updateProfileName, updateAvatar } = useAuth()

  const [view, setView]                       = useState<SettingsView>('list')
  const [myName, setMyName]                   = useState('')
  const [savedName, setSavedName]             = useState(false)
  const [newVal, setNewVal]                   = useState('')
  const [addError, setAddError]               = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [showResetModal, setShowResetModal]   = useState(false)
  const [resetBusy, setResetBusy]             = useState(false)
  const inputRef     = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) setMyName(profile.name)
  }, [profile])

  useEffect(() => {
    setNewVal('')
    setAddError('')
  }, [view])

  const go   = (to: SettingsView) => setView(to)
  const back = () => setView('list')

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = myName.trim()
    if (!trimmed) return
    await updateProfileName(trimmed)
    setSavedName(true)
    setTimeout(() => setSavedName(false), 2000)
  }

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    await updateAvatar(file)
    setAvatarUploading(false)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  const doReset = async () => {
    setResetBusy(true)
    await resetHousehold()
    setResetBusy(false)
  }

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault()
    const t = newVal.trim()
    if (!t) return
    if (view === 'stores') {
      if (stores.some((s) => s.name.toLowerCase() === t.toLowerCase())) {
        setAddError('Laden bereits vorhanden'); return
      }
      await addStore(t)
    } else if (view === 'categories') {
      if (categories.some((c) => c.name.toLowerCase() === t.toLowerCase())) {
        setAddError('Kategorie bereits vorhanden'); return
      }
      await addCategory(t)
    } else if (view === 'units') {
      if (units.map((u) => u.toLowerCase()).includes(t.toLowerCase())) {
        setAddError('Einheit bereits vorhanden'); return
      }
      await addUnit(t)
    }
    setAddError('')
    setNewVal('')
    inputRef.current?.focus()
  }

  const deleteAction = (id: string) => {
    if (view === 'stores')          void deleteStore(id)
    else if (view === 'categories') void deleteCategory(id)
    else if (view === 'units')      void removeUnit(id)
  }

  const currentList =
    view === 'stores'      ? stores.map((s) => ({ id: s.id, name: s.name }))
    : view === 'categories' ? categories.map((c) => ({ id: c.id, name: c.name }))
    : view === 'units'      ? units.map((u) => ({ id: u, name: u }))
    : []

  const addPlaceholder =
    view === 'stores' ? 'Neuer Laden…' : view === 'categories' ? 'Neue Kategorie…' : 'Neue Einheit…'

  const einkaufCounts = {
    stores: stores.length, categories: categories.length, units: units.length,
  }

  const partnerProfile = myRole === 'A' ? profileB : myRole === 'B' ? profileA : null

  // ── Shared styles ────────────────────────────────────────────────────────────
  const card    = 'overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.05]'
  const rowCls  = 'flex items-center justify-between gap-3 px-4 py-[13px]'
  const sep     = <div className="mx-4 h-px bg-zinc-100" />
  const sLabel  = 'mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400'

  // ── Views ────────────────────────────────────────────────────────────────────

  const listView: ReactNode = (
    <div className="space-y-5">
      {/* Mein Profil */}
      <div>
        <p className={sLabel}>Mein Profil</p>
        <div className={card}>
          <button
            onClick={() => go('profile')}
            className={`${rowCls} w-full transition-colors duration-100 active:bg-zinc-50`}
          >
            <div className="flex items-center gap-3">
              <MiniAvatar name={profile?.name ?? 'P'} avatarUrl={profile?.avatar_url} size={36} />
              <span className="text-[15px] font-medium text-zinc-900">
                {profile?.name ?? 'Profil bearbeiten'}
              </span>
            </div>
            <ChevronRightIcon size={14} strokeWidth={2.5} className="shrink-0 text-zinc-300" />
          </button>
        </div>
      </div>

      {/* Einkauf */}
      <div>
        <p className={sLabel}>Einkauf</p>
        <div className={card}>
          {EINKAUF_ROWS.map(({ key, label, sg, pl }, i) => {
            const count = einkaufCounts[key as keyof typeof einkaufCounts]
            return (
              <div key={key}>
                {i > 0 && sep}
                <button
                  onClick={() => go(key)}
                  className={`${rowCls} w-full transition-colors duration-100 active:bg-zinc-50`}
                >
                  <span className="text-[15px] font-medium text-zinc-900">{label}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[14px] text-zinc-400">
                      {count > 0 ? `${count} ${count === 1 ? sg : pl}` : 'Keine'}
                    </span>
                    <ChevronRightIcon size={14} strokeWidth={2.5} className="shrink-0 text-zinc-300" />
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Haushalt — Partner-Info */}
      <div>
        <p className={sLabel}>Haushalt</p>
        <div className={card}>
          {partnerProfile ? (
            <div className={rowCls}>
              <div className="flex items-center gap-3">
                <MiniAvatar
                  name={partnerProfile.name}
                  avatarUrl={partnerProfile.avatar_url}
                  size={40}
                />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-zinc-900">{partnerProfile.name}</p>
                  {partnerProfile.email && (
                    <p className="truncate text-[12px] text-zinc-400">{partnerProfile.email}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={rowCls}>
              <span className="text-[14px] text-zinc-400">Noch kein Partner verknüpft</span>
            </div>
          )}
        </div>
      </div>

      {/* Account */}
      <div>
        <p className={sLabel}>Account</p>
        <div className={card}>
          <div className={rowCls}>
            <span className="truncate text-[14px] text-zinc-400">{session?.user.email}</span>
          </div>
          {sep}
          <button
            onClick={() => setShowResetModal(true)}
            className={`${rowCls} w-full transition-colors duration-100 active:bg-zinc-50`}
          >
            <span className="text-[15px] font-medium text-red-500">Haushalt zurücksetzen</span>
          </button>
          {sep}
          <button
            onClick={() => void signOut()}
            className={`${rowCls} w-full transition-colors duration-100 active:bg-zinc-50`}
          >
            <span className="text-[15px] font-medium text-red-500">Abmelden</span>
          </button>
        </div>
      </div>
    </div>
  )

  const profileView: ReactNode = (
    <form onSubmit={(e) => void saveName(e)} className="space-y-3">
      {/* Avatar */}
      <div className="flex justify-center pb-2">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarUploading}
          className="relative"
        >
          <div className="h-20 w-20 overflow-hidden rounded-full bg-brand-600/10">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[32px] font-bold text-brand-600">
                {profile?.name.trim()[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>
          <div className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow">
            {avatarUploading ? (
              <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
            ) : (
              <CameraIcon size={13} strokeWidth={2} />
            )}
          </div>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleAvatarChange(e)}
        />
      </div>

      {/* Name */}
      <div className={card}>
        <div className={rowCls}>
          <label className="shrink-0 text-[15px] text-zinc-500">Mein Name</label>
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="Dein Name"
            className="min-w-0 w-32 bg-transparent text-right text-[15px] font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!myName.trim()}
        className="w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-40"
      >
        {savedName ? 'Gespeichert ✓' : 'Speichern'}
      </button>
    </form>
  )

  const detailView: ReactNode = (
    <div className="space-y-3">
      {currentList.length > 0 && (
        <div className={card}>
          {currentList.map((item, i) => (
            <div key={item.id}>
              {i > 0 && sep}
              <div className={rowCls}>
                <span className="text-[15px] font-medium text-zinc-900">{item.name}</span>
                <button
                  type="button"
                  onClick={() => deleteAction(item.id)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-300 transition-all duration-150 hover:bg-red-50 hover:text-red-400 active:scale-90"
                  aria-label="Löschen"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={card}>
        <form onSubmit={submitAdd} className="flex items-center gap-3 px-4 py-[13px]">
          <input
            ref={inputRef}
            value={newVal}
            onChange={(e) => { setNewVal(e.target.value); setAddError('') }}
            placeholder={addPlaceholder}
            className="flex-1 bg-transparent text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newVal.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-all duration-150 hover:bg-brand-700 active:scale-90 disabled:opacity-30"
          >
            <PlusIcon size={15} strokeWidth={2.5} />
          </button>
        </form>
        {addError && (
          <p className="-mt-1 px-4 pb-3 text-[12px] font-medium text-red-500">{addError}</p>
        )}
      </div>
    </div>
  )

  const content = view === 'list' ? listView : view === 'profile' ? profileView : detailView

  return (
    <>
      <div className="mx-auto max-w-2xl pb-8">
        {/* Nav-Bar */}
        <div className="relative mb-5 flex h-8 items-center">
          <AnimatePresence>
            {view !== 'list' && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={back}
                className="z-10 flex items-center gap-0.5 text-brand-600"
              >
                <ChevronRightIcon size={17} strokeWidth={2.5} className="rotate-180" />
                <span className="text-[15px] font-medium">Einstellungen</span>
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {view !== 'list' && (
              <motion.h2
                key={view}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-[17px] font-semibold tracking-[-0.3px] text-zinc-900"
              >
                {VIEW_TITLES[view]}
              </motion.h2>
            )}
          </AnimatePresence>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Reset-Modal */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 pb-8"
            onClick={(e) => { if (e.target === e.currentTarget) setShowResetModal(false) }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-card-lg"
            >
              {/* Icon + Titel */}
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                  <TrashIcon size={24} className="text-red-500" />
                </div>
                <h2 className="text-[18px] font-bold tracking-[-0.3px] text-zinc-900">
                  Haushalt zurücksetzen
                </h2>
                <p className="mt-2 text-[14px] leading-snug text-zinc-500">
                  Alle Einkaufseinträge, Ausgaben, Zahlungen, Läden, Kategorien und Einheiten werden{' '}
                  <span className="font-semibold text-zinc-800">unwiderruflich gelöscht</span>.
                  Profile und Haushaltsverknüpfung bleiben erhalten.
                </p>
              </div>

              {/* Schieberegler */}
              {resetBusy ? (
                <div className="flex h-[52px] items-center justify-center rounded-full bg-red-100">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-300 border-t-red-500" />
                </div>
              ) : (
                <SlideToReset
                  onConfirm={() => {
                    setShowResetModal(false)
                    void doReset()
                  }}
                />
              )}

              {/* Abbrechen */}
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="mt-3 w-full rounded-2xl bg-zinc-100 py-3 text-[15px] font-medium text-zinc-600 transition-colors duration-100 active:bg-zinc-200"
              >
                Abbrechen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
