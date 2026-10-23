import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import type { OrdersQuery } from '../../../data/api/staffApi'
import { formatMoney } from '../../../domain/money'
import type { OrderHistoryRow } from '../../../domain/staffTypes'
import type { OrderStatus } from '../../../domain/types'
import { timeInMexico, todayInMexico } from '../../../shared/time'
import { useAuth } from '../../auth/AuthContext'

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  received: { label: 'Recibida', tone: 'bg-[#E0E7EF] text-[#2B4A6B]' },
  preparing: { label: 'Preparando', tone: 'bg-[#F1E6D8] text-[#6F4A22]' },
  ready: { label: 'Lista', tone: 'bg-[#E4ECE6] text-bosque-oscuro' },
  served: { label: 'Servida', tone: 'bg-avena text-[#44483F]' },
  cancelled: { label: 'Cancelada', tone: 'bg-[#FFE4E6] text-[#9F1239]' },
}

export interface OrderFilters {
  from: string
  to: string
  status: OrderStatus | ''
  table: string
}

function toRow(o: OrderHistoryRow) {
  return {
    id: o.id,
    number: `#${String(o.daily_number).padStart(3, '0')}`,
    table: o.table_code,
    round: o.round_number,
    status: ORDER_STATUS[o.status].label,
    tone: ORDER_STATUS[o.status].tone,
    time: timeInMexico(o.created_at),
    total: formatMoney(o.subtotal_cents),
    cancelReason: o.cancel_reason,
  }
}

/** Order history; `day` pins the range to one date (dashboard) and follows it when it changes. */
export function useOrdersViewModel(day?: string) {
  const { api } = useAuth()
  const [filters, setFilters] = useState<OrderFilters>(() => {
    const start = day ?? todayInMexico()
    return { from: start, to: start, status: '', table: '' }
  })
  useEffect(() => {
    if (day) setFilters((f) => (f.from === day && f.to === day ? f : { ...f, from: day, to: day }))
  }, [day])
  const [rows, setRows] = useState<OrderHistoryRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const rangeError = filters.from && filters.to && filters.from > filters.to
    ? 'La fecha inicial no puede ser posterior a la final' : null
  const query: OrdersQuery = { from: filters.from, to: filters.to, status: filters.status || undefined,
    table: filters.table.trim().toUpperCase() || undefined }
  const queryKey = JSON.stringify(query)

  const latest = useRef(0)
  const load = useCallback(async (q: OrdersQuery) => {
    const seq = ++latest.current
    try {
      const result = await api.orders(q)
      if (seq !== latest.current) return // a newer filter already asked
      setRows(result)
      setLoadError(null)
    } catch (err) {
      if (seq !== latest.current) return
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las órdenes')
    }
  }, [api])

  useEffect(() => {
    if (rangeError) return
    void load(JSON.parse(queryKey) as OrdersQuery)
  }, [load, queryKey, rangeError])

  return {
    filters,
    setFilter: <K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) => setFilters((f) => ({ ...f, [key]: value })),
    statuses: Object.entries(ORDER_STATUS).map(([value, s]) => ({ value: value as OrderStatus, label: s.label })),
    loading: rows === null,
    error: rangeError ?? loadError,
    rows: (rows ?? []).map(toRow),
  }
}
