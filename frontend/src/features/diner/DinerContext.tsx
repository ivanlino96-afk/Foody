import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../../data/api/http'
import { dinerApi, type DinerApi } from '../../data/api/dinerApi'
import { loadCart, saveCart } from '../../data/repositories/cartStore'
import type { CartLine } from '../../domain/cart'
import type { DinerSession, DinerTable, MenuCategory, MenuItem } from '../../domain/types'
import { usePolling } from '../../shared/usePolling'

export const SESSION_POLL_MS = 5_000
export const MENU_POLL_MS = 30_000

export type DinerStatus = 'loading' | 'ready' | 'invalid_qr' | 'error'

export interface DinerState {
  token: string
  api: DinerApi
  status: DinerStatus
  table: DinerTable | null
  session: DinerSession | null
  /** True once a session with rounds was seen and later disappeared (the bill was paid and closed). */
  sessionEnded: boolean
  menu: MenuCategory[]
  itemsById: Record<string, MenuItem>
  menuLoaded: boolean
  refreshSession: () => Promise<void>
  refreshMenu: () => Promise<void>
  cart: CartLine[]
  setCart: (next: CartLine[]) => void
}

const DinerContext = createContext<DinerState | null>(null)

export function DinerProvider({ token, api: injected, children }: { token: string; api?: DinerApi; children: ReactNode }) {
  const api = useMemo(() => injected ?? dinerApi(token), [injected, token])
  const [status, setStatus] = useState<DinerStatus>('loading')
  const [table, setTable] = useState<DinerTable | null>(null)
  const [session, setSession] = useState<DinerSession | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [menu, setMenu] = useState<MenuCategory[]>([])
  const [menuLoaded, setMenuLoaded] = useState(false)
  const [cart, setCartState] = useState<CartLine[]>(() => loadCart(token))

  const refreshSession = useCallback(async () => {
    try {
      const [nextTable, nextSession] = await Promise.all([api.getTable(), api.getSession()])
      setTable(nextTable)
      setSession((previous) => {
        if (nextSession === null && previous && previous.rounds.length > 0) setSessionEnded(true)
        if (nextSession !== null) setSessionEnded(false)
        return nextSession
      })
      setStatus('ready')
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setStatus('invalid_qr')
      else setStatus((s) => (s === 'ready' ? s : 'error'))
      throw err
    }
  }, [api])

  const refreshMenu = useCallback(async () => {
    const next = await api.getMenu()
    setMenu(next)
    setMenuLoaded(true)
  }, [api])

  const polling = status !== 'invalid_qr'
  usePolling(refreshSession, SESSION_POLL_MS, polling)
  usePolling(refreshMenu, MENU_POLL_MS, polling)

  const itemsById = useMemo(
    () => Object.fromEntries(menu.flatMap((c) => c.items).map((i) => [i.id, i])),
    [menu],
  )

  const setCart = useCallback((next: CartLine[]) => {
    setCartState(next)
    saveCart(token, next)
  }, [token])

  const value: DinerState = {
    token, api, status, table, session, sessionEnded, menu, itemsById, menuLoaded, refreshSession, refreshMenu,
    cart, setCart,
  }
  return <DinerContext.Provider value={value}>{children}</DinerContext.Provider>
}

export function useDiner(): DinerState {
  const value = useContext(DinerContext)
  if (!value) throw new Error('useDiner must be used inside DinerProvider')
  return value
}
