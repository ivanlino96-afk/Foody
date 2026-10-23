import type { MenuItem, OrderLineBody } from './types'

export interface CartExtra {
  extraId: string
  quantity: number
}

export interface CartLine {
  key: string
  menuItemId: string
  quantity: number
  removedIngredientIds: string[]
  extras: CartExtra[]
  note: string
}

/** The backend accepts 1–50 per line. */
export const MAX_LINE_QUANTITY = 50

type LineContent = Omit<CartLine, 'key'>

/** Same dish with the same customization always yields the same key. */
export function lineKey(line: LineContent): string {
  const removed = [...line.removedIngredientIds].sort().join(',')
  const extras = line.extras
    .filter((e) => e.quantity > 0)
    .map((e) => `${e.extraId}x${e.quantity}`)
    .sort()
    .join(',')
  return [line.menuItemId, removed, extras, line.note.trim()].join('|')
}

export function makeLine(content: LineContent): CartLine {
  const clean = { ...content, extras: content.extras.filter((e) => e.quantity > 0) }
  return { ...clean, key: lineKey(clean) }
}

/** Preview only: the backend recomputes and answers price_changed if it differs. */
export function linePriceCents(line: CartLine, item: MenuItem): number {
  const extras = line.extras.reduce((sum, e) => {
    const extra = item.extras.find((x) => x.id === e.extraId)
    return sum + (extra ? extra.price_cents * e.quantity : 0)
  }, 0)
  return (item.price_cents + extras) * line.quantity
}

export function cartTotalCents(lines: CartLine[], itemsById: Record<string, MenuItem>): number {
  return lines.reduce((sum, line) => {
    const item = itemsById[line.menuItemId]
    return item ? sum + linePriceCents(line, item) : sum
  }, 0)
}

export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const incoming = makeLine(line)
  const existing = lines.find((l) => l.key === incoming.key)
  if (!existing) return [...lines, incoming]
  return lines.map((l) => (l.key === incoming.key
    ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + incoming.quantity) }
    : l))
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}

export function toOrderLines(lines: CartLine[]): OrderLineBody[] {
  return lines.map((l) => ({
    menu_item_id: l.menuItemId,
    quantity: l.quantity,
    removed_ingredient_ids: [...l.removedIngredientIds],
    extras: l.extras.map((e) => ({ extra_id: e.extraId, quantity: e.quantity })),
    note: l.note.trim() ? l.note.trim() : null,
  }))
}
