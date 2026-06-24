import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Statt einer komplett weissen Seite: sichtbare, verstaendliche Meldung
  // direkt im DOM rendern. So ist sofort klar, woran es liegt – ohne dass man
  // erst die Browser-Konsole oeffnen muss.
  const msg =
    'Konfiguration unvollstaendig: Die Supabase-Umgebungsvariablen ' +
    'VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY fehlen im Build. ' +
    'Beim Deploy ueber GitHub Actions muessen sie als Repository-Secrets ' +
    'gesetzt sein (Settings → Secrets and variables → Actions). ' +
    'Lokal gehoeren sie in eine .env-Datei (siehe .env.example).'

  const target = document.getElementById('root') ?? document.body
  target.innerHTML = `
    <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;background:#F5F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:420px;width:100%;background:#fff;border-radius:24px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,0.07),0 1px 4px rgba(0,0,0,0.04);text-align:center;">
        <div style="width:48px;height:48px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:#FEE2E2;color:#EF4444;font-size:24px;font-weight:700;">!</div>
        <h1 style="margin:0 0 10px;font-size:18px;font-weight:700;letter-spacing:-0.3px;color:#18181B;">App nicht konfiguriert</h1>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#71717A;">${msg}</p>
      </div>
    </div>`

  // Trotzdem werfen, damit der restliche Code nicht mit ungueltigen Werten
  // weiterlaeuft. Die Meldung oben bleibt dabei sichtbar im DOM stehen.
  throw new Error('Supabase-Umgebungsvariablen fehlen (siehe Hinweis auf der Seite).')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
