import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DinerSession } from '../../../domain/types'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { tableRow } from '../../../test/waiterFixtures'
import { useLiveFloorViewModel } from './useLiveFloorViewModel'

afterEach(() => vi.unstubAllGlobals())

const ACCOUNT: DinerSession = {
  rounds: [
    { order_id: 'o1', daily_number: 47, round_number: 1, status: 'served', subtotal_cents: 31200, created_at: '2026-10-23T18:00:00Z',
      lines: [{ item_name: 'Bowl mediterráneo', quantity: 2, note: null, extras: [], removed: [], line_total_cents: 31000 }] },
    { order_id: 'o2', daily_number: 52, round_number: 2, status: 'preparing', subtotal_cents: 7500, created_at: '2026-10-23T18:30:00Z',
      lines: [{ item_name: 'Jugo verde', quantity: 1, note: null, extras: [], removed: [], line_total_cents: 7500 }] },
  ],
  subtotal_cents: 38700, tip_cents: 0, paid_cents: 0, balance_cents: 38700, bill_requested: false, pending_calls: [],
}

function setup() {
  const fetchMock = stubFetch({
    'GET /me': meAs('admin'),
    'GET /waiter/tables': { status: 200, body: [
      tableRow({ status: 'awaiting_order', guests_count: 4, consumed_cents: 38700, opened_at: '2026-10-23T17:55:00Z' }),
      tableRow({ id: 't2', code: 'M2' }),
    ] },
    'GET /kitchen/orders': { status: 200, body: [] },
    'GET /waiter/service-calls': { status: 200, body: [] },
    'GET /waiter/floor-areas': { status: 200, body: [] },
    'GET /waiter/tables/t1/account': { status: 200, body: ACCOUNT },
  })
  return { ...renderHook(() => useLiveFloorViewModel(), { wrapper: staffWrapper() }), fetchMock }
}

describe('useLiveFloorViewModel', () => {
  it('seats two diners and tags busy tables with their latest order and status', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.overlays.t1?.card?.title).toBe('#052'))
    expect(result.current.overlays.t1).toMatchObject({ seated: 2, card: { status: 'En espera de orden', dot: '#B98552' } })
    expect(result.current.overlays.t2).toEqual({ color: '#FBFAF7' })
    expect(result.current.stats).toMatchObject({ occupied: 1, total: 2, guests: 4, open: 38700 })
  })

  it('selecting a table exposes its full account', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.openTables[0]?.account?.rounds).toHaveLength(2))
    act(() => result.current.select('t1'))
    expect(result.current.selected?.account?.rounds.map((r) => r.daily_number)).toEqual([47, 52])
  })
})
