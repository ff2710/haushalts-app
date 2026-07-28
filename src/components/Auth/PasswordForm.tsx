import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'

const MIN_LENGTH = 6

interface Props {
  /** Wird nach erfolgreichem Setzen aufgerufen (z. B. Sheet schließen). */
  onDone?: () => void
  submitLabel?: string
}

/**
 * Formular zum Setzen eines neuen Passworts. Wird an zwei Stellen genutzt:
 * im Recovery-Screen (nach Klick auf den Link aus der Mail) und in den
 * Einstellungen zum bewussten Ändern.
 */
export default function PasswordForm({ onDone, submitLabel = 'Passwort speichern' }: Props) {
  const { updatePassword } = useAuth()
  const [pw1, setPw1]     = useState('')
  const [pw2, setPw2]     = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone]   = useState(false)
  const [busy, setBusy]   = useState(false)

  const tooShort = pw1.length > 0 && pw1.length < MIN_LENGTH
  const mismatch = pw2.length > 0 && pw1 !== pw2
  const valid    = pw1.length >= MIN_LENGTH && pw1 === pw2

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    const { error } = await updatePassword(pw1)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    setDone(true)
    setPw1('')
    setPw2('')
    onDone?.()
  }

  const inputCls =
    'w-full rounded-xl bg-zinc-50 ring-1 ring-black/[0.10] px-4 py-3 text-[15px] ' +
    'text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 ' +
    'focus:ring-brand-500 transition-[box-shadow] duration-150'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-[13px] font-medium text-zinc-600">Neues Passwort</label>
        <input
          type="password"
          required
          minLength={MIN_LENGTH}
          autoComplete="new-password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          className={inputCls}
          placeholder="••••••••"
        />
        {tooShort && (
          <p className="text-[12px] text-zinc-400">Mindestens {MIN_LENGTH} Zeichen.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block text-[13px] font-medium text-zinc-600">Wiederholen</label>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className={inputCls}
          placeholder="••••••••"
        />
        {mismatch && (
          <p className="text-[12px] text-red-500">Die Passwörter stimmen nicht überein.</p>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] leading-snug text-red-700">
          {error}
        </p>
      )}
      {done && !error && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-[13px] leading-snug text-emerald-700">
          Passwort geändert.
        </p>
      )}

      <button
        type="submit"
        disabled={!valid || busy}
        className="w-full rounded-xl bg-brand-600 py-3 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.97] disabled:opacity-55"
      >
        {busy ? 'Bitte warten…' : submitLabel}
      </button>
    </form>
  )
}
