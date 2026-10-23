import { vi } from 'vitest'
import type { AuthClient } from '../data/supabase'
import type { StaffProfile } from '../domain/staffTypes'

export const PROFILES: Record<StaffProfile['role'], StaffProfile> = {
  admin: { id: '1', full_name: 'Admin Demo', role: 'admin' },
  kitchen: { id: '2', full_name: 'Cocina Demo', role: 'kitchen' },
  waiter: { id: '3', full_name: 'Mesero Demo', role: 'waiter' },
}

/** In-memory stand-in for supabase.auth; `token` is the session already stored in the browser. */
export function fakeAuthClient(token: string | null = null, signInError: string | null = null) {
  let listener: ((event: string, session: { access_token: string } | null) => void) | null = null
  let current = token ? { access_token: token } : null
  const client = {
    getSession: vi.fn(async () => ({ data: { session: current } })),
    signInWithPassword: vi.fn(async ({ email }: { email: string; password: string }) => {
      if (signInError) return { data: { session: null }, error: { message: signInError } }
      current = { access_token: `tok-${email}` }
      listener?.('SIGNED_IN', current)
      return { data: { session: current }, error: null }
    }),
    signOut: vi.fn(async (options?: { scope?: 'global' | 'local' | 'others' }) => {
      void options // recorded by vi.fn for assertions
      current = null
      listener?.('SIGNED_OUT', null)
    }),
    onAuthStateChange: vi.fn((cb: typeof listener) => {
      listener = cb
      return { data: { subscription: { unsubscribe: () => { listener = null } } } }
    }),
  }
  return Object.assign(client satisfies AuthClient, {
    /** What supabase-js does on a silent refresh: getSession() starts returning a new token. */
    rotate: (next: string) => { current = { access_token: next } },
    /** An auth event that did not come from this tab (e.g. the refresh token was revoked elsewhere). */
    emit: (event: string) => {
      if (event === 'SIGNED_OUT') current = null
      listener?.(event, current)
    },
  })
}

type Handler = (init: RequestInit) => { status: number; body?: unknown }

/** Stubs window.fetch by "METHOD /path" (path without /api/v1); unmatched routes answer 404. */
export function stubFetch(routes: Record<string, Handler | { status: number; body?: unknown }>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input).replace('/api/v1', '').split('?')[0]
    const key = `${init.method ?? 'GET'} ${url}`
    const route = routes[key]
    const res = typeof route === 'function' ? route(init) : route ?? { status: 404, body: { code: 'not_found', message: 'No existe' } }
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), {
      status: res.status, headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export const meAs = (role: StaffProfile['role']) => ({ status: 200, body: PROFILES[role] })
