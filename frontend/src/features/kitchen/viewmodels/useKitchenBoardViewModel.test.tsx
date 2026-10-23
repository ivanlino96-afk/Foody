import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KitchenOrder } from '../../../domain/staffTypes'
import { fakeRealtime, staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { useKitchenBoardViewModel } from './useKitchenBoardViewModel'

vi.mock('../../../shared/sound', () => ({ playChime: vi.fn() }))
const { playChime } = await import('../../../shared/sound')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.mocked(playChime).mockClear()
})

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

function order(over: Partial<KitchenOrder> = {}): KitchenOrder {
  return {
    id: 'o1', daily_number: 16, table_code: 'M2', round_number: 1, status: 'received', created_at: minutesAgo(1),
    lines: [{ item_name: 'Tacos al pastor', quantity: 2, note: 'Sin picante', extras: ['Piña extra'], removed: ['Cebolla'],
      line_total_cents: 23000 }],
    ...over,
  }
}

function setup(orders: () => KitchenOrder[], extra: Parameters<typeof stubFetch>[0] = {}, realtime = fakeRealtime()) {
  const fetchMock = stubFetch({ 'GET /me': meAs('kitchen'), 'GET /kitchen/orders': () => ({ status: 200, body: orders() }), ...extra })
  const hook = renderHook(() => useKitchenBoardViewModel(), { wrapper: staffWrapper(realtime) })
  const ordersCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/kitchen/orders')).length
  return { ...hook, fetchMock, ordersCalls, realtime }
}

describe('useKitchenBoardViewModel', () => {
  it('groups orders into three columns', async () => {
    const { result } = setup(() => [
      order(), order({ id: 'o2', daily_number: 13, status: 'preparing', created_at: minutesAgo(6) }),
      order({ id: 'o3', daily_number: 12, status: 'ready' }),
    ])
    await waitFor(() => expect(result.current.activeCount).toBe(3))
    expect(result.current.columns.map((c) => [c.title, c.tickets.length])).toEqual([['Recibidas', 1], ['Preparando', 1], ['Listas', 1]])
    const ticket = result.current.columns[0].tickets[0]
    expect(ticket).toMatchObject({ number: '#016', table: 'M2', round: 1, action: 'Empezar' })
    expect(ticket.items[0]).toMatchObject({ qty: 2, name: 'Tacos al pastor', note: 'Sin picante',
      mods: [{ text: 'Sin Cebolla', kind: 'remove' }, { text: '+ Piña extra', kind: 'add' }] })
    expect(result.current.columns[1].tickets[0].action).toBe('Marcar lista')
    expect(result.current.columns[2].tickets[0].action).toBeNull()
  })

  it('marks orders late after 15 minutes', async () => {
    const { result } = setup(() => [
      order({ id: 'late', created_at: minutesAgo(16), status: 'preparing' }),
      order({ id: 'fresh', created_at: minutesAgo(14) }),
      order({ id: 'ready', created_at: minutesAgo(30), status: 'ready' }),
    ])
    await waitFor(() => expect(result.current.activeCount).toBe(3))
    const all = result.current.columns.flatMap((c) => c.tickets)
    expect(Object.fromEntries(all.map((t) => [t.id, t.late]))).toEqual({ late: true, fresh: false, ready: false })
    expect(all.find((t) => t.id === 'late')?.elapsed).toMatch(/^16:0\d$/)
  })

  it('plays a chime for a new received order once', async () => {
    let orders = [order()]
    const { result, realtime } = setup(() => orders)
    await waitFor(() => expect(result.current.activeCount).toBe(1))
    expect(playChime).not.toHaveBeenCalled()

    orders = [order(), order({ id: 'o2', daily_number: 17 })]
    await act(async () => { realtime.emit('orders'); await new Promise((r) => setTimeout(r, 350)) })
    await waitFor(() => expect(result.current.activeCount).toBe(2))
    await act(async () => { realtime.emit('orders'); await new Promise((r) => setTimeout(r, 350)) })

    expect(playChime).toHaveBeenCalledTimes(1)
  })

  it('conflict refreshes instead of failing', async () => {
    const { result, ordersCalls } = setup(() => [order()], {
      'POST /kitchen/orders/o1/status': { status: 409, body: { code: 'invalid_transition', message: 'La orden ya cambió de estado' } },
    })
    await waitFor(() => expect(result.current.activeCount).toBe(1))
    const before = ordersCalls()

    await act(() => result.current.start('o1'))

    expect(result.current.notice).toBe('La orden ya cambió de estado')
    expect(ordersCalls()).toBeGreaterThan(before)
    expect(result.current.busyId).toBeNull()
  })

  it('falls back to polling when realtime is down', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { result, ordersCalls } = setup(() => [order()], {}, fakeRealtime(false))
    await waitFor(() => expect(result.current.activeCount).toBe(1))
    expect(result.current.connected).toBe(false)
    const before = ordersCalls()

    await act(() => vi.advanceTimersByTimeAsync(10_000))

    expect(ordersCalls()).toBeGreaterThan(before)
  })

  it('says when the board could not be refreshed', async () => {
    stubFetch({ 'GET /me': meAs('kitchen'), 'GET /kitchen/orders': { status: 500, body: { code: 'error', message: 'boom' } } })
    const { result } = renderHook(() => useKitchenBoardViewModel(), { wrapper: staffWrapper() })
    await waitFor(() => expect(result.current.loadError).toBe('No se pudo actualizar; reintentando…'))
  })
})
