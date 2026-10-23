// Shapes returned by the FastAPI diner routes (/api/v1/diner/tables/{token}).

export type TableStatus = 'free' | 'occupied' | 'awaiting_order' | 'served' | 'bill_requested' | 'closed'
export type OrderStatus = 'received' | 'preparing' | 'ready' | 'served' | 'cancelled'
export type ServiceCallType = 'call_waiter' | 'request_bill'

export interface DinerTable {
  code: string
  label: string | null
  status: TableStatus
  can_order: boolean
}

export interface MenuIngredient {
  id: string
  name: string
  is_removable: boolean
  available: boolean
}

export interface MenuExtra {
  id: string
  name: string
  price_cents: number
  max_quantity: number
  available: boolean
}

export interface MenuItem {
  id: string
  name: string
  description: string
  price_cents: number
  photo_path: string | null
  prep_minutes: number | null
  tags: string[]
  available: boolean
  unavailable_reason: string | null
  ingredients: MenuIngredient[]
  extras: MenuExtra[]
}

export interface MenuCategory {
  id: string
  name: string
  items: MenuItem[]
}

export interface OrderLine {
  item_name: string
  quantity: number
  note: string | null
  extras: string[]
  removed: string[]
  line_total_cents: number
}

export interface DinerRound {
  order_id: string
  daily_number: number
  round_number: number
  status: OrderStatus
  lines: OrderLine[]
  subtotal_cents: number
  created_at: string
}

export interface DinerSession {
  rounds: DinerRound[]
  subtotal_cents: number
  tip_cents: number
  paid_cents: number
  balance_cents: number
  bill_requested: boolean
  pending_calls: ServiceCallType[]
}

export interface PlacedOrder {
  order_id: string
  daily_number: number
  round_number: number
  status: OrderStatus
  subtotal_cents: number
}

export interface OrderLineBody {
  menu_item_id: string
  quantity: number
  removed_ingredient_ids: string[]
  extras: { extra_id: string; quantity: number }[]
  note: string | null
}

export interface PlaceOrderBody {
  idempotency_key: string
  expected_total_cents: number | null
  lines: OrderLineBody[]
}
