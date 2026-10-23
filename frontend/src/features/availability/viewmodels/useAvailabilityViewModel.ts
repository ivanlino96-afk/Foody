import { useCallback, useMemo, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import { usePolling } from '../../../shared/usePolling'
import type { AvailabilityBoard, AvailabilityEntity, AvailabilityRow } from '../../../domain/staffTypes'
import { useAuth } from '../../auth/AuthContext'

export const AVAILABILITY_POLL_MS = 30_000

export type AvailabilityTab = 'ingredients' | 'items' | 'extras'
const TABS: { key: AvailabilityTab; label: string; entity: AvailabilityEntity }[] = [
  { key: 'ingredients', label: 'Ingredientes', entity: 'ingredient' },
  { key: 'items', label: 'Platillos', entity: 'menu_item' },
  { key: 'extras', label: 'Extras', entity: 'extra' },
]

export interface AvailabilityViewRow {
  id: string
  name: string
  isAvailable: boolean
  impact: string
  entity: AvailabilityEntity
  tab: AvailabilityTab
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

function impactOf(tab: AvailabilityTab, row: AvailabilityRow): string {
  if (tab === 'items') return ''
  return row.used_in === 1 ? 'En 1 platillo' : `En ${row.used_in} platillos`
}

export function useAvailabilityViewModel() {
  const { api } = useAuth()
  const [board, setBoard] = useState<AvailabilityBoard | null>(null)
  const [tab, setTab] = useState<AvailabilityTab>('ingredients')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => setBoard(await api.availability()), [api])
  usePolling(load, AVAILABILITY_POLL_MS)

  const patchRow = (t: AvailabilityTab, id: string, isAvailable: boolean) =>
    setBoard((b) => b && { ...b, [t]: b[t].map((r) => (r.id === id ? { ...r, is_available: isAvailable } : r)) })

  const toggle = useCallback(async (row: AvailabilityViewRow) => {
    const next = !row.isAvailable
    setNotice(null)
    patchRow(row.tab, row.id, next)
    try {
      await api.setAvailability(row.entity, row.id, next)
    } catch (err) {
      patchRow(row.tab, row.id, row.isAvailable)
      setNotice(err instanceof ApiError ? err.message : 'No se pudo guardar')
    }
  }, [api])

  const rows = useMemo(() => {
    const def = TABS.find((t) => t.key === tab)!
    const q = fold(query)
    return (board?.[tab] ?? [])
      .filter((r) => !q || fold(r.name).includes(q))
      .map((r): AvailabilityViewRow => ({ id: r.id, name: r.name, isAvailable: r.is_available, impact: impactOf(tab, r),
        entity: def.entity, tab }))
  }, [board, tab, query])

  const tabs = TABS.map((t) => ({ key: t.key, label: t.label, count: board?.[t.key].length ?? 0, active: t.key === tab }))
  const offCount = board ? TABS.reduce((n, t) => n + board[t.key].filter((r) => !r.is_available).length, 0) : 0

  return { loading: board === null, tab, setTab, query, setQuery, tabs, rows, offCount, notice, toggle }
}
