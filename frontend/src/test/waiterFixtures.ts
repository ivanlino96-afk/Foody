import type { KitchenOrder, ServiceCallRow, TableMapRow } from '../domain/staffTypes'

export const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

export function tableRow(over: Partial<TableMapRow> = {}): TableMapRow {
  return { id: 't1', code: 'M1', label: null, zone: 'Terraza', status: 'free', status_changed_at: minutesAgo(4),
    pending_orders: 0, ready_orders: 0, session_id: null, balance_cents: 0, pending_calls: 0, ...over }
}

export function kitchenOrder(over: Partial<KitchenOrder> = {}): KitchenOrder {
  return { id: 'o1', daily_number: 16, table_code: 'M2', round_number: 1, status: 'preparing', created_at: minutesAgo(6),
    lines: [{ item_name: 'Flan napolitano', quantity: 1, note: null, extras: [], removed: [], line_total_cents: 6500 },
            { item_name: 'Café de olla', quantity: 2, note: null, extras: [], removed: [], line_total_cents: 7000 }],
    ...over }
}

export function call(over: Partial<ServiceCallRow> = {}): ServiceCallRow {
  return { id: 'c1', table_code: 'M7', type: 'call_waiter', created_at: minutesAgo(2), ...over }
}
