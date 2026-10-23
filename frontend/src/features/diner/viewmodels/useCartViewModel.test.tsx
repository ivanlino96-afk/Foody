import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../data/api/http'
import type { DinerApi } from '../../../data/api/dinerApi'
import { fakeApi, MENU } from '../../../test/fakeApi'
import { DinerWrapper } from '../../../test/renderDiner'
import { useDiner } from '../DinerContext'
import { useCartViewModel } from './useCartViewModel'

function seedCart() {
  sessionStorage.setItem('foody.cart.tok', JSON.stringify([
    { key: 'a', menuItemId: 'tacos', quantity: 1, removedIngredientIds: ['cebolla'], extras: [{ extraId: 'queso', quantity: 1 }], note: '' },
    { key: 'b', menuItemId: 'enchiladas', quantity: 2, removedIngredientIds: [], extras: [], note: 'sin crema' },
  ]))
}

async function setup(api: DinerApi = fakeApi()) {
  seedCart()
  const wrapper = ({ children }: { children: ReactNode }) => <DinerWrapper api={api}>{children}</DinerWrapper>
  const hook = renderHook(() => ({ vm: useCartViewModel(), diner: useDiner() }), { wrapper })
  await waitFor(() => expect(hook.result.current.vm.roundCents).toBe(11000 + 29000))
  await waitFor(() => expect(hook.result.current.diner.table).not.toBeNull())
  return hook
}

const lastBody = (api: ReturnType<typeof fakeApi>, n = -1) => api.placeOrder.mock.calls.at(n)![0]

describe('useCartViewModel', () => {
  it('describes lines with their customization', async () => {
    const { result } = await setup()
    expect(result.current.vm.lines.map((l) => [l.name, l.mods, l.totalCents])).toEqual([
      ['Tacos al pastor', ['Sin cebolla', '+ Queso extra'], 11000],
      ['Enchiladas verdes', ['Nota: sin crema'], 29000],
    ])
  })

  it('send is disabled until the table can order', async () => {
    const api = fakeApi({ getTable: async () => ({ code: 'M1', label: null, status: 'free', can_order: false }) })
    const { result } = await setup(api)
    expect(result.current.vm.canSend).toBe(false)
    expect(result.current.vm.blockReason).toMatch(/abra tu mesa/)
  })

  it('successful send clears the cart and sends the expected total', async () => {
    const api = fakeApi()
    const { result } = await setup(api)
    let ok = false
    await act(async () => { ok = await result.current.vm.send() })
    expect(ok).toBe(true)
    expect(lastBody(api)).toMatchObject({ expected_total_cents: 40000, lines: [
      { menu_item_id: 'tacos', removed_ingredient_ids: ['cebolla'], extras: [{ extra_id: 'queso', quantity: 1 }], note: null },
      { menu_item_id: 'enchiladas', quantity: 2, note: 'sin crema' },
    ] })
    expect(result.current.diner.cart).toEqual([])
    expect(sessionStorage.getItem('foody.cart.tok')).toBe('[]')
  })

  it('retry reuses the idempotency key', async () => {
    let calls = 0
    const api = fakeApi()
    api.placeOrder.mockImplementation(async () => {
      calls += 1
      if (calls === 1) throw new ApiError(0, 'network', 'sin red')
      return { order_id: 'o1', daily_number: 1, round_number: 1, status: 'received', subtotal_cents: 40000 }
    })
    const { result } = await setup(api)
    await act(async () => { await result.current.vm.send() })
    expect(result.current.vm.error).toMatch(/conexión|red/i)
    await act(async () => { await result.current.vm.send() })
    expect(lastBody(api, 0).idempotency_key).toBe(lastBody(api, 1).idempotency_key)
  })

  it('a changed cart gets a new idempotency key', async () => {
    const api = fakeApi()
    api.placeOrder.mockRejectedValueOnce(new ApiError(0, 'network', 'sin red'))
    const { result } = await setup(api)
    await act(async () => { await result.current.vm.send() })
    act(() => result.current.vm.changeQty(result.current.vm.lines[1].key, 1))
    await act(async () => { await result.current.vm.send() })
    expect(lastBody(api, 0).idempotency_key).not.toBe(lastBody(api, 1).idempotency_key)
  })

  it('item_unavailable marks lines and blocks send', async () => {
    const api = fakeApi()
    api.placeOrder.mockRejectedValueOnce(new ApiError(409, 'item_unavailable', 'Agotado',
      { lines: [{ index: 1, menu_item_id: 'enchiladas', reason: 'item_disabled' }] }))
    const { result } = await setup(api)
    await act(async () => { await result.current.vm.send() })
    expect(result.current.vm.lines.map((l) => l.unavailable)).toEqual([false, true])
    expect(result.current.vm.canSend).toBe(false)
    act(() => result.current.vm.remove(result.current.vm.lines[1].key))
    expect(result.current.vm.canSend).toBe(true)
  })

  it('price_changed asks to confirm the new total', async () => {
    const api = fakeApi()
    api.placeOrder.mockRejectedValueOnce(new ApiError(409, 'price_changed', 'Cambió', { total_cents: 42000 }))
    const { result } = await setup(api)
    await act(async () => { await result.current.vm.send() })
    expect(result.current.vm.priceChangedTo).toBe(42000)
    await act(async () => { await result.current.vm.send() })
    expect(lastBody(api).expected_total_cents).toBe(42000)
    expect(result.current.vm.priceChangedTo).toBeNull()
  })
})

describe('useCartViewModel review fixes', () => {
  it('marks only the line the server names and clears when the cart changes', async () => {
    sessionStorage.setItem('foody.cart.tok', JSON.stringify([
      { key: 'a', menuItemId: 'tacos', quantity: 1, removedIngredientIds: [], extras: [{ extraId: 'queso', quantity: 1 }], note: '' },
      { key: 'b', menuItemId: 'tacos', quantity: 1, removedIngredientIds: [], extras: [], note: '' },
    ]))
    const api = fakeApi()
    api.placeOrder.mockRejectedValueOnce(new ApiError(409, 'item_unavailable', 'Agotado',
      { lines: [{ index: 0, menu_item_id: 'tacos', reason: 'extra_unavailable:Queso extra' }] }))
    const wrapper = ({ children }: { children: ReactNode }) => <DinerWrapper api={api}>{children}</DinerWrapper>
    const { result } = renderHook(() => useCartViewModel(), { wrapper })
    await waitFor(() => expect(result.current.roundCents).toBe(11000 + 9500))
    await waitFor(() => expect(result.current.canSend).toBe(true))
    await act(async () => { await result.current.send() })
    expect(result.current.lines.map((l) => l.unavailable)).toEqual([true, false])
    act(() => result.current.remove(result.current.lines[0].key))
    expect(result.current.canSend).toBe(true)
  })

  it('keeps the idempotency key across a reload of the cart screen', async () => {
    const api = fakeApi()
    api.placeOrder.mockRejectedValueOnce(new ApiError(0, 'network', 'sin red'))
    const first = await setup(api)
    await act(async () => { await first.result.current.vm.send() })
    first.unmount()
    const wrapper = ({ children }: { children: ReactNode }) => <DinerWrapper api={api}>{children}</DinerWrapper>
    const { result } = renderHook(() => useCartViewModel(), { wrapper })
    await waitFor(() => expect(result.current.canSend).toBe(true))
    await act(async () => { await result.current.send() })
    expect(lastBody(api, 0).idempotency_key).toBe(lastBody(api, 1).idempotency_key)
  })

  it('does not mark restored lines unavailable before the menu loads', async () => {
    seedCart()
    let release: (m: typeof MENU) => void = () => undefined
    const api = fakeApi({ getMenu: () => new Promise((r) => { release = r }) })
    const wrapper = ({ children }: { children: ReactNode }) => <DinerWrapper api={api}>{children}</DinerWrapper>
    const { result } = renderHook(() => useCartViewModel(), { wrapper })
    expect(result.current.lines.map((l) => l.unavailable)).toEqual([false, false])
    await act(async () => release(MENU))
  })

  it('drops restored lines for dishes no longer on the menu', async () => {
    sessionStorage.setItem('foody.cart.tok', JSON.stringify([
      { key: 'a', menuItemId: 'tacos', quantity: 1, removedIngredientIds: [], extras: [], note: '' },
      { key: 'g', menuItemId: 'gone', quantity: 1, removedIngredientIds: [], extras: [], note: '' },
    ]))
    const wrapper = ({ children }: { children: ReactNode }) => <DinerWrapper api={fakeApi()}>{children}</DinerWrapper>
    const { result } = renderHook(() => useCartViewModel(), { wrapper })
    await waitFor(() => expect(result.current.lines.map((l) => l.menuItemId)).toEqual(['tacos']))
  })
})
