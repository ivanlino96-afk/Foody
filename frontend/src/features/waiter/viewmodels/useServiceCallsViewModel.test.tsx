import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { call, kitchenOrder, minutesAgo, tableRow } from '../../../test/waiterFixtures'
import { useServiceCallsViewModel } from './useServiceCallsViewModel'
import { useWaiterFeed } from './useWaiterFeed'

afterEach(() => vi.unstubAllGlobals())

describe('useServiceCallsViewModel', () => {
  it('alerts combine ready orders, calls and bills', async () => {
    const fetchMock = stubFetch({
      'GET /me': meAs('waiter'),
      'GET /waiter/tables': { status: 200, body: [
        tableRow({ id: 't8', code: 'T2', status: 'bill_requested', session_id: 's8', balance_cents: 64000, status_changed_at: minutesAgo(3) }),
      ] },
      'GET /kitchen/orders': { status: 200, body: [
        kitchenOrder({ id: 'o12', daily_number: 12, table_code: 'M3', status: 'ready', created_at: minutesAgo(1) }),
        kitchenOrder({ id: 'o15', status: 'preparing' }),
      ] },
      'GET /waiter/service-calls': { status: 200, body: [
        call({ id: 'c1', table_code: 'M7', created_at: minutesAgo(2) }),
        call({ id: 'c2', table_code: 'T2', type: 'request_bill', created_at: minutesAgo(3) }),
      ] },
      'POST /waiter/orders/o12/served': { status: 200, body: {} },
    })
    const onCharge = vi.fn()
    const { result } = renderHook(() => useServiceCallsViewModel(useWaiterFeed(), onCharge), { wrapper: staffWrapper() })
    await waitFor(() => expect(result.current.alerts).toHaveLength(3))

    expect(result.current.alerts.map((a) => [a.kind, a.table, a.body, a.action])).toEqual([
      ['Lista', 'M3', '#012 · Flan napolitano, 2 Café de olla', 'Marcar servida'],
      ['Llamada', 'M7', 'El comensal pidió al mesero', 'Atender'],
      ['Cuenta', 'T2', 'Saldo $640.00', 'Registrar cobro'],
    ])
    expect(result.current.alerts[1].ago).toBe('hace 2 min')

    await act(() => result.current.alerts[2].run())
    expect(onCharge).toHaveBeenCalledWith('t8')
    await act(() => result.current.alerts[0].run())
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/waiter/orders/o12/served'))).toBe(true)
  })

  it('a double tap sends the action once', async () => {
    let release!: () => void
    const fetchMock = stubFetch({
      'GET /me': meAs('waiter'),
      'GET /waiter/tables': { status: 200, body: [] },
      'GET /kitchen/orders': { status: 200, body: [] },
      'GET /waiter/service-calls': { status: 200, body: [call({ id: 'c1' })] },
    })
    const base = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (input, init) => (String(input).endsWith('/attend')
      ? new Promise<Response>((r) => { release = () => r(new Response(null, { status: 204 })) })
      : base(input, init)))
    const { result } = renderHook(() => useServiceCallsViewModel(useWaiterFeed(), vi.fn()), { wrapper: staffWrapper() })
    await waitFor(() => expect(result.current.alerts).toHaveLength(1))

    let first!: Promise<void>
    act(() => { first = result.current.alerts[0].run() })
    expect(result.current.busyKey).toBe('c-c1')
    await act(async () => { await result.current.alerts[0].run() })
    await act(async () => { release(); await first })

    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/attend'))).toHaveLength(1)
    expect(result.current.notice).toBeNull()
    expect(result.current.busyKey).toBeNull()
  })
})
