import { useRef, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import type { OrderStatus, ServiceCallType } from '../../../domain/types'
import type { BadgeTone } from '../../../shared/ui/Badge'
import { useDiner } from '../DinerContext'

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Recibida',
  preparing: 'Preparando',
  ready: 'Lista',
  served: 'Servida',
  cancelled: 'Cancelada',
}

export const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  received: 'green',
  preparing: 'warm',
  ready: 'green',
  served: 'neutral',
  cancelled: 'danger',
}

export interface RoundView {
  id: string
  number: number
  status: OrderStatus
  statusLabel: string
  tone: BadgeTone
  totalCents: number
  lines: { text: string; detail: string; totalCents: number }[]
}

export interface AccountViewModel {
  loading: boolean
  tableCode: string
  rounds: RoundView[]
  subtotalCents: number
  paidCents: number
  balanceCents: number
  billRequested: boolean
  waiterCalled: boolean
  canRequestBill: boolean
  closed: boolean
  busy: ServiceCallType | null
  error: string | null
  requestBill: () => Promise<void>
  callWaiter: () => Promise<void>
  refresh: () => Promise<void>
}

export function useAccountViewModel(): AccountViewModel {
  const { api, status, table, session, sessionEnded, refreshSession } = useDiner()
  const [busy, setBusy] = useState<ServiceCallType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(new Set<ServiceCallType>())

  const pending = new Set(session?.pending_calls ?? [])
  const billRequested = session?.bill_requested ?? table?.status === 'bill_requested'
  const waiterCalled = pending.has('call_waiter')
  const hasSomethingToCharge = (session?.subtotal_cents ?? 0) > 0

  const call = async (type: ServiceCallType, alreadyDone: boolean) => {
    if (alreadyDone || inFlight.current.has(type)) return
    inFlight.current.add(type)
    setBusy(type)
    setError(null)
    try {
      await api.callService(type)
      await refreshSession().catch(() => undefined)
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'network'
        ? 'No hay conexión. Intenta de nuevo.'
        : err instanceof ApiError ? err.message : 'Algo salió mal; intenta de nuevo')
    } finally {
      inFlight.current.delete(type)
      setBusy(null)
    }
  }

  return {
    loading: status === 'loading',
    tableCode: table?.code ?? '',
    rounds: (session?.rounds ?? []).map((r) => ({
      id: r.order_id,
      number: r.round_number,
      status: r.status,
      statusLabel: STATUS_LABEL[r.status],
      tone: STATUS_TONE[r.status],
      totalCents: r.subtotal_cents,
      lines: r.lines.map((l) => ({
        text: `${l.quantity > 1 ? `${l.quantity}× ` : ''}${l.item_name}`,
        detail: [...l.removed.map((n) => `Sin ${n.toLowerCase()}`), ...l.extras.map((e) => `+ ${e}`),
                 ...(l.note ? [`Nota: ${l.note}`] : [])].join(' · '),
        totalCents: l.line_total_cents,
      })),
    })),
    subtotalCents: session?.subtotal_cents ?? 0,
    paidCents: session ? session.paid_cents - session.tip_cents : 0,
    balanceCents: session?.balance_cents ?? 0,
    billRequested,
    waiterCalled,
    canRequestBill: !!session && hasSomethingToCharge && !billRequested && busy !== 'request_bill',
    closed: sessionEnded || (table?.status === 'closed' && (session?.rounds.length ?? 0) > 0),
    busy,
    error,
    requestBill: () => call('request_bill', billRequested || !hasSomethingToCharge),
    callWaiter: () => call('call_waiter', waiterCalled),
    refresh: () => refreshSession().catch(() => undefined),
  }
}
