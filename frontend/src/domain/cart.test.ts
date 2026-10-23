import { describe, expect, it } from 'vitest'
import { addLine, cartTotalCents, lineKey, linePriceCents, toOrderLines, type CartLine } from './cart'
import type { MenuItem } from './types'

const item: MenuItem = {
  id: 'i1', name: 'Bowl', description: '', price_cents: 9500, photo_path: null, prep_minutes: 10, tags: [],
  available: true, unavailable_reason: null,
  ingredients: [{ id: 'g1', name: 'Cebolla', is_removable: true, available: true }],
  extras: [{ id: 'x1', name: 'Aguacate', price_cents: 1500, max_quantity: 3, available: true },
           { id: 'x2', name: 'Queso', price_cents: 1000, max_quantity: 1, available: true }],
}

function line(over: Partial<CartLine> = {}): CartLine {
  const base = { menuItemId: 'i1', quantity: 1, removedIngredientIds: [], extras: [], note: '', ...over }
  return { ...base, key: lineKey(base) }
}

describe('cart', () => {
  it('prices a line with extras times quantity', () => {
    expect(linePriceCents(line({ quantity: 2, extras: [{ extraId: 'x1', quantity: 2 }] }), item)).toBe(25000)
  })

  it('totals lines and skips unknown items', () => {
    const lines = [line(), line({ menuItemId: 'gone' })]
    expect(cartTotalCents(lines, { i1: item })).toBe(9500)
  })

  it('merges identical customizations', () => {
    const a = line({ extras: [{ extraId: 'x2', quantity: 1 }, { extraId: 'x1', quantity: 1 }] })
    const b = line({ extras: [{ extraId: 'x1', quantity: 1 }, { extraId: 'x2', quantity: 1 }] })
    const merged = addLine([a], b)
    expect(merged).toHaveLength(1)
    expect(merged[0].quantity).toBe(2)
  })

  it('keeps different notes apart', () => {
    expect(addLine([line({ note: 'sin sal' })], line())).toHaveLength(2)
  })

  it('builds the order body with null for blank notes', () => {
    const body = toOrderLines([line({ note: '   ', removedIngredientIds: ['g1'], extras: [{ extraId: 'x1', quantity: 2 }] }),
      line({ note: ' bien dorado ' })])
    expect(body).toEqual([
      { menu_item_id: 'i1', quantity: 1, removed_ingredient_ids: ['g1'], extras: [{ extra_id: 'x1', quantity: 2 }], note: null },
      { menu_item_id: 'i1', quantity: 1, removed_ingredient_ids: [], extras: [], note: 'bien dorado' },
    ])
  })
})

describe('cart limits', () => {
  it('caps merged quantities at 50', () => {
    expect(addLine([line({ quantity: 50 })], line())[0].quantity).toBe(50)
  })
})
