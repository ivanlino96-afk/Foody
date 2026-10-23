import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AvailabilityBoard } from '../../../domain/staffTypes'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { useAvailabilityViewModel } from './useAvailabilityViewModel'

afterEach(() => vi.unstubAllGlobals())

const BOARD: AvailabilityBoard = {
  items: [{ id: 'd1', name: 'Guacamole con totopos', is_available: true, used_in: 0 }],
  ingredients: [
    { id: 'i1', name: 'Aguacate', is_available: false, used_in: 3 },
    { id: 'i2', name: 'Cebolla', is_available: true, used_in: 6 },
  ],
  extras: [{ id: 'e1', name: 'Queso extra', is_available: true, used_in: 4 }],
}

function setup(patchStatus = 200) {
  const fetchMock = stubFetch({
    'GET /me': meAs('kitchen'),
    'GET /availability': { status: 200, body: BOARD },
    'PATCH /availability/ingredient/i2': { status: patchStatus, body: patchStatus === 200 ? {} : { code: 'error', message: 'No se pudo guardar' } },
  })
  const hook = renderHook(() => useAvailabilityViewModel(), { wrapper: staffWrapper() })
  return { ...hook, fetchMock }
}

describe('useAvailabilityViewModel', () => {
  it('lists the tab rows, filters by search and counts what is off', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    expect(result.current.offCount).toBe(1)
    expect(result.current.tabs.map((t) => [t.label, t.count])).toEqual([['Ingredientes', 2], ['Platillos', 1], ['Extras', 1]])
    expect(result.current.rows[1]).toMatchObject({ name: 'Cebolla', isAvailable: true, impact: 'En 6 platillos' })

    act(() => result.current.setQuery('cebólla'))
    expect(result.current.rows.map((r) => r.name)).toEqual(['Cebolla'])
  })

  it('toggle is optimistic and reverts on error', async () => {
    let release!: () => void
    const { result } = setup(500)
    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve(new Response(JSON.stringify({ code: 'error', message: 'No se pudo guardar' }), { status: 500 }))
    }))

    let done!: Promise<void>
    act(() => { done = result.current.toggle(result.current.rows[1]) })
    expect(result.current.rows[1].isAvailable).toBe(false)
    expect(result.current.offCount).toBe(2)

    await act(async () => { release(); await done })
    expect(result.current.rows[1].isAvailable).toBe(true)
    expect(result.current.notice).toBe('No se pudo guardar')
  })

  it('sends the new value to the api', async () => {
    const { result, fetchMock } = setup()
    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    await act(() => result.current.toggle(result.current.rows[1]))
    const call = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/availability/ingredient/i2') && i?.method === 'PATCH')
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ is_available: false })
    expect(result.current.rows[1].isAvailable).toBe(false)
  })
})
