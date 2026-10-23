import { useCallback, useEffect, useState } from 'react'
import { useLiveRefresh } from '../../../data/realtime'
import { formatMoney } from '../../../domain/money'
import type { Dashboard } from '../../../domain/staffTypes'
import { longDate, todayInMexico } from '../../../shared/time'
import { useAuth } from '../../auth/AuthContext'

export const DASHBOARD_POLL_MS = 30_000
const LIVE_TABLES = ['orders', 'payments', 'dining_tables']

export interface Kpi {
  label: string
  value: string
  sub: string
  alert?: boolean
}

export interface Bar {
  hour: string
  label: string
  pct: number
  peak: boolean
}

export interface NowCount {
  label: string
  n: number
  color: string
}

function shortMoney(cents: number): string {
  const pesos = cents / 100
  return pesos >= 1000 ? `$${(pesos / 1000).toFixed(1)}k` : `$${Math.round(pesos)}`
}

function kpisOf(d: Dashboard, live: boolean, day: string): Kpi[] {
  const tipPct = d.sales_cents ? `${((d.tips_cents / d.sales_cents) * 100).toFixed(1)}% de las ventas` : 'Sin ventas aún'
  return [
    { label: 'Ventas', value: formatMoney(d.sales_cents), sub: live ? 'Hoy' : longDate(day) },
    { label: 'Ganancia', value: formatMoney(d.profit_cents), sub: `Margen ${Math.round(d.margin_pct)}%` },
    { label: 'Propinas', value: formatMoney(d.tips_cents), sub: tipPct },
    { label: 'Órdenes', value: String(d.orders_count), alert: d.cancelled_count > 0,
      sub: d.cancelled_count ? `${d.cancelled_count} ${d.cancelled_count === 1 ? 'cancelada' : 'canceladas'}` : 'Sin cancelaciones' },
    { label: 'Ticket promedio', value: formatMoney(d.avg_ticket_cents),
      sub: d.avg_prep_seconds !== null ? `Preparación ${Math.round(d.avg_prep_seconds / 60)} min` : 'Sin datos de cocina' },
    { label: 'Mesas ocupadas', value: `${d.occupied_tables}/${d.total_tables}`, sub: 'Ahora' },
  ]
}

/** Hours from the first to the last one with sales; empty when the day has none. */
function barsOf(d: Dashboard): Bar[] {
  const busy = d.sales_by_hour.filter((h) => h.sales_cents > 0)
  if (!busy.length) return []
  const first = busy[0].hour
  const last = busy[busy.length - 1].hour
  const max = Math.max(...busy.map((h) => h.sales_cents))
  return d.sales_by_hour.filter((h) => h.hour >= first && h.hour <= last).map((h) => ({
    hour: `${h.hour}h`, label: shortMoney(h.sales_cents), pct: Math.round((h.sales_cents / max) * 100), peak: h.sales_cents === max,
  }))
}

export function useDashboardViewModel() {
  const { api } = useAuth()
  const [date, setDate] = useState(todayInMexico)
  const [data, setData] = useState<{ date: string; dash: Dashboard; now: NowCount[] | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const live = date === todayInMexico()

  const load = useCallback(async () => {
    try {
      const [dash, orders, tables] = await Promise.all([
        api.dashboard(date),
        live ? api.kitchenOrders() : Promise.resolve(null),
        live ? api.tables() : Promise.resolve(null),
      ])
      const now = orders && tables ? [
        { label: 'Recibidas', n: orders.filter((o) => o.status === 'received').length, color: '#5B7FA6' },
        { label: 'Preparando', n: orders.filter((o) => o.status === 'preparing').length, color: '#B98552' },
        { label: 'Listas', n: orders.filter((o) => o.status === 'ready').length, color: '#5E8C6A' },
        { label: 'Cuentas pendientes', n: tables.filter((t) => t.status === 'bill_requested').length, color: '#E11D48' },
      ] : null
      setData({ date, dash, now })
      setError(null)
    } catch {
      setError('No se pudo cargar el dashboard')
    }
  }, [api, date, live])

  const { connected } = useLiveRefresh(live ? LIVE_TABLES : [], load, DASHBOARD_POLL_MS)
  const current = data?.date === date ? data : null

  // Polling only restarts on its interval; a new date needs its own load right away.
  const stale = data !== null && data.date !== date
  useEffect(() => {
    if (stale) void load()
  }, [stale, load])

  return {
    date,
    setDate: (d: string) => d && setDate(d),
    live,
    connected,
    loading: current === null,
    error,
    kpis: current ? kpisOf(current.dash, live, date) : [],
    bars: current ? barsOf(current.dash) : [],
    cancelReasons: current?.dash.cancel_reasons ?? [],
    now: current?.now ?? null,
  }
}
