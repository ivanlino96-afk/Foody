import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AdminTable } from '../../../domain/staffTypes'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { useTablesAdminViewModel } from './useTablesAdminViewModel'

afterEach(() => vi.unstubAllGlobals())

const TABLES: AdminTable[] = [
  { id: 't1', code: 'M1', label: null, zone: 'Salón', capacity: 4, qr_token: 'tok1', status: 'occupied', sort_order: 1 },
  { id: 't2', code: 'M2', label: null, zone: 'Salón', capacity: 2, qr_token: 'tok2', status: 'free', sort_order: 2 },
]

function setup(extra: Parameters<typeof stubFetch>[0] = {}) {
  const fetchMock = stubFetch({
    'GET /me': meAs('admin'),
    'GET /admin/tables': { status: 200, body: TABLES },
    'DELETE /admin/tables/t1': { status: 409, body: { code: 'invalid_transition', message: 'Solo se puede borrar una mesa libre' } },
    'POST /admin/tables/t2/regenerate-qr': { status: 200, body: { qr_token: 'new' } },
    'POST /admin/tables': { status: 201, body: TABLES[1] },
    ...extra,
  })
  const hook = renderHook(() => useTablesAdminViewModel(), { wrapper: staffWrapper() })
  const calls = (method: string, end: string) => fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith(end) && i?.method === method)
  return { ...hook, fetchMock, calls }
}

describe('useTablesAdminViewModel', () => {
  it('cannot delete a busy table', async () => {
    const { result, calls } = setup()
    await waitFor(() => expect(result.current.tables).toHaveLength(2))
    act(() => result.current.askDelete(result.current.tables[0]))
    await act(() => result.current.confirmDelete())
    expect(calls('DELETE', '/admin/tables/t1')).toHaveLength(1)
    expect(result.current.notice).toBe('Solo se puede borrar una mesa libre')
    expect(result.current.tables).toHaveLength(2)
  })

  it('regenerate asks first', async () => {
    const { result, calls } = setup()
    await waitFor(() => expect(result.current.tables).toHaveLength(2))
    act(() => result.current.askRegenerate(result.current.tables[1]))
    expect(result.current.pendingRegenerate?.code).toBe('M2')
    expect(calls('POST', '/admin/tables/t2/regenerate-qr')).toHaveLength(0)
    await act(() => result.current.confirmRegenerate())
    expect(calls('POST', '/admin/tables/t2/regenerate-qr')).toHaveLength(1)
    expect(result.current.pendingRegenerate).toBeNull()
  })

  it('validates the table form and sends a clean body', async () => {
    const { result, calls } = setup()
    await waitFor(() => expect(result.current.tables).toHaveLength(2))
    act(() => result.current.setForm({ code: 'M#9', label: '', zone: '', capacity: '99' }))
    await act(async () => { await result.current.saveForm() })
    expect(result.current.formErrors).toEqual({ code: 'Usa letras, números, espacio, - o _ (hasta 20)', capacity: 'Entre 1 y 50 personas' })
    expect(calls('POST', '/admin/tables')).toHaveLength(0)

    act(() => result.current.setForm({ code: ' T9 ', label: '', zone: 'Terraza', capacity: '' }))
    await act(async () => { await result.current.saveForm() })
    expect(JSON.parse(String(calls('POST', '/admin/tables')[0][1]?.body))).toEqual({ code: 'T9', label: null, zone: 'Terraza', capacity: null })
  })

  it('builds the diner link for printing', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.tables).toHaveLength(2))
    expect(result.current.dinerUrl(result.current.tables[1])).toBe(`${window.location.origin}/mesa/tok2`)
  })

  it('keeps earlier QR images alive until the screen closes', async () => {
    const revoke = vi.fn()
    let n = 0
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => `blob:qr${++n}`), revokeObjectURL: revoke }))
    const { result, unmount } = setup({
      'GET /admin/tables/t1/qr.png': { status: 200, body: 'png' },
      'GET /admin/tables/t2/qr.png': { status: 200, body: 'png' },
    })
    await waitFor(() => expect(result.current.tables).toHaveLength(2))
    await act(async () => { await result.current.loadQr(result.current.tables[0]) })
    await act(async () => { await result.current.loadQr(result.current.tables[1]) })
    expect(result.current.qrFor(result.current.tables[0])).toBe('blob:qr1')
    expect(revoke).not.toHaveBeenCalled()
    unmount()
    expect(revoke.mock.calls.map((c) => c[0]).sort()).toEqual(['blob:qr1', 'blob:qr2'])
  })
})
