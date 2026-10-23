import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { call, kitchenOrder, tableRow } from '../../../test/waiterFixtures'
import { useTablesMapViewModel } from './useTablesMapViewModel'
import { useWaiterFeed } from './useWaiterFeed'

afterEach(() => vi.unstubAllGlobals())

function setup(extra: Parameters<typeof stubFetch>[0] = {}) {
  const fetchMock = stubFetch({
    'GET /me': meAs('waiter'),
    'GET /waiter/tables': { status: 200, body: [
      tableRow(),
      tableRow({ id: 't2', code: 'M2', status: 'awaiting_order', session_id: 's2', pending_orders: 1, balance_cents: 23000 }),
      tableRow({ id: 't3', code: 'M3', status: 'served', session_id: 's3', balance_cents: 52000 }),
      tableRow({ id: 't6', code: 'M6', status: 'occupied', session_id: 's6' }),
      tableRow({ id: 't7', code: 'M7', status: 'occupied', session_id: 's7', pending_calls: 1 }),
      tableRow({ id: 't8', code: 'T2', status: 'bill_requested', session_id: 's8', balance_cents: 64000 }),
      tableRow({ id: 't9', code: 'T3', status: 'closed' }),
    ] },
    'GET /kitchen/orders': { status: 200, body: [kitchenOrder()] },
    'GET /waiter/service-calls': { status: 200, body: [call()] },
    ...extra,
  })
  const hook = renderHook(() => useTablesMapViewModel(useWaiterFeed()), { wrapper: staffWrapper() })
  return { ...hook, fetchMock }
}

describe('useTablesMapViewModel', () => {
  it('table details follow status', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.tables).toHaveLength(7))
    const byCode = Object.fromEntries(result.current.tables.map((t) => [t.code, [t.label, t.detail]]))
    expect(byCode).toEqual({
      M1: ['Libre', 'Toca para abrir'],
      M2: ['En espera de orden', '#016 preparando · 6 min'],
      M3: ['Orden servida', 'Cuenta $520.00'],
      M6: ['Ocupada', 'Abierta hace 4 min'],
      M7: ['Ocupada', 'Llamó al mesero'],
      T2: ['Cuenta solicitada', 'Saldo $640.00'],
      T3: ['Cerrada', 'Cerrada hace 4 min'],
    })
    expect(result.current.tables.find((t) => t.code === 'T2')?.color).toBe('#E11D48')
    expect(result.current.occupiedLine).toBe('5 de 7 ocupadas')
    expect(result.current.legend.map((l) => l.label)).toEqual(
      ['Libre', 'Ocupada', 'En espera de orden', 'Orden servida', 'Cuenta solicitada', 'Cerrada'])
  })

  it('opens a free table and refreshes the map', async () => {
    const { result, fetchMock } = setup({ 'POST /waiter/tables/t1/open': { status: 200, body: {} } })
    await waitFor(() => expect(result.current.tables).toHaveLength(7))
    act(() => result.current.select('t1'))
    expect(result.current.selected?.code).toBe('M1')
    const before = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/waiter/tables')).length

    await act(() => result.current.open(4))

    const openCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/waiter/tables/t1/open'))
    expect(JSON.parse(String(openCall?.[1]?.body))).toEqual({ guests_count: 4 })
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/waiter/tables')).length).toBeGreaterThan(before)
  })

  it('shows the backend message when an action conflicts', async () => {
    const { result } = setup({ 'POST /waiter/tables/t2/request-bill': { status: 409, body: { code: 'invalid_transition', message: 'No hay nada que cobrar' } } })
    await waitFor(() => expect(result.current.tables).toHaveLength(7))
    act(() => result.current.select('t2'))
    await act(() => result.current.requestBill())
    expect(result.current.notice).toBe('No hay nada que cobrar')
  })

  it('says when the map could not be refreshed', async () => {
    stubFetch({ 'GET /me': meAs('waiter'), 'GET /waiter/tables': { status: 500, body: { code: 'error', message: 'boom' } } })
    const { result } = renderHook(() => useWaiterFeed(), { wrapper: staffWrapper() })
    await waitFor(() => expect(result.current.error).toBe('No se pudo actualizar; reintentando…'))
  })
})
