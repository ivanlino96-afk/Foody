import type { AreaKind, Rotation, TableKind } from './floor'
import type { OrderStatus, ServiceCallType, TableStatus } from './types'

export type StaffRole = 'admin' | 'kitchen' | 'waiter'

export interface StaffProfile {
  id: string
  full_name: string
  role: StaffRole
}

export interface KitchenLine {
  item_name: string
  quantity: number
  note: string | null
  extras: string[]
  removed: string[]
  line_total_cents: number
}

export interface KitchenOrder {
  id: string
  daily_number: number
  table_code: string
  round_number: number
  status: OrderStatus
  created_at: string
  lines: KitchenLine[]
}

export interface TableMapRow {
  id: string
  code: string
  label: string | null
  zone: string | null
  status: TableStatus
  status_changed_at: string
  pending_orders: number
  ready_orders: number
  session_id: string | null
  balance_cents: number
  pending_calls: number
  capacity: number | null
  kind: TableKind
  area_id: string | null
  pos_x: number | null
  pos_y: number | null
  rotation: Rotation
  guests_count: number | null
  opened_at: string | null
  consumed_cents: number
  served_orders: number
}

export interface ServiceCallRow {
  id: string
  table_code: string
  type: ServiceCallType
  created_at: string
}

export type PaymentMethod = 'cash' | 'card_terminal'

export interface PaymentResult {
  payment_id: string
  balance_cents: number
  table_status: TableStatus
}

export type AvailabilityEntity = 'menu_item' | 'ingredient' | 'extra'

export interface AvailabilityRow {
  id: string
  name: string
  is_available: boolean
  used_in: number
}

export interface AvailabilityBoard {
  items: AvailabilityRow[]
  ingredients: AvailabilityRow[]
  extras: AvailabilityRow[]
}

export interface Dashboard {
  sales_cents: number
  tips_cents: number
  profit_cents: number
  margin_pct: number
  orders_count: number
  cancelled_count: number
  cancel_reasons: string[]
  avg_ticket_cents: number
  avg_prep_seconds: number | null
  avg_delivery_seconds: number | null
  occupied_tables: number
  total_tables: number
  sales_by_hour: { hour: number; sales_cents: number }[]
}

export interface OrderHistoryRow {
  id: string
  daily_number: number
  table_code: string
  round_number: number
  status: OrderStatus
  subtotal_cents: number
  cost_cents: number
  created_at: string
  ready_at: string | null
  served_at: string | null
  cancel_reason: string | null
}

export type CatalogKind = 'categories' | 'ingredients' | 'extras' | 'menu-items'

export interface Category {
  id: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export interface Ingredient {
  id: string
  name: string
  is_available: boolean
}

export interface Extra {
  id: string
  name: string
  price_cents: number
  cost_cents: number
  is_available: boolean
  ingredient_id: string | null
}

export interface DishIngredientLink {
  ingredient_id: string
  name?: string
  is_removable: boolean
}

export interface DishExtraLink {
  extra_id: string
  name?: string
  max_quantity: number
}

export interface Dish {
  id: string
  category_id: string
  name: string
  description: string
  price_cents: number
  cost_cents: number
  photo_path: string | null
  prep_minutes: number | null
  tags: string[]
  is_available: boolean
  is_active: boolean
  sort_order: number
  ingredients: DishIngredientLink[]
  extras: DishExtraLink[]
}

export interface AdminTable {
  id: string
  code: string
  label: string | null
  zone: string | null
  capacity: number | null
  qr_token: string
  status: TableStatus
  sort_order: number
  kind: TableKind
  area_id: string | null
  pos_x: number | null
  pos_y: number | null
  rotation: Rotation
}

export interface StaffRow {
  id: string
  full_name: string
  role: StaffRole
  is_active: boolean
  created_at: string
  email: string | null
}

export interface RestaurantSettings {
  name: string
  auto_release_minutes: number
  tip_options: number[]
}

export interface FloorAreaRow {
  id: string
  name: string
  kind: AreaKind
  x: number
  y: number
  width: number
  depth: number
  sort_order: number
}

export interface FloorLayout {
  areas: FloorAreaRow[]
  tables: AdminTable[]
}
