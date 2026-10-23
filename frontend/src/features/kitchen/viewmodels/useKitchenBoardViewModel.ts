import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import { useLiveRefresh } from '../../../data/realtime'
import type { KitchenOrder } from '../../../domain/staffTypes'
import { playChime } from '../../../shared/sound'
import { useAuth } from '../../auth/AuthContext'

export const KITCHEN_POLL_MS = 10_000
export const LATE_AFTER_MS = 15 * 60_000

type Column = 'received' | 'preparing' | 'ready'
const TITLES: Record<Column, string> = { received: 'Recibidas', preparing: 'Preparando', ready: 'Listas' }
const ACTIONS: Record<Column, string | null> = { received: 'Empezar', preparing: 'Marcar lista', ready: null }

export interface TicketItem {
  qty: number
  name: string
  note: string | null
  mods: { text: string; kind: 'remove' | 'add' }[]
}

export interface Ticket {
  id: string
  status: Column
  number: string
  table: string
  round: number
  elapsed: string
  late: boolean
  action: string | null
  items: TicketItem[]
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const mm = Math.floor(total / 60)
  return `${String(mm).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function toTicket(order: KitchenOrder, now: number): Ticket {
  const status = order.status as Column
  const age = now - Date.parse(order.created_at)
  return {
    id: order.id,
    status,
    number: `#${String(order.daily_number).padStart(3, '0')}`,
    table: order.table_code,
    round: order.round_number,
    elapsed: formatElapsed(age),
    late: status !== 'ready' && age > LATE_AFTER_MS,
    action: ACTIONS[status],
    items: order.lines.map((l) => ({
      qty: l.quantity,
      name: l.item_name,
      note: l.note,
      mods: [...l.removed.map((r) => ({ text: `Sin ${r}`, kind: 'remove' as const })),
             ...l.extras.map((e) => ({ text: `+ ${e}`, kind: 'add' as const }))],
    })),
  }
}

export function useKitchenBoardViewModel() {
  const { api } = useAuth()
  const [orders, setOrders] = useState<KitchenOrder[] | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const seen = useRef<Set<string> | null>(null)

  const refresh = useCallback(async () => {
    let next: KitchenOrder[]
    try {
      next = await api.kitchenOrders()
      setLoadError(null)
    } catch (err) {
      setLoadError('No se pudo actualizar; reintentando…')
      throw err
    }
    const received = next.filter((o) => o.status === 'received').map((o) => o.id)
    if (seen.current && received.some((id) => !seen.current!.has(id))) playChime()
    seen.current = new Set([...(seen.current ?? []), ...received])
    setOrders(next)
    setNow(Date.now())
  }, [api])

  const { connected } = useLiveRefresh(['orders'], refresh, KITCHEN_POLL_MS)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const columns = useMemo(() => (['received', 'preparing', 'ready'] as Column[]).map((status) => ({
    status,
    title: TITLES[status],
    tickets: (orders ?? []).filter((o) => o.status === status).map((o) => toTicket(o, now)),
  })), [orders, now])

  const cooking = (orders ?? []).filter((o) => o.status !== 'ready')
  const avgPrepMinutes = cooking.length
    ? Math.round(cooking.reduce((sum, o) => sum + (now - Date.parse(o.created_at)), 0) / cooking.length / 60_000)
    : null

  const advance = useCallback(async (id: string, status: 'preparing' | 'ready') => {
    setBusyId(id)
    setNotice(null)
    try {
      await api.setKitchenStatus(id, status)
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudo actualizar la orden')
    } finally {
      setBusyId(null)
      await refresh().catch(() => undefined)
    }
  }, [api, refresh])

  return {
    loading: orders === null,
    columns,
    activeCount: orders?.length ?? 0,
    avgPrepMinutes,
    connected,
    busyId,
    notice,
    loadError,
    dismissNotice: () => setNotice(null),
    start: (id: string) => advance(id, 'preparing'),
    markReady: (id: string) => advance(id, 'ready'),
  }
}
