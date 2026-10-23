import { useMemo, useState } from 'react'
import { cartCount, cartTotalCents } from '../../../domain/cart'
import type { MenuItem } from '../../../domain/types'
import { useDiner, type DinerStatus } from '../DinerContext'

export const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export interface MenuViewModel {
  status: DinerStatus
  tableLine: string
  canOrder: boolean
  categories: { id: string; name: string }[]
  activeCategoryId: string | null
  setActiveCategory: (id: string | null) => void
  query: string
  setQuery: (q: string) => void
  visibleItems: MenuItem[]
  cartCount: number
  cartTotalCents: number
}

export function useMenuViewModel(): MenuViewModel {
  const { status, table, menu, menuLoaded, cart, itemsById } = useDiner()
  const [activeCategoryId, setActiveCategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const visibleItems = useMemo(() => {
    const q = normalize(query)
    return menu
      .filter((c) => activeCategoryId === null || c.id === activeCategoryId)
      .flatMap((c) => c.items)
      .filter((i) => !q || normalize(i.name).includes(q) || normalize(i.description).includes(q))
  }, [menu, activeCategoryId, query])

  const place = table ? [`Mesa ${table.code}`, table.label].filter(Boolean).join(' · ') : ''
  const canOrder = table?.can_order ?? false
  return {
    status: status === 'ready' && !menuLoaded ? 'loading' : status,
    tableLine: table ? `${place} · ${canOrder ? 'abierta' : 'Pide al mesero que abra tu mesa'}` : '',
    canOrder,
    categories: menu.map((c) => ({ id: c.id, name: c.name })),
    activeCategoryId,
    setActiveCategory,
    query,
    setQuery,
    visibleItems,
    cartCount: cartCount(cart),
    cartTotalCents: cartTotalCents(cart, itemsById),
  }
}
