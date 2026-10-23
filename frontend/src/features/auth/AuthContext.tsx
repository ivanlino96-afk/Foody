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

  const onAuthError = useCallback((err: ApiError) => {
    if (tokenRef.current === null) return
    setNotice(err.status === 401 ? SESSION_ENDED : NO_ACCESS)
    clear()
    void client.signOut()
  }, [client, clear])

  const api = useMemo(() => staffApi(() => tokenRef.current, onAuthError), [onAuthError])

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
      if (event === 'SIGNED_OUT') clear()
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
    await client.signOut()
  }, [client, clear])

  const value = useMemo<AuthState>(() => ({ status, staff, token, notice, api, signIn, signOut }),
    [status, staff, token, notice, api, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
