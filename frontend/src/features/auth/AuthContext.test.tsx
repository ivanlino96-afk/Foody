import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { fakeAuthClient, meAs, stubFetch } from '../../test/staffFakes'
import { AuthProvider, useAuth } from './AuthContext'
import { RequireRole, homeFor } from './RequireRole'

afterEach(() => vi.unstubAllGlobals())

function Probe() {
  const auth = useAuth()
  const loc = useLocation()
  return (
    <div>
      <p>status:{auth.status}</p>
      <p>name:{auth.staff?.full_name ?? '-'}</p>
      <p>path:{loc.pathname}{loc.search}</p>
      <p>notice:{auth.notice ?? '-'}</p>
      <button onClick={() => void auth.signIn('cocina@foody.local', 'foody1234')}>in</button>
      <button onClick={() => void auth.api.kitchenOrders().catch(() => undefined)}>load</button>
    </div>
  )
}

const AREAS = [['/cocina', 'kitchen'], ['/mesero', 'waiter'], ['/admin', 'admin']] as const

function renderAuth(client: ReturnType<typeof fakeAuthClient>, path = '/x', guarded = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider client={client}>
        <Routes>
          <Route path="/login" element={<Probe />} />
          {AREAS.map(([p, role]) => (
            <Route key={p} path={p} element={guarded ? <RequireRole roles={[role]}><Probe /></RequireRole> : <Probe />} />
          ))}
          <Route path="*" element={<Probe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AuthProvider', () => {
  it('signs in and loads the staff profile', async () => {
    const fetchMock = stubFetch({ 'GET /me': meAs('kitchen') })
    const client = fakeAuthClient()
    renderAuth(client)
    expect(await screen.findByText('status:signed_out')).toBeInTheDocument()

    await act(async () => screen.getByText('in').click())

    expect(await screen.findByText('status:signed_in')).toBeInTheDocument()
    expect(screen.getByText('name:Cocina Demo')).toBeInTheDocument()
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok-cocina@foody.local')
  })

  it('restores a stored session on load', async () => {
    stubFetch({ 'GET /me': meAs('waiter') })
    renderAuth(fakeAuthClient('stored'))
    expect(await screen.findByText('name:Mesero Demo')).toBeInTheDocument()
  })

  it('401 from the api signs out and redirects', async () => {
    stubFetch({ 'GET /me': meAs('kitchen'), 'GET /kitchen/orders': { status: 401, body: { code: 'unauthorized', message: 'x' } } })
    const client = fakeAuthClient('stored')
    renderAuth(client, '/cocina', true)
    expect(await screen.findByText('name:Cocina Demo')).toBeInTheDocument()

    await act(async () => screen.getByText('load').click())

    expect(await screen.findByText('path:/login?next=%2Fcocina')).toBeInTheDocument()
    expect(screen.getByText('notice:Tu sesión terminó; vuelve a entrar')).toBeInTheDocument()
    expect(client.signOut).toHaveBeenCalled()
  })

  it('a deactivated account (403 on /me) lands on login with a notice', async () => {
    stubFetch({ 'GET /me': { status: 403, body: { code: 'forbidden', message: 'x' } } })
    renderAuth(fakeAuthClient('stored'), '/mesero', true)
    expect(await screen.findByText('notice:Tu cuenta no tiene acceso; habla con el administrador')).toBeInTheDocument()
    expect(screen.getByText(/^path:\/login/)).toBeInTheDocument()
  })
})

describe('RequireRole', () => {
  it('redirects each role to its home', async () => {
    expect([homeFor('kitchen'), homeFor('waiter'), homeFor('admin')]).toEqual(['/cocina', '/mesero', '/admin'])

    stubFetch({ 'GET /me': meAs('kitchen') })
    renderAuth(fakeAuthClient('stored'), '/admin', true)
    expect(await screen.findByText('path:/cocina')).toBeInTheDocument()
  })

  it('lets the admin into every area', async () => {
    stubFetch({ 'GET /me': meAs('admin') })
    renderAuth(fakeAuthClient('stored'), '/mesero', true)
    expect(await screen.findByText('path:/mesero')).toBeInTheDocument()
    expect(screen.getByText('name:Admin Demo')).toBeInTheDocument()
  })

  it('sends visitors without a session to login with next', async () => {
    stubFetch({})
    renderAuth(fakeAuthClient(), '/cocina', true)
    expect(await screen.findByText('path:/login?next=%2Fcocina')).toBeInTheDocument()
  })
})
