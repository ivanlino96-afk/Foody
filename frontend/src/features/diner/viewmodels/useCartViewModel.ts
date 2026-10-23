import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import { cartTotalCents, linePriceCents, toOrderLines, type CartLine } from '../../../domain/cart'
import type { MenuItem } from '../../../domain/types'
import { useDiner } from '../DinerContext'

export interface CartLineView {
  key: string
  menuItemId: string
  name: string
  quantity: number
  mods: string[]
  totalCents: number
  unavailable: boolean
}

export interface CartViewModel {
  lines: CartLineView[]
  roundNumber: number
  roundCents: number
  previousRoundsCents: number
  tableCents: number
  canSend: boolean
  blockReason: string | null
  sending: boolean
  error: string | null
  priceChangedTo: number | null
  send: () => Promise<boolean>
  remove: (key: string) => void
  changeQty: (key: string, quantity: number) => void
}

function describe(line: CartLine, item: MenuItem | undefined): string[] {
  if (!item) return []
  const removed = item.ingredients.filter((i) => line.removedIngredientIds.includes(i.id)).map((i) => `Sin ${i.name.toLowerCase()}`)
  const extras = line.extras.map((e) => {
    const extra = item.extras.find((x) => x.id === e.extraId)
    return extra ? `+ ${e.quantity > 1 ? `${e.quantity}× ` : ''}${extra.name}` : null
  }).filter((x): x is string => x !== null)
  const note = line.note.trim() ? [`Nota: ${line.note.trim()}`] : []
  return [...removed, ...extras, ...note]
}

function lineUnavailable(line: CartLine, item: MenuItem | undefined): boolean {
  if (!item || !item.available) return true
  return line.extras.some((e) => !item.extras.find((x) => x.id === e.extraId)?.available)
}

const signature = (lines: CartLine[]) => lines.map((l) => `${l.key}#${l.quantity}`).join(';')

export function useCartViewModel(): CartViewModel {
  const { api, cart, setCart, itemsById, table, session, refreshMenu, refreshSession } = useDiner()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [priceChangedTo, setPriceChangedTo] = useState<number | null>(null)
  const [serverUnavailable, setServerUnavailable] = useState<Set<string>>(new Set())
  const attempt = useRef<{ signature: string; key: string } | null>(null)

  useEffect(() => {
    // The spec asks for a fresh menu whenever the cart opens.
    void refreshMenu().catch(() => undefined)
  }, [refreshMenu])

  const lines = useMemo(() => cart.map((line): CartLineView => {
    const item = itemsById[line.menuItemId]
    return {
      key: line.key,
      menuItemId: line.menuItemId,
      name: item?.name ?? 'Platillo no disponible',
      quantity: line.quantity,
      mods: describe(line, item),
      totalCents: item ? linePriceCents(line, item) : 0,
      unavailable: lineUnavailable(line, item) || serverUnavailable.has(line.menuItemId),
    }
  }), [cart, itemsById, serverUnavailable])

  const roundCents = cartTotalCents(cart, itemsById)
  const previousRoundsCents = session?.subtotal_cents ?? 0
  const canOrder = table?.can_order ?? false
  const anyUnavailable = lines.some((l) => l.unavailable)

  let blockReason: string | null = null
  if (cart.length === 0) blockReason = 'Tu pedido está vacío'
  else if (!canOrder) blockReason = 'Pide al mesero que abra tu mesa para enviar tu orden'
  else if (anyUnavailable) blockReason = 'Quita el platillo no disponible para continuar'

  const update = (next: CartLine[]) => {
    setCart(next)
    setPriceChangedTo(null)
    setError(null)
  }

  const send = async (): Promise<boolean> => {
    if (blockReason || sending) return false
    const sig = signature(cart)
    if (!attempt.current || attempt.current.signature !== sig) {
      attempt.current = { signature: sig, key: crypto.randomUUID() }
    }
    setSending(true)
    setError(null)
    try {
      await api.placeOrder({
        idempotency_key: attempt.current.key,
        expected_total_cents: priceChangedTo ?? roundCents,
        lines: toOrderLines(cart),
      })
      attempt.current = null
      setPriceChangedTo(null)
      setServerUnavailable(new Set())
      setCart([])
      void refreshSession().catch(() => undefined)
      return true
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError(0, 'unknown', 'Algo salió mal; intenta de nuevo')
      if (e.code === 'item_unavailable') {
        const ids = ((e.details.lines as { menu_item_id: string }[] | undefined) ?? []).map((l) => l.menu_item_id)
        setServerUnavailable(new Set(ids))
        setError('Algo de tu pedido se agotó mientras pedías.')
        void refreshMenu().catch(() => undefined)
      } else if (e.code === 'price_changed') {
        setPriceChangedTo(Number(e.details.total_cents))
        setError(null)
        void refreshMenu().catch(() => undefined)
      } else if (e.code === 'table_not_open') {
        setError('Tu mesa no está abierta para ordenar. Pide ayuda al mesero.')
        void refreshSession().catch(() => undefined)
      } else if (e.code === 'network') {
        setError('No hay conexión. Revisa tu red e intenta de nuevo.')
      } else if (e.code === 'rate_limited') {
        setError('Enviaste muchas órdenes seguidas; espera un momento.')
      } else {
        setError(e.message)
      }
      return false
    } finally {
      setSending(false)
    }
  }

  return {
    lines,
    roundNumber: (session?.rounds.length ?? 0) + 1,
    roundCents,
    previousRoundsCents,
    tableCents: previousRoundsCents + roundCents,
    canSend: !blockReason && !sending,
    blockReason,
    sending,
    error,
    priceChangedTo,
    send,
    remove: (key) => update(cart.filter((l) => l.key !== key)),
    changeQty: (key, quantity) =>
      update(quantity < 1 ? cart.filter((l) => l.key !== key) : cart.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, quantity) } : l))),
  }
}
