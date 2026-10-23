import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeApi } from '../../../test/fakeApi'
import { DinerWrapper } from '../../../test/renderDiner'
import { useMenuViewModel } from './useMenuViewModel'

afterEach(() => vi.useRealTimers())

function setup(api = fakeApi()) {
  const wrapper = ({ children }: { children: ReactNode }) => <DinerWrapper api={api}>{children}</DinerWrapper>
  return { api, ...renderHook(() => useMenuViewModel(), { wrapper }) }
}

describe('useMenuViewModel', () => {
  it('filters by category and accent-insensitive search', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.visibleItems.map((i) => i.id)).toEqual(['tacos', 'enchiladas', 'sopa'])
    act(() => result.current.setQuery('ENCHILADA'))
    expect(result.current.visibleItems.map((i) => i.id)).toEqual(['enchiladas'])
    act(() => result.current.setQuery('sopa'))
    act(() => result.current.setActiveCategory('c-tacos'))
    expect(result.current.visibleItems).toEqual([])
    act(() => result.current.setQuery(''))
    expect(result.current.visibleItems.map((i) => i.id)).toEqual(['tacos'])
  })

  it('refreshes the menu every 30 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { api, result } = setup()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(api.getMenu).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(api.getMenu).toHaveBeenCalledTimes(2)
  })

  it('reports cart count and total', async () => {
    sessionStorage.setItem('foody.cart.tok', JSON.stringify([
      { key: 'k', menuItemId: 'tacos', quantity: 2, removedIngredientIds: [], extras: [{ extraId: 'queso', quantity: 1 }], note: '' },
    ]))
    const { result } = setup()
    await waitFor(() => expect(result.current.cartTotalCents).toBe(22000))
    expect(result.current.cartCount).toBe(2)
  })
})
