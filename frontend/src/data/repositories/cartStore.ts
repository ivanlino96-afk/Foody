import { makeLine, type CartLine } from '../../domain/cart'

const keyFor = (token: string) => `foody.cart.${token}`

function isLine(value: unknown): value is CartLine {
  const v = value as CartLine
  return !!v && typeof v === 'object' && typeof v.menuItemId === 'string' && Number.isInteger(v.quantity) &&
    v.quantity > 0 && Array.isArray(v.removedIngredientIds) && Array.isArray(v.extras) && typeof v.note === 'string'
}

export function loadCart(token: string, knownItemIds?: Set<string>): CartLine[] {
  try {
    const raw = sessionStorage.getItem(keyFor(token))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isLine)
      .filter((l) => !knownItemIds || knownItemIds.has(l.menuItemId))
      .map((l) => makeLine(l))
  } catch {
    return []
  }
}

export function saveCart(token: string, lines: CartLine[]): void {
  try {
    sessionStorage.setItem(keyFor(token), JSON.stringify(lines))
  } catch {
    // Storage may be full or blocked (private mode); the cart still lives in memory.
  }
}

export function clearCart(token: string): void {
  try {
    sessionStorage.removeItem(keyFor(token))
  } catch {
    // ignore
  }
}
