import { useCallback, useMemo, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import { formatMoney } from '../../../domain/money'
import type { KitchenOrder, TableMapRow } from '../../../domain/staffTypes'
import type { TableStatus } from '../../../domain/types'
import { useAuth } from '../../auth/AuthContext'
import { TABLE_STATUS } from './tableStatus'
import { minutesSince, type WaiterFeed } from './useWaiterFeed'

const ORDER_WORD: Record<string, string> = { received: 'recibida', preparing: 'preparando', ready: 'lista' }
const orderNumber = (o: KitchenOrder) => `#${String(o.daily_number).padStart(3, '0')}`

function detailFor(t: TableMapRow, orders: KitchenOrder[]): string {
  switch (t.status) {
    case 'free':
      return 'Toca para abrir'
    case 'occupied':
      return t.pending_calls > 0 ? 'Llamó al mesero' : `Abierta hace ${minutesSince(t.status_changed_at)} min`
    case 'awaiting_order': {
      const ready = orders.find((o) => o.status === 'ready')
      const order = ready ?? orders.find((o) => o.status !== 'served')
      if (!order) return `Saldo ${formatMoney(t.balance_cents)}`
      return `${orderNumber(order)} ${ORDER_WORD[order.status]} · ${minutesSince(order.created_at)} min`
    }
    case 'served':
      return `Cuenta ${formatMoney(t.balance_cents)}`
    case 'bill_requested':
      return `Saldo ${formatMoney(t.balance_cents)}`
    case 'closed':
      return `Cerrada hace ${minutesSince(t.status_changed_at)} min`
  }
}

export interface TableCard extends TableMapRow {
  label: string
  meta: string
  color: string
  fg: string
  detail: string
  orders: KitchenOrder[]
}

const OCCUPIED: TableStatus[] = ['occupied', 'awaiting_order', 'served', 'bill_requested']

export function useTablesMapViewModel(feed: WaiterFeed) {
  const { api } = useAuth()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const tables = useMemo<TableCard[]>(() => feed.tables.map((t) => {
    const orders = feed.orders.filter((o) => o.table_code === t.code).sort((a, b) => a.created_at.localeCompare(b.created_at))
    return { ...t, ...TABLE_STATUS[t.status], meta: t.zone ?? t.label ?? '', detail: detailFor(t, orders), orders }
  }), [feed.tables, feed.orders])

  const occupied = tables.filter((t) => OCCUPIED.includes(t.status)).length
  const selected = tables.find((t) => t.id === selectedId) ?? null

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true)
    setNotice(null)
    try {
      await action()
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudo completar la acción')
    } finally {
      setBusy(false)
      await feed.refresh().catch(() => undefined)
    }
  }, [feed])

  const withSelected = (fn: (t: TableCard) => Promise<unknown>) => () => (selected ? run(() => fn(selected)) : Promise.resolve())

  return {
    loading: feed.loading,
    connected: feed.connected,
    tables,
    occupiedLine: `${occupied} de ${tables.length} ocupadas`,
    legend: Object.values(TABLE_STATUS),
    selected,
    select: setSelectedId,
    busy,
    notice,
    dismissNotice: () => setNotice(null),
    open: (guests?: number) => (selected ? run(() => api.openTable(selected.id, guests)) : Promise.resolve()),
    reopen: withSelected((t) => api.reopenTable(t.id)),
    release: withSelected((t) => api.releaseTable(t.id)),
    requestBill: withSelected((t) => api.requestBill(t.id)),
    serve: (orderId: string) => run(() => api.serveOrder(orderId)),
    cancel: (orderId: string, reason: string) => run(() => api.cancelOrder(orderId, reason)),
  }
}
