import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OrderHistoryRow } from '../../../domain/staffTypes'
import { todayInMexico } from '../../../shared/time'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { useOrdersViewModel } from './useOrdersViewModel'

afterEach(() => vi.unstubAllGlobals())

const ROW: OrderHistoryRow = {
  id: 'o1', daily_number: 16, table_code: 'M2', round_number: 1, status: 'cancelled', subtotal_cents: 23000, cost_cents: 9000,
  created_at: '2026-10-23T02:12:00Z', ready_at: null, served_at: null, cancel_reason: 'Cliente se fue',
}

const lastOrdersUrl = (m: ReturnType<typeof stubFetch>) =>
  String(m.mock.calls.filter(([u]) => String(u).includes('/admin/orders')).at(-1)?.[0])

describe('useOrdersViewModel', () => {
  it('orders filters go to the query', async () => {
    const fetchMock = stubFetch({ 'GET /me': meAs('admin'), 'GET /admin/orders': { status: 200, body: [ROW] } })
    const { result } = renderHook(() => useOrdersViewModel(), { wrapper: staffWrapper() })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    const today = todayInMexico()
    expect(lastOrdersUrl(fetchMock)).toBe(`/api/v1/admin/orders?from=${today}&to=${today}`)
    expect(result.current.rows[0]).toMatchObject({ number: '#016', table: 'M2', round: 1, status: 'Cancelada',
      time: '20:12', total: '$230.00', cancelReason: 'Cliente se fue' })

    act(() => {
      result.current.setFilter('from', '2026-10-20')
      result.current.setFilter('status', 'ready')
      result.current.setFilter('table', ' m2 ')
    })
    await waitFor(() => expect(lastOrdersUrl(fetchMock))
      .toBe(`/api/v1/admin/orders?from=2026-10-20&to=${today}&status=ready&table=M2`))
  })

  it('a reversed range shows a message instead of querying', async () => {
    const fetchMock = stubFetch({ 'GET /me': meAs('admin'), 'GET /admin/orders': { status: 200, body: [] } })
    const { result } = renderHook(() => useOrdersViewModel(), { wrapper: staffWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const calls = fetchMock.mock.calls.length
    act(() => result.current.setFilter('to', '2020-01-01'))
    expect(result.current.error).toBe('La fecha inicial no puede ser posterior a la final')
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchMock.mock.calls.length).toBe(calls)
  })

  it('keeps the newest filter result when answers arrive out of order', async () => {
    const pending: ((rows: OrderHistoryRow[]) => void)[] = []
    stubFetch({ 'GET /me': meAs('admin') })
    const base = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (!String(input).includes('/admin/orders')) return base(input, init)
      return new Promise<Response>((resolve) => pending.push((rows) => resolve(new Response(JSON.stringify(rows), { status: 200 }))))
    })
    const { result } = renderHook(() => useOrdersViewModel(), { wrapper: staffWrapper() })
    await waitFor(() => expect(pending).toHaveLength(1))
    act(() => result.current.setFilter('from', '2026-10-20'))
    await waitFor(() => expect(pending).toHaveLength(2))

    await act(async () => { pending[1]([ROW]) })
    await act(async () => { pending[0]([]) })

    expect(result.current.rows).toHaveLength(1)
  })
})
