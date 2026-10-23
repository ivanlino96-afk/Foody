import { useCallback, useMemo, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import { TABLE_KINDS } from '../../../domain/floor'
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

export interface OrderProgress {
  received: number
  preparing: number
  ready: number
  served: number
}

export interface TableCard extends TableMapRow {
  label: string
  meta: string
  color: string
  fg: string
  detail: string
  orders: KitchenOrder[]
  kindLabel: string
  /** "3/4 personas" when open, "4 lugares" otherwise. */
  people: string
  /** Minutes since the table was opened (open tables) or since its last change. */
  minutes: number
  open: boolean
  progress: OrderProgress
  /** Short line under the progress bar: "1 servida · 1 lista · 2 en cocina". */
  progressLine: string
  /** Floating badge on the 3D plan: the most urgent thing at this table. */
  badge: { text: string; color: string } | null
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function progressOf(t: TableMapRow, orders: KitchenOrder[]): OrderProgress {
  const count = (s: string) => orders.filter((o) => o.status === s).length
  return { received: count('received'), preparing: count('preparing'), ready: count('ready'), served: t.served_orders }
}

function progressLine(p: OrderProgress): string {
  const parts = []
  if (p.served) parts.push(plural(p.served, 'servida', 'servidas'))
  if (p.ready) parts.push(plural(p.ready, 'lista', 'listas'))
  if (p.received + p.preparing) parts.push(`${p.received + p.preparing} en cocina`)
  return parts.join(' · ')
}

function badgeFor(t: TableMapRow, p: OrderProgress): TableCard['badge'] {
  if (t.status === 'bill_requested') return { text: 'Cuenta', color: '#E11D48' }
  if (t.pending_calls > 0) return { text: 'Llamada', color: '#2B4A6B' }
  if (p.ready > 0) return { text: p.ready === 1 ? 'Lista' : `${p.ready} listas`, color: '#2F4A3A' }
  return null
}

const OCCUPIED: TableStatus[] = ['occupied', 'awaiting_order', 'served', 'bill_requested']

export function useTablesMapViewModel(feed: WaiterFeed) {
  const { api } = useAuth()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const tables = useMemo<TableCard[]>(() => feed.tables.map((t) => {
    const orders = feed.orders.filter((o) => o.table_code === t.code).sort((a, b) => a.created_at.localeCompare(b.created_at))
    const open = OCCUPIED.includes(t.status)
    const progress = progressOf(t, orders)
    const seats = t.capacity ?? 0
    const people = open && t.guests_count ? `${t.guests_count}${seats ? `/${seats}` : ''} personas`
      : seats ? plural(seats, 'lugar', 'lugares') : ''
    return { ...t, ...TABLE_STATUS[t.status], meta: t.zone ?? t.label ?? '', detail: detailFor(t, orders), orders,
      kindLabel: TABLE_KINDS[t.kind ?? 'table'].label, people, open,
      minutes: minutesSince(open && t.opened_at ? t.opened_at : t.status_changed_at),
      progress, progressLine: progressLine(progress), badge: badgeFor(t, progress) }
  }), [feed.tables, feed.orders])

  const occupied = tables.filter((t) => OCCUPIED.includes(t.status)).length
  const stats = {
    occupied,
    total: tables.length,
    guests: tables.reduce((s, t) => s + (t.open ? t.guests_count ?? 0 : 0), 0),
    seats: tables.reduce((s, t) => s + (t.capacity ?? 0), 0),
    ready: tables.reduce((s, t) => s + t.progress.ready, 0),
    bills: tables.filter((t) => t.status === 'bill_requested').length,
    calls: tables.filter((t) => t.pending_calls > 0).length,
  }
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
    stats,
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
