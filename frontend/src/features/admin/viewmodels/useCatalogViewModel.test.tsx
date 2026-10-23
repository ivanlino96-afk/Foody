import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Ingredient } from '../../../domain/staffTypes'
import { INGREDIENTS } from '../../../test/catalogFixtures'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { useCatalogViewModel } from './useCatalogViewModel'

afterEach(() => vi.unstubAllGlobals())

function setup(deleteStatus = 204) {
  const fetchMock = stubFetch({
    'GET /me': meAs('admin'),
    'GET /admin/ingredients': { status: 200, body: INGREDIENTS },
    'POST /admin/ingredients': { status: 201, body: { id: 'i3', name: 'Pepino', is_available: true } },
    'DELETE /admin/ingredients/i2': deleteStatus === 204 ? { status: 204 }
      : { status: deleteStatus, body: { code: 'conflict', message: 'Kale se usa en 2 platillos' } },
  })
  const hook = renderHook(() => useCatalogViewModel<Ingredient>('ingredients'), { wrapper: staffWrapper() })
  const deletes = () => fetchMock.mock.calls.filter(([, i]) => i?.method === 'DELETE').length
  return { ...hook, fetchMock, deletes }
}

describe('useCatalogViewModel', () => {
  it('delete asks for confirmation', async () => {
    const { result, deletes } = setup()
    await waitFor(() => expect(result.current.items).toHaveLength(2))

    act(() => result.current.askDelete(INGREDIENTS[1]))
    expect(result.current.pendingDelete?.name).toBe('Kale')
    expect(deletes()).toBe(0)

    act(() => result.current.cancelDelete())
    expect(result.current.pendingDelete).toBeNull()
    expect(deletes()).toBe(0)

    act(() => result.current.askDelete(INGREDIENTS[1]))
    await act(() => result.current.confirmDelete())
    expect(deletes()).toBe(1)
    expect(result.current.pendingDelete).toBeNull()
  })

  it('shows why a delete was refused', async () => {
    const { result } = setup(409)
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => result.current.askDelete(INGREDIENTS[1]))
    await act(() => result.current.confirmDelete())
    expect(result.current.notice).toBe('Kale se usa en 2 platillos')
  })

  it('creates and reloads', async () => {
    const { result, fetchMock } = setup()
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    let ok = false
    await act(async () => { ok = await result.current.create({ name: 'Pepino' }) })
    expect(ok).toBe(true)
    expect(fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('/admin/ingredients') && !i?.method).length).toBeGreaterThan(1)
  })
})
