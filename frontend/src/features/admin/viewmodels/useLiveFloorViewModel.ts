import { useEffect, useMemo, useState } from 'react'
import type { FloorTable } from '../../../domain/floor'
import type { TableMapRow } from '../../../domain/staffTypes'
import type { DinerSession } from '../../../domain/types'
import { useAuth } from '../../auth/AuthContext'
import type { FloorView, TableOverlay } from '../../floor/FloorScene'
import { TABLE_STATUS } from '../../waiter/viewmodels/tableStatus'
import { useFloorAreas } from '../../waiter/viewmodels/useFloorAreas'
import { minutesSince, useWaiterFeed } from '../../waiter/viewmodels/useWaiterFeed'

const OPEN = new Set(['occupied', 'awaiting_order', 'served', 'bill_requested'])
/** How many diners the plan draws at a busy table (the session's head count when it is smaller). */
export const SEATED = 2

export const orderNumber = (n: number) => `#${String(n).padStart(3, '0')}`

export interface LiveTable {
  row: TableMapRow
  open: boolean
  status: { label: string; color: string; fg: string }
  account: DinerSession | null
  /** Latest order of the open account, e.g. "#048". */
  lastOrder: string | null
  total: number
  minutesOpen: number | null
  area: string | null
}

function toFloorTable(t: TableMapRow): FloorTable {
  return { id: t.id, key: t.id, code: t.code, label: t.label, capacity: t.capacity ?? 4, kind: t.kind ?? 'table',
    pos_x: t.pos_x, pos_y: t.pos_y, rotation: t.rotation ?? 0 }
}

/** Live floor for the admin: the saved plan, who is sitting where and each open account, refreshed with the waiter feed. */
export function useLiveFloorViewModel() {
  const { api } = useAuth()
  const feed = useWaiterFeed()
  const areas = useFloorAreas()
  const [accounts, setAccounts] = useState<Record<string, DinerSession | null>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<FloorView>('3d')

  // Accounts reload only when an open table's money or orders move, not on every poll.
  const openRows = feed.tables.filter((t) => OPEN.has(t.status))
  const accountsKey = openRows.map((t) => `${t.id}:${t.status}:${t.consumed_cents}:${t.pending_orders}:${t.ready_orders}:${t.served_orders}`).join('|')
  useEffect(() => {
    let alive = true
    const ids = accountsKey ? accountsKey.split('|').map((k) => k.split(':')[0]) : []
    void Promise.all(ids.map((id) => api.tableAccount(id).then((a) => [id, a] as const, () => [id, null] as const)))
      .then((pairs) => { if (alive) setAccounts(Object.fromEntries(pairs)) })
    return () => { alive = false }
  }, [api, accountsKey])

  const tables = useMemo((): LiveTable[] => feed.tables.map((row) => {
    const open = OPEN.has(row.status)
    const account = open ? accounts[row.id] ?? null : null
    const last = account?.rounds.reduce((a, r) => (r.daily_number > a ? r.daily_number : a), 0) ?? 0
    return {
      row,
      open,
      status: TABLE_STATUS[row.status],
      account,
      lastOrder: last ? orderNumber(last) : null,
      total: account?.subtotal_cents ?? row.consumed_cents,
      minutesOpen: open && row.opened_at ? minutesSince(row.opened_at) : null,
      area: areas.find((a) => a.id === row.area_id)?.name ?? row.zone,
    }
  }), [feed.tables, accounts, areas])

  const planTables = useMemo(() => feed.tables.filter((t) => t.pos_x !== null && t.pos_y !== null).map(toFloorTable), [feed.tables])
  const overlays = useMemo(() => Object.fromEntries(tables.map((t): [string, TableOverlay] => [t.row.id, t.open ? {
    color: t.status.color,
    seated: Math.min(SEATED, t.row.guests_count || SEATED, t.row.capacity ?? SEATED),
    card: { title: t.lastOrder ?? t.row.code, status: t.status.label, dot: t.status.color },
  } : { color: '#FBFAF7' }])), [tables])

  const busy = tables.filter((t) => t.open)
  return {
    loading: feed.loading,
    connected: feed.connected,
    error: feed.error,
    areas,
    planTables,
    overlays,
    unplaced: feed.tables.length - planTables.length,
    stats: {
      occupied: busy.length,
      total: tables.length,
      guests: busy.reduce((n, t) => n + (t.row.guests_count ?? 0), 0),
      open: busy.reduce((n, t) => n + t.total, 0),
      bills: busy.filter((t) => t.row.status === 'bill_requested').length,
    },
    openTables: busy,
    legend: (['free', 'occupied', 'awaiting_order', 'served', 'bill_requested'] as const).map((s) => TABLE_STATUS[s]),
    selected: tables.find((t) => t.row.id === selectedId) ?? null,
    select: setSelectedId,
    view,
    setView,
  }
}
