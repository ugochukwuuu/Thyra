import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env (see client/.env.example).')

/**
 * Used only for signing in and out: Supabase Auth keeps the session in the browser and refreshes it.
 * Everything else goes through the Thyra API (lib/api.js), which reads the access token.
 */
export const supabase = createClient(url, anonKey)

/** The Thyra API: the `api` Edge Function. VITE_API_URL points somewhere else, e.g. the API run locally. */
export const API_URL = (import.meta.env.VITE_API_URL || `${url}/functions/v1/api`).replace(/\/$/, '')

/** The current access token, refreshed first if it is about to expire. Null when signed out. */
export async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
