import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'http://127.0.0.1:54321'
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

let client: SupabaseClient | null = null

/** Browser client with the anon key only; staff identity comes from the signed-in session. */
export function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}

/** The slice of supabase.auth the app uses, so tests can pass a fake. getSession() refreshes an expired token. */
export interface AuthClient {
  getSession(): Promise<{ data: { session: { access_token: string } | null } }>
  signInWithPassword(c: { email: string; password: string }): Promise<{ data: { session: { access_token: string } | null }; error: { message: string } | null }>
  signOut(options?: { scope?: 'global' | 'local' | 'others' }): Promise<unknown>
  onAuthStateChange(cb: (event: string, session: { access_token: string } | null) => void): { data: { subscription: { unsubscribe(): void } } }
}
