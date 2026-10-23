import { useCallback, useState } from 'react'
import { addLine, linePriceCents, makeLine } from '../../../domain/cart'
import type { MenuItem } from '../../../domain/types'
import { useDiner } from '../DinerContext'

export const MAX_QUANTITY = 50
export const MAX_NOTE = 200

export interface DishDetailViewModel {
  item: MenuItem | null
  loading: boolean
  quantity: number
  inc: () => void
  dec: () => void
  removed: Set<string>
  canRemove: (ingredientId: string) => boolean
  toggleIngredient: (ingredientId: string) => void
  extraQty: (extraId: string) => number
  incExtra: (extraId: string) => void
  decExtra: (extraId: string) => void
  note: string
  setNote: (note: string) => void
  previewCents: number
  canAdd: boolean
  add: () => void
}

export function useDishDetailViewModel(itemId: string): DishDetailViewModel {
  const { itemsById, menuLoaded, cart, setCart } = useDiner()
  const item = itemsById[itemId] ?? null
  const [quantity, setQuantity] = useState(1)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [extras, setExtras] = useState<Record<string, number>>({})
  const [note, setNoteState] = useState('')

  const canRemove = useCallback((id: string) => {
    const ing = item?.ingredients.find((i) => i.id === id)
    return !!ing && ing.is_removable && ing.available
  }, [item])

  const toggleIngredient = (id: string) => {
    if (!canRemove(id)) return
    setRemoved((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const setExtra = (id: string, delta: number) => {
    const extra = item?.extras.find((e) => e.id === id)
    if (!extra || !extra.available) return
    setExtras((prev) => ({ ...prev, [id]: Math.max(0, Math.min(extra.max_quantity, (prev[id] ?? 0) + delta)) }))
  }

  const line = makeLine({
    menuItemId: itemId,
    quantity,
    removedIngredientIds: [...removed],
    extras: Object.entries(extras).map(([extraId, q]) => ({ extraId, quantity: q })),
    note,
  })

  return {
    item,
    loading: !menuLoaded,
    quantity,
    inc: () => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1)),
    dec: () => setQuantity((q) => Math.max(1, q - 1)),
    removed,
    canRemove,
    toggleIngredient,
    extraQty: (id) => extras[id] ?? 0,
    incExtra: (id) => setExtra(id, 1),
    decExtra: (id) => setExtra(id, -1),
    note,
    setNote: (value) => setNoteState(value.split('\u0000').join('').slice(0, MAX_NOTE)),
    previewCents: item ? linePriceCents(line, item) : 0,
    canAdd: !!item && item.available,
    add: () => {
      if (item && item.available) setCart(addLine(cart, line))
    },
  }
}
