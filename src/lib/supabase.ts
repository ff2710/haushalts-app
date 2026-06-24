import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Frueher, klarer Fehler statt kryptischer Folgefehler im Betrieb.
  throw new Error(
    'Supabase-Umgebungsvariablen fehlen. Lege eine .env-Datei mit ' +
      'VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY an (siehe .env.example).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
