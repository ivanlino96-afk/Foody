import type {
  AdminTable, AvailabilityBoard, AvailabilityEntity, Dashboard, FloorAreaRow, FloorLayout, KitchenOrder, OrderHistoryRow, PaymentMethod,
  PaymentResult, RestaurantSettings, ServiceCallRow, StaffProfile, StaffRole, StaffRow, TableMapRow,
} from '../../domain/staffTypes'
import { ApiError, request, requestBlob } from './http'

export type CatalogPath = 'categories' | 'ingredients' | 'extras' | 'menu-items'

export interface FloorLayoutIn {
  areas: { id: string | null; key: string; name: string; kind: string; x: number; y: number; width: number; depth: number }[]
  tables: { id: string | null; code: string; label: string | null; capacity: number; kind: string; pos_x: number | null
    pos_y: number | null; rotation: number }[]
  deleted_table_ids: string[]
}

export interface OrdersQuery {
  from?: string
  to?: string
  status?: string
  table?: string
}

/** Typed client for every staff route; `onAuthError` runs on 401/403 so the session can be re-checked. */
export function staffApi(getToken: () => string | null | Promise<string | null>, onAuthError: (err: ApiError) => void) {
  const call = async <T>(path: string, init: RequestInit = {}, blob = false): Promise<T> => {
    const token = await getToken()
    const headers = { ...(init.headers as Record<string, string>), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    try {
      return blob ? ((await requestBlob(path, { ...init, headers })) as T) : await request<T>(path, { ...init, headers })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onAuthError(err)
      throw err
    }
  }
  const post = <T>(path: string, body?: unknown) =>
    call<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
  const patch = <T>(path: string, body: unknown) => call<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
  const qs = (params: Record<string, string | undefined>) => {
    const entries = Object.entries(params).filter((e): e is [string, string] => !!e[1])
    return entries.length ? `?${new URLSearchParams(entries)}` : ''
  }

  return {
    me: () => call<StaffProfile>('/me'),
    // kitchen
    kitchenOrders: () => call<KitchenOrder[]>('/kitchen/orders'),
    setKitchenStatus: (id: string, status: 'preparing' | 'ready') => post(`/kitchen/orders/${id}/status`, { status }),
    // waiter
    tables: () => call<TableMapRow[]>('/waiter/tables'),
    openTable: (id: string, guests?: number) => post(`/waiter/tables/${id}/open`, guests ? { guests_count: guests } : {}),
    reopenTable: (id: string) => post(`/waiter/tables/${id}/reopen`, {}),
    releaseTable: (id: string) => post(`/waiter/tables/${id}/release`),
    requestBill: (id: string) => post(`/waiter/tables/${id}/request-bill`),
    serveOrder: (id: string) => post(`/waiter/orders/${id}/served`),
    cancelOrder: (id: string, reason: string) => post(`/waiter/orders/${id}/cancel`, { reason }),
    serviceCalls: () => call<ServiceCallRow[]>('/waiter/service-calls'),
    floorAreas: () => call<FloorAreaRow[]>('/waiter/floor-areas'),
    attendCall: (id: string) => post(`/waiter/service-calls/${id}/attend`),
    registerPayment: (sessionId: string, method: PaymentMethod, amountCents: number, tipCents: number) =>
      post<PaymentResult>(`/waiter/sessions/${sessionId}/payments`, { method, amount_cents: amountCents, tip_cents: tipCents }),
    // availability
    availability: () => call<AvailabilityBoard>('/availability'),
    setAvailability: (entity: AvailabilityEntity, id: string, isAvailable: boolean) =>
      patch(`/availability/${entity}/${id}`, { is_available: isAvailable }),
    // admin
    dashboard: (date?: string) => call<Dashboard>(`/admin/dashboard${qs({ date })}`),
    orders: (q: OrdersQuery) => call<OrderHistoryRow[]>(`/admin/orders${qs({ ...q })}`),
    listCatalog: <T>(kind: CatalogPath) => call<T[]>(`/admin/${kind}`),
    createCatalog: <T>(kind: CatalogPath, body: unknown) => post<T>(`/admin/${kind}`, body),
    updateCatalog: <T>(kind: CatalogPath, id: string, body: unknown) => patch<T>(`/admin/${kind}/${id}`, body),
    deleteCatalog: (kind: CatalogPath, id: string) => call(`/admin/${kind}/${id}`, { method: 'DELETE' }),
    uploadPhoto: (itemId: string, file: File) => {
      const form = new FormData()
      form.append('file', file)
      return call<{ photo_path: string }>(`/admin/menu-items/${itemId}/photo`, { method: 'POST', body: form })
    },
    adminTables: () => call<AdminTable[]>('/admin/tables'),
    floor: () => call<FloorLayout>('/admin/floor'),
    saveFloor: (body: FloorLayoutIn) => call<FloorLayout>('/admin/floor', { method: 'PUT', body: JSON.stringify(body) }),
    createTable: (body: Partial<AdminTable>) => post<AdminTable>('/admin/tables', body),
    updateTable: (id: string, body: Partial<AdminTable>) => patch<AdminTable>(`/admin/tables/${id}`, body),
    deleteTable: (id: string) => call(`/admin/tables/${id}`, { method: 'DELETE' }),
    regenerateQr: (id: string) => post<{ qr_token: string }>(`/admin/tables/${id}/regenerate-qr`),
    tableQr: (id: string) => call<Blob>(`/admin/tables/${id}/qr.png`, {}, true),
    staff: () => call<StaffRow[]>('/admin/staff'),
    createStaff: (body: { email: string; password: string; full_name: string; role: StaffRole }) =>
      post<StaffRow>('/admin/staff', body),
    updateStaff: (id: string, body: Partial<Pick<StaffRow, 'full_name' | 'role' | 'is_active'>>) =>
      patch<StaffRow>(`/admin/staff/${id}`, body),
    settings: () => call<RestaurantSettings>('/admin/settings'),
    saveSettings: (body: RestaurantSettings) => call<RestaurantSettings>('/admin/settings', { method: 'PUT', body: JSON.stringify(body) }),
  }
}

export type StaffApi = ReturnType<typeof staffApi>
