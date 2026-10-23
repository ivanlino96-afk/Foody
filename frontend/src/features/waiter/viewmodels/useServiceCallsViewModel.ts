import { useMemo, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import { formatMoney } from '../../../domain/money'
import { useAuth } from '../../auth/AuthContext'
import { agoLabel, type WaiterFeed } from './useWaiterFeed'

export type AlertKind = 'Lista' | 'Llamada' | 'Cuenta'

export interface WaiterAlert {
  key: string
  kind: AlertKind
  table: string
  at: string
  ago: string
  body: string
  action: string
  run(): Promise<void>
}

/** Ready orders, waiter calls and requested bills, newest first. Bill requests come from the table status. */
export function useServiceCallsViewModel(feed: WaiterFeed, onCharge: (tableId: string) => void) {
  const { api } = useAuth()
  const [notice, setNotice] = useState<string | null>(null)

  const alerts = useMemo(() => {
    const act = (fn: () => Promise<unknown>) => async () => {
      setNotice(null)
      try {
        await fn()
      } catch (err) {
        setNotice(err instanceof ApiError ? err.message : 'No se pudo completar la acción')
      }
      await feed.refresh().catch(() => undefined)
    }
    const list: Omit<WaiterAlert, 'ago'>[] = [
      ...feed.orders.filter((o) => o.status === 'ready').map((o) => ({
        key: `o-${o.id}`, kind: 'Lista' as const, table: o.table_code, at: o.created_at,
        body: `#${String(o.daily_number).padStart(3, '0')} · ${o.lines.map((l) => (l.quantity > 1 ? `${l.quantity} ${l.item_name}` : l.item_name)).join(', ')}`,
        action: 'Marcar servida', run: act(() => api.serveOrder(o.id)),
      })),
      ...feed.calls.filter((c) => c.type === 'call_waiter').map((c) => ({
        key: `c-${c.id}`, kind: 'Llamada' as const, table: c.table_code, at: c.created_at,
        body: 'El comensal pidió al mesero', action: 'Atender', run: act(() => api.attendCall(c.id)),
      })),
      ...feed.tables.filter((t) => t.status === 'bill_requested').map((t) => ({
        key: `b-${t.id}`, kind: 'Cuenta' as const, table: t.code, at: t.status_changed_at,
        body: `Saldo ${formatMoney(t.balance_cents)}`, action: 'Registrar cobro',
        run: async () => onCharge(t.id),
      })),
    ]
    return list.sort((a, b) => b.at.localeCompare(a.at)).map((a): WaiterAlert => ({ ...a, ago: agoLabel(a.at) }))
  }, [feed, api, onCharge])

  return { alerts, notice, dismissNotice: () => setNotice(null) }
}
