import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StaffRow } from '../../../domain/staffTypes'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { useStaffViewModel } from './useStaffViewModel'

afterEach(() => vi.unstubAllGlobals())

const STAFF: StaffRow[] = [
  { id: '1', full_name: 'Admin Demo', role: 'admin', is_active: true, created_at: '2026-10-22T00:00:00Z', email: 'admin@foody.local' },
]

function setup() {
  const fetchMock = stubFetch({
    'GET /me': meAs('admin'),
    'GET /admin/staff': { status: 200, body: STAFF },
    'POST /admin/staff': { status: 201, body: STAFF[0] },
    'PATCH /admin/staff/1': { status: 409, body: { code: 'invalid_transition', message: 'No puedes desactivarte a ti mismo' } },
  })
  const hook = renderHook(() => useStaffViewModel(), { wrapper: staffWrapper() })
  const posts = () => fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('/admin/staff') && i?.method === 'POST')
  return { ...hook, posts }
}

describe('useStaffViewModel', () => {
  it('staff form validates password length', async () => {
    const { result, posts } = setup()
    await waitFor(() => expect(result.current.staff).toHaveLength(1))
    act(() => result.current.setForm({ email: 'nuevo@foody', password: 'corta', fullName: '', role: 'waiter' }))
    await act(async () => { await result.current.create() })
    expect(result.current.errors).toEqual({ email: 'Escribe un correo válido', password: 'La contraseña necesita al menos 8 caracteres',
      fullName: 'Escribe el nombre' })
    expect(posts()).toHaveLength(0)

    act(() => result.current.setForm({ email: ' Ana@Foody.local ', password: 'segura123', fullName: 'Ana', role: 'kitchen' }))
    await act(async () => { await result.current.create() })
    expect(JSON.parse(String(posts()[0][1]?.body))).toEqual({ email: 'ana@foody.local', password: 'segura123', full_name: 'Ana', role: 'kitchen' })
    expect(result.current.form.password).toBe('')
  })

  it('shows the backend refusal when deactivating yourself', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.staff).toHaveLength(1))
    await act(async () => { await result.current.update('1', { is_active: false }) })
    expect(result.current.notice).toBe('No puedes desactivarte a ti mismo')
  })
})
