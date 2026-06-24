import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthContextValue {
  session:           Session | null
  profile:           Profile | null
  loading:           boolean
  signIn:            (email: string, password: string) => Promise<{ error: string | null }>
  signUp:            (email: string, password: string) => Promise<{ error: string | null }>
  signOut:           () => Promise<void>
  createProfile:     (name: string) => Promise<{ error: string | null }>
  updateProfileName: (name: string) => Promise<{ error: string | null }>
  updateAvatar:      (file: File) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
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

  const createProfile = async (name: string) => {
    if (!session) return { error: 'Nicht angemeldet' }
    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: session.user.id, name: name.trim(), email: session.user.email ?? null })
      .select()
      .single()
    if (error) return { error: error.message }
    setProfile(data as Profile)
    return { error: null }
  }

  const updateAvatar = async (file: File) => {
    if (!session) return { error: 'Nicht angemeldet' }
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${session.user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) return { error: uploadError.message }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    // Cache-Buster: Timestamp als Query-Param speichern
    const avatarUrl = `${publicUrl}?t=${Date.now()}`
    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', session.user.id)
      .select()
      .single()
    if (error) return { error: error.message }
    setProfile(data as Profile)
    return { error: null }
  }

  const updateProfileName = async (name: string) => {
    if (!session) return { error: 'Nicht angemeldet' }
    const { data, error } = await supabase
      .from('profiles')
      .update({ name: name.trim() })
      .eq('id', session.user.id)
      .select()
      .single()
    if (error) return { error: error.message }
    setProfile(data as Profile)
    return { error: null }
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signIn, signUp, signOut, createProfile, updateProfileName, updateAvatar }}
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
