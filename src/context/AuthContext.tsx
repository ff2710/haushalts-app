import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import * as profileService from '../services/profileService'
import type { Profile } from '../types'

interface AuthContextValue {
  session:           Session | null
  profile:           Profile | null
  loading:           boolean
  /** true, solange der Nutzer über einen Passwort-Reset-Link hereinkam und
   *  ein neues Passwort setzen soll. */
  recovery:          boolean
  signIn:            (email: string, password: string) => Promise<{ error: string | null }>
  signUp:            (email: string, password: string) => Promise<{ error: string | null }>
  signOut:           () => Promise<void>
  resetPassword:     (email: string) => Promise<{ error: string | null }>
  updatePassword:    (password: string) => Promise<{ error: string | null }>
  createProfile:     (name: string) => Promise<{ error: string | null }>
  updateProfileName: (name: string) => Promise<{ error: string | null }>
  updateAvatar:      (file: File) => Promise<{ error: string | null }>
}

/** Zieladresse für den Link in der Reset-Mail. Beachtet die GitHub-Pages-Basis
 *  (vite `base`), damit der Link lokal wie deployed funktioniert. */
function redirectUrl(): string {
  return window.location.origin + import.meta.env.BASE_URL
}

// Das Event PASSWORD_RECOVERY feuert nur EINMAL — beim Laden der Seite mit den
// Recovery-Parametern in der URL. Ohne Merker käme man nach einem simplen
// Reload an der Passwort-Vergabe vorbei direkt in die App. Deshalb wird die
// Sperre zusätzlich im sessionStorage gehalten (pro Tab, übersteht Reload) und
// erst beim Setzen des Passworts oder beim Abmelden gelöscht.
const RECOVERY_KEY = 'pf_recovery'

const readRecoveryFlag = (): boolean => {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === '1'
  } catch {
    return false // z. B. Safari im privaten Modus
  }
}

const writeRecoveryFlag = (on: boolean): void => {
  try {
    if (on) sessionStorage.setItem(RECOVERY_KEY, '1')
    else sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    /* Storage nicht verfügbar — dann greift nur der In-Memory-State. */
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(readRecoveryFlag)

  const loadProfile = async (userId: string) => {
    const { data } = await profileService.fetchProfile(userId)
    setProfile(data as Profile | null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        loadProfile(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      // Der Reset-Link meldet den Nutzer an. Dieses Flag sorgt dafuer, dass er
      // zuerst ein neues Passwort setzt, statt direkt in der App zu landen.
      if (event === 'PASSWORD_RECOVERY') {
        writeRecoveryFlag(true)
        setRecovery(true)
      }
      if (event === 'SIGNED_OUT') {
        writeRecoveryFlag(false)
        setRecovery(false)
      }

      setSession(sess)
      if (sess) {
        void loadProfile(sess.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error ? error.message : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  /** Schickt die Reset-Mail. Die Antwort ist bewusst immer gleich, damit man
   *  nicht ausprobieren kann, welche Adressen registriert sind. */
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl(),
    })
    return { error: error ? error.message : null }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: error.message }
    writeRecoveryFlag(false)
    setRecovery(false)
    return { error: null }
  }

  const createProfile = async (name: string) => {
    if (!session) return { error: 'Nicht angemeldet' }
    const { data, error } = await profileService.createProfile(
      session.user.id,
      name,
      session.user.email ?? null
    )
    if (error) return { error: error.message }
    setProfile(data as Profile)
    return { error: null }
  }

  const updateProfileName = async (name: string) => {
    if (!session) return { error: 'Nicht angemeldet' }
    const { data, error } = await profileService.updateProfileName(session.user.id, name)
    if (error) return { error: error.message }
    setProfile(data as Profile)
    return { error: null }
  }

  const updateAvatar = async (file: File) => {
    if (!session) return { error: 'Nicht angemeldet' }
    const { publicUrl, error: uploadError } = await profileService.uploadAvatar(
      session.user.id,
      file
    )
    if (uploadError) return { error: uploadError.message }
    if (!publicUrl) return { error: 'Avatar-Upload fehlgeschlagen' }
    const { data, error } = await profileService.updateAvatarUrl(session.user.id, publicUrl)
    if (error) return { error: error.message }
    setProfile(data as Profile)
    return { error: null }
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, recovery, signIn, signUp, signOut, resetPassword, updatePassword, createProfile, updateProfileName, updateAvatar }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden')
  return ctx
}
