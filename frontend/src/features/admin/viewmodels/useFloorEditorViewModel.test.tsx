import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { freeSpot, useFloorEditorViewModel } from './useFloorEditorViewModel'

afterEach(() => vi.unstubAllGlobals())

const LAYOUT = {
  areas: [{ id: 'a1', name: 'Salón', kind: 'salon', x: 0, y: 0, width: 10, depth: 8, sort_order: 0 }],
  tables: [
    { id: 't1', code: 'M1', label: null, zone: 'Salón', capacity: 4, qr_token: 'q1', status: 'free', sort_order: 1,
      kind: 'table', area_id: 'a1', pos_x: 2, pos_y: 2, rotation: 0 },
    { id: 't2', code: 'M2', label: null, zone: null, capacity: 2, qr_token: 'q2', status: 'free', sort_order: 2,
      kind: 'round', area_id: null, pos_x: null, pos_y: null, rotation: 0 },
  ],
}

function setup() {
  const fetchMock = stubFetch({
    'GET /me': meAs('admin'),
    'GET /admin/floor': { status: 200, body: LAYOUT },
    'PUT /admin/floor': { status: 200, body: LAYOUT },
  })
  const hook = renderHook(() => useFloorEditorViewModel(), { wrapper: staffWrapper() })
  return { ...hook, fetchMock }
}

describe('useFloorEditorViewModel', () => {
  it('loads the plan and lists unplaced tables', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.tables).toHaveLength(2))
    expect(result.current.summary.byArea).toEqual([expect.objectContaining({ tables: 1, seats: 4 })])
    expect(result.current.summary.unplaced.map((t) => t.code)).toEqual(['M2'])
    expect(result.current.dirty).toBe(false)
  })

  it('drags a table on the grid and undoes it in one step', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.tables).toHaveLength(2))
    act(() => result.current.moveTable('t1', 0.4, 0.1, false))
    act(() => result.current.moveTable('t1', 1.12, 2.6, false))
    act(() => result.current.moveTable('t1', 1.12, 2.6, true))
    expect(result.current.tables[0]).toMatchObject({ pos_x: 3, pos_y: 4.5 })
    expect(result.current.dirty).toBe(true)
    act(() => result.current.undo())
    expect(result.current.tables[0]).toMatchObject({ pos_x: 2, pos_y: 2 })
    expect(result.current.canUndo).toBe(false)
  })

  it('moving an area carries its tables', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.tables).toHaveLength(2))
    act(() => result.current.moveArea('a1', 5, 1, true))
    expect(result.current.areas[0]).toMatchObject({ x: 5, y: 1 })
    expect(result.current.tables[0]).toMatchObject({ pos_x: 7, pos_y: 3 })
  })

  it('adds a table and an area and saves the whole plan', async () => {
    const { result, fetchMock } = setup()
    await waitFor(() => expect(result.current.tables).toHaveLength(2))
    act(() => result.current.addArea('roof'))
    expect(result.current.selectedArea).toMatchObject({ name: 'Roof', x: 12.5 })
    act(() => result.current.addTable('bar'))
    expect(result.current.selectedTable).toMatchObject({ code: 'B1', capacity: 6, kind: 'bar' })
    act(() => result.current.removeSelected())
    act(() => result.current.select({ type: 'table', key: 't1' }))
    act(() => result.current.removeSelected())

    await act(async () => { await result.current.save() })

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    const body = JSON.parse(String(put?.[1]?.body))
    expect(body.areas.map((a: { name: string; id: string | null }) => [a.name, a.id])).toEqual([['Salón', 'a1'], ['Roof', null]])
    expect(body.tables.map((t: { code: string }) => t.code)).toEqual(['M2'])
    expect(body.deleted_table_ids).toEqual(['t1'])
    expect(result.current.savedNote).toBe('Plano guardado. El mesero ya lo ve.')
  })

  it('does not save a plan with repeated codes', async () => {
    const { result, fetchMock } = setup()
    await waitFor(() => expect(result.current.tables).toHaveLength(2))
    act(() => result.current.updateTable('t2', { code: 'M1' }))
    await act(async () => { await result.current.save() })
    expect(result.current.notice).toBe('El número M1 está repetido')
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it('finds a free spot away from other tables', () => {
    const t = { id: null, key: 'x', code: 'M1', label: null, capacity: 4, kind: 'table' as const, pos_x: 5, pos_y: 5, rotation: 0 as const }
    const spot = freeSpot([t], 5, 5)
    expect(Math.hypot(spot.x - 5, spot.y - 5)).toBeGreaterThanOrEqual(1.5)
  })
})
