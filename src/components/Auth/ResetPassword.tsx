import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import PasswordForm from './PasswordForm'

/**
 * Recovery-Screen: erscheint, wenn der Nutzer über den Link aus der
 * Reset-Mail hereinkommt (Auth-Event PASSWORD_RECOVERY). Er hat dann zwar eine
 * gültige Sitzung, soll aber zuerst ein neues Passwort setzen — deshalb liegt
 * dieser Screen in App.tsx vor der eigentlichen App.
 */
export default function ResetPassword() {
  const { signOut } = useAuth()

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
            <div className="mx-auto mb-4 flex h-[56px] w-[56px] items-center justify-center rounded-[18px] bg-brand-600 text-[26px] shadow-soft">
              🔑
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.5px] text-zinc-900">
              Neues Passwort
            </h1>
            <p className="mt-1.5 text-[14px] leading-snug text-zinc-500">
              Vergib jetzt ein neues Passwort für deinen Account.
            </p>
          </div>

          <PasswordForm submitLabel="Passwort setzen" />

          <div className="mt-6 text-center text-[13px] text-zinc-500">
            <button
              type="button"
              onClick={() => void signOut()}
              className="font-semibold text-brand-600 transition-opacity duration-150 hover:opacity-75"
            >
              Abbrechen und abmelden
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
