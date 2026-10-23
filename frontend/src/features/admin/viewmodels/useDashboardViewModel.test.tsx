import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Dashboard } from '../../../domain/staffTypes'
import { todayInMexico } from '../../../shared/time'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { kitchenOrder, tableRow } from '../../../test/waiterFixtures'
import { useDashboardViewModel } from './useDashboardViewModel'

afterEach(() => vi.unstubAllGlobals())

const hours = (sales: Record<number, number>) =>
  Array.from({ length: 24 }, (_, hour) => ({ hour, sales_cents: sales[hour] ?? 0 }))

const DASH: Dashboard = {
  sales_cents: 1845000, tips_cents: 214000, profit_cents: 1107000, margin_pct: 60, orders_count: 64, cancelled_count: 2,
  cancel_reasons: ['Cliente se fue'], avg_ticket_cents: 41200, avg_prep_seconds: 660, avg_delivery_seconds: 900,
  occupied_tables: 8, total_tables: 12, sales_by_hour: hours({ 13: 120000, 15: 340000, 20: 390000 }),
}

function setup(dash: Dashboard = DASH) {
  const fetchMock = stubFetch({
    'GET /me': meAs('admin'),
    'GET /admin/dashboard': { status: 200, body: dash },
    'GET /kitchen/orders': { status: 200, body: [kitchenOrder({ status: 'received' }), kitchenOrder({ id: 'o2', status: 'ready' })] },
    'GET /waiter/tables': { status: 200, body: [tableRow({ status: 'bill_requested' }), tableRow({ id: 't2' })] },
  })
  const hook = renderHook(() => useDashboardViewModel(), { wrapper: staffWrapper() })
  return { ...hook, fetchMock }
}

describe('useDashboardViewModel', () => {
  it('builds kpis from the dashboard', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.kpis).toHaveLength(6))
    expect(result.current.kpis.map((k) => [k.label, k.value, k.sub])).toEqual([
      ['Ventas', '$18,450.00', 'Hoy'],
      ['Ganancia', '$11,070.00', 'Margen 60%'],
      ['Propinas', '$2,140.00', '11.6% de las ventas'],
      ['Órdenes', '64', '2 canceladas'],
      ['Ticket promedio', '$412.00', 'Preparación 11 min'],
      ['Mesas ocupadas', '8/12', 'Ahora'],
    ])
    expect(result.current.kpis[3].alert).toBe(true)
  })

  it('bars span the busy hours', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.bars.length).toBeGreaterThan(0))
    expect(result.current.bars.map((b) => b.hour)).toEqual(['13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h'])
    expect(result.current.bars.find((b) => b.hour === '20h')).toMatchObject({ label: '$3.9k', peak: true, pct: 100 })
    expect(result.current.bars.find((b) => b.hour === '14h')).toMatchObject({ label: '$0', pct: 0 })
    expect(result.current.scale).toEqual(['$3.9k', '$1.9k', '$0'])
  })

  it('has no bars on a day without sales', async () => {
    const { result } = setup({ ...DASH, sales_cents: 0, sales_by_hour: hours({}) })
    await waitFor(() => expect(result.current.kpis).toHaveLength(6))
    expect(result.current.bars).toEqual([])
  })

  it('live only for today', async () => {
    const { result, fetchMock } = setup()
    expect(result.current.date).toBe(todayInMexico())
    await waitFor(() => expect(result.current.now).not.toBeNull())
    expect(result.current.live).toBe(true)
    expect(result.current.now?.map((n) => [n.label, n.n])).toEqual(
      [['Recibidas', 1], ['Preparando', 0], ['Listas', 1], ['Cuentas pendientes', 1]])

    act(() => result.current.setDate('2026-10-01'))
    expect(result.current.live).toBe(false)
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/admin/dashboard?date=2026-10-01'))).toBe(true))
    expect(result.current.now).toBeNull()
  })
})
