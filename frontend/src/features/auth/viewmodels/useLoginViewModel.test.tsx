import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { fakeAuthClient, meAs, stubFetch } from '../../../test/staffFakes'
import { AuthProvider } from '../AuthContext'
import { LoginView } from '../views/LoginView'

afterEach(() => vi.unstubAllGlobals())

function Where() {
  const loc = useLocation()
  return <p>at:{loc.pathname}</p>
}

function renderLogin(client: ReturnType<typeof fakeAuthClient>, path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider client={client}>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function fill(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Correo'), email)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await act(async () => user.click(screen.getByRole('button', { name: 'Entrar' })))
}

describe('LoginView', () => {
  it('wrong password shows the message', async () => {
    stubFetch({})
    renderLogin(fakeAuthClient(null, 'Invalid login credentials'))
    await fill('cocina@foody.local', 'mala')
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos')
  })

  it('disables the button until both fields are filled', async () => {
    stubFetch({})
    renderLogin(fakeAuthClient())
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  it('goes to the role home after signing in', async () => {
    stubFetch({ 'GET /me': meAs('waiter') })
    renderLogin(fakeAuthClient())
    await fill('mesero@foody.local', 'foody1234')
    expect(await screen.findByText('at:/mesero')).toBeInTheDocument()
  })

  it('honours next when the role may open it', async () => {
    stubFetch({ 'GET /me': meAs('admin') })
    renderLogin(fakeAuthClient(), '/login?next=%2Fcocina%2Fdisponibilidad')
    await fill('admin@foody.local', 'foody1234')
    expect(await screen.findByText('at:/cocina/disponibilidad')).toBeInTheDocument()
  })
})
