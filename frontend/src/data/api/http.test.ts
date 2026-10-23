import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from './http'

afterEach(() => vi.unstubAllGlobals())

function respond(status: number, body?: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })))
}

describe('request', () => {
  it('returns parsed JSON under /api/v1', async () => {
    respond(200, { ok: 1 })
    await expect(request('/x')).resolves.toEqual({ ok: 1 })
    expect(fetch).toHaveBeenCalledWith('/api/v1/x', expect.objectContaining({ headers: expect.any(Object) }))
  })

  it('turns an error body into ApiError', async () => {
    respond(409, { code: 'item_unavailable', message: 'Agotado', details: { lines: [{ menu_item_id: 'a' }] } })
    const err = await request('/x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect([err.status, err.code, err.message, err.details]).toEqual([409, 'item_unavailable', 'Agotado',
      { lines: [{ menu_item_id: 'a' }] }])
  })

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    const err = await request('/x').catch((e) => e)
    expect([err.code, err.status]).toEqual(['network', 0])
  })

  it('uses http_<status> without a JSON body and undefined on 204', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502 })))
    expect((await request('/x').catch((e) => e)).code).toBe('http_502')
    respond(204)
    await expect(request('/x')).resolves.toBeUndefined()
  })
})
