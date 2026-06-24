import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { CameraIcon, HouseIcon } from '../ui/Icon'
import AvatarCircle from '../ui/AvatarCircle'

export default function Onboarding() {
  const { createProfile, updateAvatar, signOut } = useAuth()
  const { linkCurrentUser, settings, nameA, profileA } = useApp()

  const isPersonB = !!(settings?.person_a_id && !settings?.person_b_id)

  const [name, setName]                     = useState('')
  const [error, setError]                   = useState<string | null>(null)
  const [busy, setBusy]                     = useState(false)
  const [avatarFile, setAvatarFile]         = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview]   = useState<string | null>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)

    const { error: createErr } = await createProfile(trimmed)
    if (createErr) {
      setError(createErr)
      setBusy(false)
      return
    }

    if (avatarFile) {
      await updateAvatar(avatarFile)
    }

    await linkCurrentUser()
    // AuthContext's profile ist jetzt gesetzt → App.tsx rendert Shell automatisch
  }

  const inputCls =
    'w-full rounded-xl bg-zinc-50 ring-1 ring-black/[0.10] px-4 py-3 text-[15px] ' +
    'text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 ' +
    'focus:ring-brand-500 transition-[box-shadow] duration-150'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F2] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-sm"
      >
        <div className="rounded-3xl bg-white p-8 shadow-card-lg ring-1 ring-black/[0.05]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-600 text-white shadow-soft">
              <HouseIcon size={26} />
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.5px] text-zinc-900">
              Willkommen!
            </h1>
            <p className="mt-2 text-[14px] leading-snug text-zinc-500">
              Wie heißt du? Dein Name wird deinem Partner angezeigt.
            </p>
          </div>

          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            {/* Avatar-Auswahl */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative"
              >
                <div className="h-20 w-20 overflow-hidden rounded-full bg-zinc-100">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Vorschau" className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-300">
                      <CameraIcon size={32} />
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow">
                  <CameraIcon size={13} strokeWidth={2} />
                </div>
              </button>
              <p className="text-center text-[11px] leading-snug text-zinc-400">
                Optional · kann später in den Einstellungen geändert werden
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {isPersonB && (
              <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4">
                <AvatarCircle
                  name={nameA}
                  avatarUrl={profileA?.avatar_url}
                  size={40}
                  bgClassName="bg-brand-100"
                  textClassName="text-brand-700"
                />
                <p className="text-[14px] font-medium text-brand-700">
                  Du verbindest dich mit {nameA}s Haushalt
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-zinc-600">
                Dein Name
              </label>
              <input
                ref={inputRef}
                type="text"
                required
                autoFocus
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="z. B. Caro"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] leading-snug text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="mt-1 w-full rounded-xl bg-brand-600 py-3 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
            >
              {busy ? 'Speichern…' : 'Los geht\'s'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-[13px] text-zinc-400 transition-opacity duration-150 hover:opacity-75"
            >
              Abmelden
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
