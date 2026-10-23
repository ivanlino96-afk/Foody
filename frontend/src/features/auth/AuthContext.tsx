import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../../data/api/http'
import { staffApi, type StaffApi } from '../../data/api/staffApi'
import { supabase, type AuthClient } from '../../data/supabase'
import type { StaffProfile } from '../../domain/staffTypes'

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in'

export interface AuthState {
  status: AuthStatus
  staff: StaffProfile | null
  token: string | null
  notice: string | null
  api: StaffApi
  signIn(email: string, password: string): Promise<string | null>
  signOut(): Promise<void>
}

export const SESSION_ENDED = 'Tu sesión terminó; vuelve a entrar'
export const NO_ACCESS = 'Tu cuenta no tiene acceso; habla con el administrador'
const BAD_CREDENTIALS = 'Correo o contraseña incorrectos'

const AuthContext = createContext<AuthState | null>(null)

function signInMessage(message: string): string {
  return /invalid login credentials/i.test(message) ? BAD_CREDENTIALS : 'No pudimos iniciar sesión; intenta de nuevo'
}

export function AuthProvider({ client: injected, children }: { client?: AuthClient; children: ReactNode }) {
  const client = useMemo(() => injected ?? (supabase().auth as unknown as AuthClient), [injected])
  const tokenRef = useRef<string | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [staff, setStaff] = useState<StaffProfile | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const clear = useCallback(() => {
    tokenRef.current = null
    setToken(null)
    setStaff(null)
    setStatus('signed_out')
  }, [])

  // True while this tab is the one signing out, so the SIGNED_OUT event is not reported as "session ended".
  const signingOut = useRef(false)
  const signOutHere = useCallback(async () => {
    signingOut.current = true
    try {
      await client.signOut({ scope: 'local' }) // never revoke other tablets sharing the account
    } finally {
      signingOut.current = false
    }
  }, [client])

  const onAuthError = useCallback((err: ApiError) => {
    if (tokenRef.current === null) return
    setNotice(err.status === 401 ? SESSION_ENDED : NO_ACCESS)
    clear()
    void signOutHere()
  }, [clear, signOutHere])

  /** Supabase pauses auto-refresh in hidden tabs; getSession() refreshes an expired token before we use it. */
  const getToken = useCallback(async () => {
    if (tokenRef.current === null) return null
    const { data } = await client.getSession()
    const fresh = data.session?.access_token
    if (fresh && tokenRef.current !== null && fresh !== tokenRef.current) {
      tokenRef.current = fresh
      setToken(fresh)
    }
    return fresh ?? tokenRef.current
  }, [client])

  const api = useMemo(() => staffApi(getToken, onAuthError), [getToken, onAuthError])

  const loadProfile = useCallback(async (accessToken: string) => {
    tokenRef.current = accessToken
    setToken(accessToken)
    try {
      const profile = await api.me()
      if (tokenRef.current !== accessToken) return
      setStaff(profile)
      setStatus('signed_in')
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return // onAuthError already ran
      setNotice(err instanceof ApiError ? err.message : 'Algo salió mal; intenta de nuevo')
      clear()
    }
  }, [api, clear])

  useEffect(() => {
    let alive = true
    void client.getSession().then(({ data }) => {
      if (!alive) return
      if (data.session) void loadProfile(data.session.access_token)
      else setStatus('signed_out')
    })
    const { data } = client.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        if (!signingOut.current && tokenRef.current !== null) setNotice(SESSION_ENDED)
        clear()
      }
      else if (session && tokenRef.current && event === 'TOKEN_REFRESHED') {
        tokenRef.current = session.access_token
        setToken(session.access_token)
      }
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [client, loadProfile, clear])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await client.signInWithPassword({ email: email.trim(), password })
    if (error || !data.session) return signInMessage(error?.message ?? '')
    setNotice(null)
    await loadProfile(data.session.access_token)
    return null
  }, [client, loadProfile])

  const signOut = useCallback(async () => {
    setNotice(null)
    clear()
    await signOutHere()
  }, [clear, signOutHere])

  const value = useMemo<AuthState>(() => ({ status, staff, token, notice, api, signIn, signOut }),
    [status, staff, token, notice, api, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
