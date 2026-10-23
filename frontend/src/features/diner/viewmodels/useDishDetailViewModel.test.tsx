import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { fakeApi } from '../../../test/fakeApi'
import { DinerWrapper } from '../../../test/renderDiner'
import { useDiner } from '../DinerContext'
import { useDishDetailViewModel } from './useDishDetailViewModel'

function setup(itemId = 'tacos') {
  const wrapper = ({ children }: { children: ReactNode }) => <DinerWrapper api={fakeApi()}>{children}</DinerWrapper>
  return renderHook(() => ({ vm: useDishDetailViewModel(itemId), diner: useDiner() }), { wrapper })
}

describe('useDishDetailViewModel', () => {
  it('essential ingredients cannot be removed', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.vm.item).not.toBeNull())
    act(() => result.current.vm.toggleIngredient('tortilla'))
    act(() => result.current.vm.toggleIngredient('salsa'))
    expect([...result.current.vm.removed]).toEqual([])
    act(() => result.current.vm.toggleIngredient('cebolla'))
    expect([...result.current.vm.removed]).toEqual(['cebolla'])
  })

  it('extras are capped at max_quantity', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.vm.item).not.toBeNull())
    for (let i = 0; i < 4; i++) act(() => result.current.vm.incExtra('queso'))
    expect(result.current.vm.extraQty('queso')).toBe(2)
    act(() => result.current.vm.incExtra('aguacate'))
    expect(result.current.vm.extraQty('aguacate')).toBe(0)
    act(() => result.current.vm.decExtra('queso'))
    expect(result.current.vm.extraQty('queso')).toBe(1)
  })

  it('preview matches line price and add puts the line in the cart', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.vm.item).not.toBeNull())
    act(() => result.current.vm.incExtra('queso'))
    act(() => result.current.vm.inc())
    act(() => result.current.vm.setNote('sin picante'))
    expect(result.current.vm.previewCents).toBe((9500 + 1500) * 2)
    act(() => result.current.vm.add())
    expect(result.current.diner.cart).toMatchObject([
      { menuItemId: 'tacos', quantity: 2, extras: [{ extraId: 'queso', quantity: 1 }], note: 'sin picante' },
    ])
  })

  it('cannot add a sold-out dish', async () => {
    const { result } = setup('sopa')
    await waitFor(() => expect(result.current.vm.item).not.toBeNull())
    expect(result.current.vm.canAdd).toBe(false)
  })
})
