import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { DinerSession } from '../../../domain/types'
import { emptySession, fakeApi } from '../../../test/fakeApi'
import { DinerWrapper } from '../../../test/renderDiner'
import { useAccountViewModel } from './useAccountViewModel'

const round = (n: number, status: DinerSession['rounds'][number]['status'], cents: number) => ({
  order_id: `o${n}`, round_number: n, status, subtotal_cents: cents, created_at: '2026-10-23T18:00:00Z',
  lines: [{ item_name: 'Tacos al pastor', quantity: 2, note: null, extras: ['Queso extra'], removed: ['Cebolla'], line_total_cents: cents }],
})

function setup(api = fakeApi()) {
  const wrapper = ({ children }: { children: ReactNode }) => <DinerWrapper api={api}>{children}</DinerWrapper>
  return { api, ...renderHook(() => useAccountViewModel(), { wrapper }) }
}

describe('useAccountViewModel', () => {
  it('maps round statuses to spanish labels', async () => {
    const session = emptySession({ rounds: [round(1, 'served', 20000), round(2, 'preparing', 9500), round(3, 'cancelled', 5000)],
                                   subtotal_cents: 29500, balance_cents: 29500 })
    const { result } = setup(fakeApi({ getSession: async () => session }))
    await waitFor(() => expect(result.current.rounds).toHaveLength(3))
    expect(result.current.rounds.map((r) => r.statusLabel)).toEqual(['Servida', 'Preparando', 'Cancelada'])
    expect(result.current.rounds[0].lines[0]).toEqual({ text: '2× Tacos al pastor', detail: 'Sin cebolla · + Queso extra', totalCents: 20000 })
    expect(result.current.balanceCents).toBe(29500)
  })

  it('request bill marks billRequested after refresh', async () => {
    let requested = false
    const api = fakeApi({
      getSession: async () => emptySession({ rounds: [round(1, 'served', 9500)], subtotal_cents: 9500, balance_cents: 9500,
                                            bill_requested: requested, pending_calls: requested ? ['request_bill'] : [] }),
      callService: async (type) => { requested = true; return { id: 'c', type, created_at: '' } },
    })
    const { result } = setup(api)
    await waitFor(() => expect(result.current.canRequestBill).toBe(true))
    await act(() => result.current.requestBill())
    expect(api.callService).toHaveBeenCalledWith('request_bill')
    await waitFor(() => expect(result.current.billRequested).toBe(true))
    expect(result.current.canRequestBill).toBe(false)
  })

  it('cannot ask for the bill with nothing ordered', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.canRequestBill).toBe(false)
  })

  it('call waiter twice sends one request while pending', async () => {
    let pending = false
    const api = fakeApi({
      getSession: async () => emptySession({ pending_calls: pending ? ['call_waiter'] : [] }),
      callService: async (type) => { pending = true; return { id: 'c', type, created_at: '' } },
    })
    const { result } = setup(api)
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await Promise.all([result.current.callWaiter(), result.current.callWaiter()]) })
    await waitFor(() => expect(result.current.waiterCalled).toBe(true))
    await act(() => result.current.callWaiter())
    expect(api.callService).toHaveBeenCalledTimes(1)
  })

  it('shows thank-you when session is paid', async () => {
    let paid = false
    const api = fakeApi({
      getTable: async () => ({ code: 'M1', label: null, status: paid ? 'closed' : 'bill_requested', can_order: false }),
      getSession: async () => (paid ? null : emptySession({ rounds: [round(1, 'served', 9500)], subtotal_cents: 9500 })),
    })
    const { result } = setup(api)
    await waitFor(() => expect(result.current.rounds).toHaveLength(1))
    paid = true
    await act(() => result.current.refresh())
    expect(result.current.closed).toBe(true)
  })
})

describe('useAccountViewModel after payment', () => {
  it('shows thank-you while the paid table waits to be released', async () => {
    const api = fakeApi({
      getTable: async () => ({ code: 'M1', label: null, status: 'closed', can_order: false }),
      getSession: async () => emptySession({ rounds: [round(1, 'served', 9500)], subtotal_cents: 9500, paid_cents: 9500 }),
    })
    const { result } = setup(api)
    await waitFor(() => expect(result.current.rounds).toHaveLength(1))
    expect(result.current.closed).toBe(true)
  })
})
