import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in dev rather than silently hitting undefined endpoints.
  // eslint-disable-next-line no-console
  console.error(
    'Variables Supabase manquantes. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans votre .env'
  )
}

// ⚠️ Client-side: uniquement la clé publique "anon". La service_role key
// ne doit JAMAIS apparaître ici — elle vit uniquement côté Edge Functions.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
