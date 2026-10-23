import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import type { FloorLayoutIn } from '../../../data/api/staffApi'
import {
  AREA_KINDS, CODE_PREFIX, MAX_METERS, areaAt, boardBounds, clamp, layoutProblems, nextCode, snap,
  type AreaKind, type FloorArea, type FloorTable, type Rotation, type TableKind,
} from '../../../domain/floor'
import type { FloorLayout } from '../../../domain/staffTypes'
import type { FloorSelection, FloorView } from '../../floor/FloorScene'
import { useAuth } from '../../auth/AuthContext'

interface Plan {
  areas: FloorArea[]
  tables: FloorTable[]
  deleted: string[]
}

const DEFAULT_CAPACITY: Record<TableKind, number> = { table: 4, round: 4, bar: 6, high: 2, booth: 4 }
const EMPTY: Plan = { areas: [], tables: [], deleted: [] }
let tempId = 0
const newKey = (prefix: string) => `new-${prefix}-${++tempId}`

export function planFromLayout(layout: FloorLayout): Plan {
  return {
    areas: layout.areas.map((a) => ({ id: a.id, key: a.id, name: a.name, kind: a.kind, x: a.x, y: a.y, width: a.width,
      depth: a.depth })),
    tables: layout.tables.map((t) => ({ id: t.id, key: t.id, code: t.code, label: t.label, capacity: t.capacity ?? 4,
      kind: t.kind, pos_x: t.pos_x, pos_y: t.pos_y, rotation: t.rotation })),
    deleted: [],
  }
}

export function planToBody(plan: Plan): FloorLayoutIn {
  return {
    areas: plan.areas.map(({ id, key, name, kind, x, y, width, depth }) => ({ id, key, name: name.trim(), kind, x, y, width,
      depth })),
    tables: plan.tables.map(({ id, code, label, capacity, kind, pos_x, pos_y, rotation }) => ({ id, code: code.trim(), label,
      capacity, kind, pos_x, pos_y, rotation })),
    deleted_table_ids: plan.deleted,
  }
}

/** A free spot near (x, y): walks a spiral on a 1.5 m grid until no placed table is closer than 1.6 m. */
export function freeSpot(tables: FloorTable[], x: number, y: number): { x: number; y: number } {
  const taken = tables.filter((t) => t.pos_x !== null && t.pos_y !== null)
  const free = (px: number, py: number) => taken.every((t) => Math.hypot(t.pos_x! - px, t.pos_y! - py) >= 1.6)
  for (let ring = 0; ring < 12; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue
        const px = snap(clamp(x + dx * 1.5, 0.5, MAX_METERS))
        const py = snap(clamp(y + dy * 1.5, 0.5, MAX_METERS))
        if (free(px, py)) return { x: px, y: py }
      }
    }
  }
  return { x: snap(x), y: snap(y) }
}

export function useFloorEditorViewModel() {
  const { api } = useAuth()
  const [saved, setSaved] = useState<Plan | null>(null)
  const [plan, setPlan] = useState<Plan>(EMPTY)
  const [history, setHistory] = useState<Plan[]>([])
  const [selection, setSelection] = useState<FloorSelection>(null)
  const [view, setView] = useState<FloorView>('3d')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  const current = useRef<Plan>(EMPTY)

  const load = useCallback(async () => {
    try {
      const next = planFromLayout(await api.floor())
      setSaved(next)
      current.current = next
      setPlan(next)
      setHistory([])
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudo cargar el plano')
    }
  }, [api])
  useEffect(() => {
    void load()
  }, [load])

  // `current` holds the latest plan, so quick successive drag events build on each other without stale closures.
  const apply = useCallback((next: Plan) => {
    current.current = next
    setPlan(next)
    setSavedNote(null)
  }, [])

  /** Applies a change and keeps the previous plan for undo. */
  const change = useCallback((fn: (p: Plan) => Plan) => {
    const prev = current.current
    const next = fn(prev)
    if (next === prev) return
    setHistory((h) => [...h.slice(-49), prev])
    apply(next)
  }, [apply])

  // Drags update the plan live and record one undo step when the pointer is released.
  const dragBase = useRef<Plan | null>(null)
  const dragTo = useCallback((done: boolean, fn: (base: Plan) => Plan) => {
    const base = dragBase.current ?? current.current
    dragBase.current = done ? null : base
    const next = fn(base)
    if (done && JSON.stringify(next) !== JSON.stringify(base)) setHistory((h) => [...h.slice(-49), base])
    apply(next)
  }, [apply])

  const updateTable = useCallback((key: string, patch: Partial<FloorTable>) =>
    change((p) => ({ ...p, tables: p.tables.map((t) => (t.key === key ? { ...t, ...patch } : t)) })), [change])
  const updateArea = useCallback((key: string, patch: Partial<FloorArea>) =>
    change((p) => ({ ...p, areas: p.areas.map((a) => (a.key === key ? { ...a, ...patch } : a)) })), [change])

  const selectedTable = selection?.type === 'table' ? plan.tables.find((t) => t.key === selection.key) ?? null : null
  const selectedArea = selection?.type === 'area' ? plan.areas.find((a) => a.key === selection.key) ?? null : null

  const bounds = boardBounds(plan.areas, plan.tables)

  const addTable = (kind: TableKind) => {
    const area = selectedArea ?? (selectedTable && areaAt(selectedTable.pos_x, selectedTable.pos_y, plan.areas)) ?? plan.areas[0]
    const start = area ? { x: area.x + area.width / 2, y: area.y + area.depth / 2 } : { x: bounds.width / 2, y: bounds.depth / 2 }
    const spot = freeSpot(plan.tables, start.x, start.y)
    const table: FloorTable = { id: null, key: newKey('t'), code: nextCode(plan.tables, CODE_PREFIX[kind]), label: null,
      capacity: DEFAULT_CAPACITY[kind], kind, pos_x: spot.x, pos_y: spot.y, rotation: 0 }
    change((p) => ({ ...p, tables: [...p.tables, table] }))
    setSelection({ type: 'table', key: table.key })
  }

  const addArea = (kind: AreaKind) => {
    const label = AREA_KINDS[kind].label
    const same = plan.areas.filter((a) => a.name.startsWith(label)).length
    const area: FloorArea = { id: null, key: newKey('a'), name: same ? `${label} ${same + 1}` : label, kind,
      x: plan.areas.length ? snap(bounds.width + 0.5) : 0, y: 0, width: 8, depth: 6 }
    change((p) => ({ ...p, areas: [...p.areas, area] }))
    setSelection({ type: 'area', key: area.key })
  }

  const removeSelected = () => {
    if (selectedTable) {
      const t = selectedTable
      change((p) => ({ ...p, tables: p.tables.filter((x) => x.key !== t.key), deleted: t.id ? [...p.deleted, t.id] : p.deleted }))
    } else if (selectedArea) {
      const a = selectedArea
      change((p) => ({ ...p, areas: p.areas.filter((x) => x.key !== a.key) }))
    }
    setSelection(null)
  }

  const duplicateSelected = () => {
    if (!selectedTable) return
    const t = selectedTable
    const spot = freeSpot(plan.tables, (t.pos_x ?? 0) + 1.5, t.pos_y ?? 0)
    const copy: FloorTable = { ...t, id: null, key: newKey('t'), code: nextCode(plan.tables, CODE_PREFIX[t.kind]),
      pos_x: spot.x, pos_y: spot.y }
    change((p) => ({ ...p, tables: [...p.tables, copy] }))
    setSelection({ type: 'table', key: copy.key })
  }

  const rotateSelected = () => {
    if (selectedTable) updateTable(selectedTable.key, { rotation: ((selectedTable.rotation + 90) % 360) as Rotation })
  }

  const placeTable = (key: string) => {
    const spot = freeSpot(plan.tables, bounds.width / 2, bounds.depth / 2)
    updateTable(key, { pos_x: spot.x, pos_y: spot.y })
    setSelection({ type: 'table', key })
  }

  const moveTable = useCallback((key: string, dx: number, dy: number, done: boolean) => dragTo(done, (base) => ({
    ...base,
    tables: base.tables.map((t) => (t.key === key && t.pos_x !== null && t.pos_y !== null
      ? { ...t, pos_x: snap(clamp(t.pos_x + dx, 0, MAX_METERS)), pos_y: snap(clamp(t.pos_y + dy, 0, MAX_METERS)) } : t)),
  })), [dragTo])

  /** Moving an area carries the tables standing on it. */
  const moveArea = useCallback((key: string, dx: number, dy: number, done: boolean) => dragTo(done, (base) => {
    const area = base.areas.find((a) => a.key === key)
    if (!area) return base
    const nx = snap(clamp(area.x + dx, 0, MAX_METERS - area.width))
    const ny = snap(clamp(area.y + dy, 0, MAX_METERS - area.depth))
    const [mx, my] = [nx - area.x, ny - area.y]
    return {
      ...base,
      areas: base.areas.map((a) => (a.key === key ? { ...a, x: nx, y: ny } : a)),
      tables: base.tables.map((t) => (areaAt(t.pos_x, t.pos_y, base.areas)?.key === key
        ? { ...t, pos_x: t.pos_x! + mx, pos_y: t.pos_y! + my } : t)),
    }
  }), [dragTo])

  const resizeArea = useCallback((key: string, dx: number, dy: number, done: boolean) => dragTo(done, (base) => ({
    ...base,
    areas: base.areas.map((a) => (a.key === key
      ? { ...a, width: snap(clamp(a.width + dx, 1, MAX_METERS - a.x)), depth: snap(clamp(a.depth + dy, 1, MAX_METERS - a.y)) }
      : a)),
  })), [dragTo])

  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    apply(prev)
    setSelection((s) => (s && [...prev.tables, ...prev.areas].some((x) => x.key === s.key) ? s : null))
  }

  const problems = useMemo(() => layoutProblems(plan.areas, plan.tables), [plan])
  const dirty = saved !== null && JSON.stringify(planToBody(plan)) !== JSON.stringify(planToBody(saved))

  const save = async () => {
    if (problems.length) {
      setNotice(problems[0].message)
      return false
    }
    setSaving(true)
    setNotice(null)
    try {
      const next = planFromLayout(await api.saveFloor(planToBody(plan)))
      setSaved(next)
      apply(next)
      setHistory([])
      setSelection(null)
      setSavedNote('Plano guardado. El mesero ya lo ve.')
      return true
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudo guardar el plano')
      return false
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    const placed = plan.tables.filter((t) => t.pos_x !== null && t.pos_y !== null)
    const byArea = plan.areas.map((a) => {
      const inside = placed.filter((t) => areaAt(t.pos_x, t.pos_y, plan.areas)?.key === a.key)
      return { area: a, tables: inside.length, seats: inside.reduce((s, t) => s + t.capacity, 0) }
    })
    return {
      byArea,
      tables: plan.tables.length,
      seats: plan.tables.reduce((s, t) => s + t.capacity, 0),
      unplaced: plan.tables.filter((t) => t.pos_x === null || t.pos_y === null),
      outside: placed.filter((t) => !areaAt(t.pos_x, t.pos_y, plan.areas)).length,
    }
  }, [plan])

  return {
    loading: saved === null && notice === null,
    areas: plan.areas,
    tables: plan.tables,
    selection,
    select: setSelection,
    selectedTable,
    selectedArea,
    selectedTableArea: selectedTable ? areaAt(selectedTable.pos_x, selectedTable.pos_y, plan.areas) : null,
    view,
    setView,
    addTable,
    addArea,
    updateTable,
    updateArea,
    removeSelected,
    duplicateSelected,
    rotateSelected,
    placeTable,
    moveTable,
    moveArea,
    resizeArea,
    canUndo: history.length > 0,
    undo,
    dirty,
    problems,
    saving,
    save,
    discard: () => { if (saved) { apply(saved); setHistory([]); setSelection(null) } },
    notice,
    dismissNotice: () => setNotice(null),
    savedNote,
    summary,
  }
}

export type FloorEditorViewModel = ReturnType<typeof useFloorEditorViewModel>
