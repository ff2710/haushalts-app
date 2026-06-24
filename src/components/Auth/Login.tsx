import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode]         = useState<'login' | 'signup'>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [info, setInfo]         = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    const fn = mode === 'login' ? signIn : signUp
    const { error } = await fn(email.trim(), password)
    setBusy(false)
    if (error) {
      setError(error)
    } else if (mode === 'signup') {
      setInfo(
        'Account erstellt. Falls die E-Mail-Bestätigung aktiv ist, bitte den ' +
        'Bestätigungslink in der Mail anklicken. Danach einloggen.'
      )
      setMode('login')
    }
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
          {/* Logo & Titel */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-[56px] w-[56px] items-center justify-center rounded-[18px] bg-brand-600 text-[26px] shadow-soft">
              🏠
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.5px] text-zinc-900">
              Haushalt
            </h1>
            <p className="mt-1.5 text-[14px] text-zinc-500">
              {mode === 'login' ? 'Anmelden, um fortzufahren' : 'Neuen Account erstellen'}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-zinc-600">
                E-Mail
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="du@beispiel.de"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-zinc-600">
                Passwort
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
              />
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  key="error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] leading-snug text-red-700"
                >
                  {error}
                </motion.p>
              )}
              {info && (
                <motion.p
                  key="info"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="rounded-xl bg-emerald-50 px-4 py-2.5 text-[13px] leading-snug text-emerald-700"
                >
                  {info}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={busy}
              className="mt-1 w-full rounded-xl bg-brand-600 py-3 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.97] disabled:opacity-55"
            >
              {busy ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : 'Registrieren'}
            </button>
          </form>

          <div className="mt-6 text-center text-[13px] text-zinc-500">
            {mode === 'login' ? 'Noch kein Account?' : 'Schon registriert?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError(null)
                setInfo(null)
              }}
              className="font-semibold text-brand-600 transition-opacity duration-150 hover:opacity-75"
            >
              {mode === 'login' ? 'Registrieren' : 'Anmelden'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
