import { describe, expect, it } from 'vitest'
import { areaAt, boardBounds, footprint, layoutProblems, nextCode, rotatedFootprint, seats, type FloorArea, type FloorTable } from './floor'

const area = (over: Partial<FloorArea>): FloorArea =>
  ({ id: null, key: 'a', name: 'Salón', kind: 'salon', x: 0, y: 0, width: 10, depth: 8, ...over })
const table = (over: Partial<FloorTable>): FloorTable =>
  ({ id: null, key: 't', code: 'M1', label: null, capacity: 4, kind: 'table', pos_x: 1, pos_y: 1, rotation: 0, ...over })

describe('floor', () => {
  it('gives every seat a chair and grows long tables with capacity', () => {
    for (const kind of ['table', 'round', 'bar', 'high', 'booth'] as const) {
      expect(seats(kind, 6)).toHaveLength(6)
    }
    expect(footprint('table', 8).width).toBeGreaterThan(footprint('table', 4).width)
    const bar = rotatedFootprint({ kind: 'bar', capacity: 6, rotation: 90 })
    expect([bar.width, bar.depth.toFixed(2)]).toEqual([0.55, '3.60'])
  })

  it('finds the smallest area under a point, like the API', () => {
    const salon = area({ key: 'salon' })
    const bar = area({ key: 'bar', x: 6, width: 4, depth: 3 })
    expect(areaAt(7, 1, [salon, bar])?.key).toBe('bar')
    expect(areaAt(2, 6, [salon, bar])?.key).toBe('salon')
    expect(areaAt(20, 20, [salon])).toBeNull()
    expect(areaAt(null, null, [salon])).toBeNull()
  })

  it('sizes the board to hold areas and tables', () => {
    expect(boardBounds([area({ width: 20 })], [table({ pos_x: 3, pos_y: 14 })])).toEqual({ width: 20, depth: 15 })
  })

  it('suggests the next free code per prefix', () => {
    expect(nextCode([{ code: 'M1' }, { code: 'm2' }, { code: 'B1' }], 'M')).toBe('M3')
    expect(nextCode([{ code: 'M1' }], 'P')).toBe('P1')
  })

  it('flags repeated codes, bad capacity and empty area names', () => {
    const problems = layoutProblems([area({ key: 'a1', name: ' ' })],
      [table({ key: 't1' }), table({ key: 't2' }), table({ key: 't3', code: 'M9', capacity: 0 })])
    expect(problems.map((p) => p.message)).toEqual(['El número M1 está repetido', 'M9: capacidad entre 1 y 50', 'Cada área necesita un nombre'])
  })
})
