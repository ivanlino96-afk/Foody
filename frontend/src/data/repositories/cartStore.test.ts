import { describe, expect, it } from 'vitest'
import { makeLine } from '../../domain/cart'
import { clearCart, loadCart, saveCart } from './cartStore'

const line = (id: string) => makeLine({ menuItemId: id, quantity: 1, removedIngredientIds: [], extras: [], note: '' })

describe('cartStore', () => {
  it('round-trips per token', () => {
    saveCart('t1', [line('a')])
    expect(loadCart('t1').map((l) => l.menuItemId)).toEqual(['a'])
    expect(loadCart('t2')).toEqual([])
    clearCart('t1')
    expect(loadCart('t1')).toEqual([])
  })

  it('cart store drops lines for unknown items', () => {
    saveCart('t1', [line('a'), line('gone')])
    expect(loadCart('t1', new Set(['a'])).map((l) => l.menuItemId)).toEqual(['a'])
  })

  it('survives broken JSON and malformed lines', () => {
    sessionStorage.setItem('foody.cart.t1', '{nope')
    expect(loadCart('t1')).toEqual([])
    sessionStorage.setItem('foody.cart.t1', JSON.stringify([{ menuItemId: 'a', quantity: 'x' }, 7]))
    expect(loadCart('t1')).toEqual([])
  })
})
