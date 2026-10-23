import type { DinerSession, DinerTable, MenuCategory, PlacedOrder, PlaceOrderBody, ServiceCallType } from '../../domain/types'
import { request } from './http'

export interface DinerApi {
  getTable(): Promise<DinerTable>
  getMenu(): Promise<MenuCategory[]>
  getSession(): Promise<DinerSession | null>
  placeOrder(body: PlaceOrderBody): Promise<PlacedOrder>
  callService(type: ServiceCallType): Promise<{ id: string; type: ServiceCallType; created_at: string }>
}

export function dinerApi(token: string): DinerApi {
  const base = `/diner/tables/${encodeURIComponent(token)}`
  return {
    getTable: () => request(base),
    getMenu: () => request(`${base}/menu`),
    getSession: () => request(`${base}/session`),
    placeOrder: (body) => request(`${base}/orders`, { method: 'POST', body: JSON.stringify(body) }),
    callService: (type) => request(`${base}/service-calls`, { method: 'POST', body: JSON.stringify({ type }) }),
  }
}
