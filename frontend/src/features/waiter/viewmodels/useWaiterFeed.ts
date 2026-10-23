import { useCallback, useState } from 'react'
import { useLiveRefresh } from '../../../data/realtime'
import type { KitchenOrder, ServiceCallRow, TableMapRow } from '../../../domain/staffTypes'
import { useAuth } from '../../auth/AuthContext'

export const WAITER_POLL_MS = 5_000
export const LOAD_ERROR = 'No se pudo actualizar; reintentando…'

export interface WaiterFeed {
  loading: boolean
  connected: boolean
  /** Set while the last load failed; polling keeps retrying. */
  error: string | null
  tables: TableMapRow[]
  orders: KitchenOrder[]
  calls: ServiceCallRow[]
  refresh(): Promise<void>
}

/** One shared load of tables, active orders and pending calls for the waiter screen (Realtime + 5 s polling). */
export function useWaiterFeed(): WaiterFeed {
  const { api } = useAuth()
  const [data, setData] = useState<{ tables: TableMapRow[]; orders: KitchenOrder[]; calls: ServiceCallRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [tables, orders, calls] = await Promise.all([api.tables(), api.kitchenOrders(), api.serviceCalls()])
      setData({ tables, orders, calls })
      setError(null)
    } catch (err) {
      setError(LOAD_ERROR)
      throw err
    }
  }, [api])

  const { connected } = useLiveRefresh(['orders', 'dining_tables', 'service_calls', 'payments'], refresh, WAITER_POLL_MS)
  return { loading: data === null, connected, error, tables: data?.tables ?? [], orders: data?.orders ?? [],
    calls: data?.calls ?? [], refresh }
}

export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
}

export function agoLabel(iso: string): string {
  const m = minutesSince(iso)
  return m === 0 ? 'ahora' : `hace ${m} min`
}
