// Floor plan: areas and tables in meters on one board (x to the right, y toward the viewer).

export type AreaKind = 'salon' | 'jardin' | 'roof' | 'terraza' | 'barra' | 'privado' | 'otro'
export type TableKind = 'table' | 'round' | 'bar' | 'high' | 'booth'
export type Rotation = 0 | 90 | 180 | 270

export interface FloorArea {
  id: string | null
  /** Stable client key: the id for saved areas, a temporary one for new areas. */
  key: string
  name: string
  kind: AreaKind
  x: number
  y: number
  width: number
  depth: number
}

export interface FloorTable {
  id: string | null
  key: string
  code: string
  label: string | null
  capacity: number
  kind: TableKind
  pos_x: number | null
  pos_y: number | null
  rotation: Rotation
}

export const AREA_KINDS: Record<AreaKind, { label: string; floor: string; wall: number }> = {
  salon: { label: 'Salón', floor: '#F7F5F0', wall: 0.32 },
  jardin: { label: 'Jardín', floor: '#E9F0E6', wall: 0.12 },
  roof: { label: 'Roof', floor: '#F1ECE3', wall: 0.5 },
  terraza: { label: 'Terraza', floor: '#F3EEE5', wall: 0.14 },
  barra: { label: 'Barra', floor: '#F2EFEA', wall: 0.32 },
  privado: { label: 'Privado', floor: '#F5F2EC', wall: 0.6 },
  otro: { label: 'Otro', floor: '#F4F2EE', wall: 0.2 },
}

export const TABLE_KINDS: Record<TableKind, { label: string; plural: string }> = {
  table: { label: 'Mesa', plural: 'Mesas' },
  round: { label: 'Mesa redonda', plural: 'Mesas redondas' },
  bar: { label: 'Barra', plural: 'Barras' },
  high: { label: 'Periquera', plural: 'Periqueras' },
  booth: { label: 'Gabinete', plural: 'Gabinetes' },
}

export const CODE_PATTERN = /^[A-Za-z0-9 _-]{1,20}$/
export const GRID = 0.25
export const MAX_METERS = 100

export const snap = (v: number, step = GRID) => Math.round(v / step) * step
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Size of a table's top seen from above (meters), before rotation: width along x, depth along y. */
export function footprint(kind: TableKind, capacity: number): { width: number; depth: number } {
  const c = Math.max(1, capacity)
  switch (kind) {
    case 'round': {
      const d = c <= 2 ? 0.75 : c <= 4 ? 1.05 : c <= 6 ? 1.35 : 1.6
      return { width: d, depth: d }
    }
    case 'high': {
      const d = c <= 2 ? 0.6 : 0.8
      return { width: d, depth: d }
    }
    case 'bar':
      return { width: Math.max(1.2, c * 0.6), depth: 0.55 }
    case 'booth':
      return { width: Math.max(1.2, Math.ceil(c / 2) * 0.6), depth: 0.8 }
    case 'table': {
      if (c <= 2) return { width: 0.75, depth: 0.75 }
      if (c <= 4) return { width: 1.1, depth: 0.85 }
      return { width: Math.ceil(c / 2) * 0.6 + 0.1, depth: 0.9 }
    }
  }
}

export interface Seat {
  x: number
  y: number
  /** Unit vector from the seat toward its backrest (away from the table). */
  bx: number
  by: number
}

/** Where chairs or stools go around a table, relative to its center and before rotation. */
export function seats(kind: TableKind, capacity: number): Seat[] {
  const c = Math.max(1, capacity)
  const { width, depth } = footprint(kind, c)
  if (kind === 'round' || kind === 'high') {
    const r = width / 2 + (kind === 'high' ? 0.28 : 0.32)
    return Array.from({ length: c }, (_, i) => {
      const a = (i / c) * Math.PI * 2 - Math.PI / 2
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, bx: Math.cos(a), by: Math.sin(a) }
    })
  }
  if (kind === 'bar') {
    return Array.from({ length: c }, (_, i) => ({ x: -width / 2 + 0.3 + i * 0.6, y: depth / 2 + 0.35, bx: 0, by: 1 }))
  }
  const perSide = kind === 'booth' ? Math.ceil(c / 2) : c <= 2 ? 1 : Math.ceil(c / 2)
  const list: Seat[] = []
  const step = width / perSide
  for (let i = 0; i < c; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const slot = Math.floor(i / 2)
    const x = -width / 2 + step * (slot + 0.5)
    list.push({ x, y: side * (depth / 2 + (kind === 'booth' ? 0.32 : 0.3)), bx: 0, by: side })
  }
  return list
}

/** Footprint after rotation, in board axes. */
export function rotatedFootprint(t: Pick<FloorTable, 'kind' | 'capacity' | 'rotation'>) {
  const { width, depth } = footprint(t.kind, t.capacity)
  return t.rotation === 90 || t.rotation === 270 ? { width: depth, depth: width } : { width, depth }
}

/** Area under a point; the smallest wins so a bar drawn inside the salón takes the tables on it (same rule as the API). */
export function areaAt(x: number | null, y: number | null, areas: FloorArea[]): FloorArea | null {
  if (x === null || y === null) return null
  const inside = areas.filter((a) => x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.depth)
  return inside.sort((a, b) => a.width * a.depth - b.width * b.depth)[0] ?? null
}

/** Board that holds every area and placed table, with a margin; at least 12 x 8 m. */
export function boardBounds(areas: FloorArea[], tables: Pick<FloorTable, 'pos_x' | 'pos_y'>[]) {
  let maxX = 12
  let maxY = 8
  for (const a of areas) {
    maxX = Math.max(maxX, a.x + a.width)
    maxY = Math.max(maxY, a.y + a.depth)
  }
  for (const t of tables) {
    if (t.pos_x !== null && t.pos_y !== null) {
      maxX = Math.max(maxX, t.pos_x + 1)
      maxY = Math.max(maxY, t.pos_y + 1)
    }
  }
  return { width: maxX, depth: maxY }
}

/** Next free code with the given prefix: M1, M2… → M3. */
export function nextCode(tables: Pick<FloorTable, 'code'>[], prefix: string): string {
  const used = new Set(tables.map((t) => t.code.toUpperCase()))
  for (let n = 1; ; n++) {
    const code = `${prefix}${n}`
    if (!used.has(code.toUpperCase())) return code
  }
}

export const CODE_PREFIX: Record<TableKind, string> = { table: 'M', round: 'M', bar: 'B', high: 'P', booth: 'G' }

export interface LayoutProblem {
  key: string
  message: string
}

/** What must be fixed before saving: repeated or invalid codes, empty names, capacity out of range. */
export function layoutProblems(areas: FloorArea[], tables: FloorTable[]): LayoutProblem[] {
  const problems: LayoutProblem[] = []
  const seen = new Map<string, string>()
  for (const t of tables) {
    const code = t.code.trim()
    if (!CODE_PATTERN.test(code)) problems.push({ key: t.key, message: 'Número de mesa: letras, números, - o _ (hasta 20)' })
    else if (seen.has(code)) problems.push({ key: t.key, message: `El número ${code} está repetido` })
    seen.set(code, t.key)
    if (!(Number.isInteger(t.capacity) && t.capacity >= 1 && t.capacity <= 50)) {
      problems.push({ key: t.key, message: `${code || 'Mesa'}: capacidad entre 1 y 50` })
    }
  }
  for (const a of areas) {
    if (!a.name.trim()) problems.push({ key: a.key, message: 'Cada área necesita un nombre' })
    if (a.width <= 0 || a.depth <= 0) problems.push({ key: a.key, message: `${a.name}: medidas inválidas` })
  }
  return problems
}
