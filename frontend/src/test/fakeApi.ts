import { vi } from 'vitest'
import { ApiError } from '../data/api/http'
import type { DinerApi } from '../data/api/dinerApi'
import type { DinerSession, DinerTable, MenuCategory, MenuItem } from '../domain/types'

export function dish(over: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'tacos', name: 'Tacos al pastor', description: 'Tres tacos', price_cents: 9500, photo_path: null,
    prep_minutes: 12, tags: ['picante'], available: true, unavailable_reason: null,
    ingredients: [
      { id: 'tortilla', name: 'Tortilla', is_removable: false, available: true },
      { id: 'cebolla', name: 'Cebolla', is_removable: true, available: true },
      { id: 'salsa', name: 'Salsa verde', is_removable: true, available: false },
    ],
    extras: [
      { id: 'queso', name: 'Queso extra', price_cents: 1500, max_quantity: 2, available: true },
      { id: 'aguacate', name: 'Aguacate', price_cents: 2000, max_quantity: 1, available: false },
    ],
    ...over,
  }
}

export const MENU: MenuCategory[] = [
  { id: 'c-tacos', name: 'Tacos', items: [dish()] },
  { id: 'c-fuertes', name: 'Fuertes', items: [
    dish({ id: 'enchiladas', name: 'Enchiladas verdes', price_cents: 14500, tags: [] }),
    dish({ id: 'sopa', name: 'Sopa de tortilla', price_cents: 8500, available: false,
           unavailable_reason: 'sold_out' }),
  ] },
]

export const OPEN_TABLE: DinerTable = { code: 'M1', label: 'Terraza', status: 'occupied', can_order: true }

export function emptySession(over: Partial<DinerSession> = {}): DinerSession {
  return { rounds: [], subtotal_cents: 0, tip_cents: 0, paid_cents: 0, balance_cents: 0, bill_requested: false,
           pending_calls: [], ...over }
}

export function fakeApi(over: Partial<DinerApi> = {}) {
  return {
    getTable: vi.fn<DinerApi['getTable']>(over.getTable ?? (async () => OPEN_TABLE)),
    getMenu: vi.fn<DinerApi['getMenu']>(over.getMenu ?? (async () => MENU)),
    getSession: vi.fn<DinerApi['getSession']>(over.getSession ?? (async () => emptySession())),
    placeOrder: vi.fn<DinerApi['placeOrder']>(over.placeOrder ?? (async () => ({
      order_id: 'o1', daily_number: 1, round_number: 1, status: 'received', subtotal_cents: 9500 }))),
    callService: vi.fn<DinerApi['callService']>(over.callService ??
      (async (type) => ({ id: 'call1', type, created_at: '2026-10-23T18:00:00Z' }))),
  }
}

export const notFound = () => new ApiError(404, 'not_found', 'No encontrado')
