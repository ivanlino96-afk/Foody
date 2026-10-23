import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeApi, notFound } from '../../../test/fakeApi'
import { renderDiner } from '../../../test/renderDiner'
import { DinerStatusGate } from '../DinerStatusGate'
import { MenuView } from './MenuView'

describe('MenuView', () => {
  it('marks sold-out dishes and hides their add button', async () => {
    renderDiner(<MenuView />, fakeApi())
    const sopa = (await screen.findByText('Sopa de tortilla')).closest('article')!
    expect(within(sopa).getByText('No disponible')).toBeInTheDocument()
    expect(within(sopa).queryByRole('button', { name: /agregar/i })).toBeNull()
    const tacos = screen.getByText('Tacos al pastor').closest('article')!
    expect(within(tacos).getByRole('link', { name: /agregar tacos al pastor/i })).toBeInTheDocument()
  })

  it('shows the cart footer with count and total', async () => {
    sessionStorage.setItem('foody.cart.tok', JSON.stringify([
      { key: 'k', menuItemId: 'tacos', quantity: 3, removedIngredientIds: [], extras: [], note: '' },
    ]))
    renderDiner(<MenuView />, fakeApi())
    const footer = await screen.findByRole('link', { name: /ver pedido/i })
    expect(footer).toHaveTextContent('3')
    expect(footer).toHaveTextContent('$285.00')
  })

  it('shows invalid qr screen on 404', async () => {
    const api = fakeApi({ getTable: async () => { throw notFound() } })
    renderDiner(<DinerStatusGate><MenuView /></DinerStatusGate>, api)
    expect(await screen.findByText('Este QR no es válido')).toBeInTheDocument()
  })

  it('tells the diner to ask for the table to be opened', async () => {
    renderDiner(<MenuView />, fakeApi({ getTable: async () => ({ code: 'M1', label: null, status: 'free', can_order: false }) }))
    expect(await screen.findByText(/pide al mesero que abra tu mesa/i)).toBeInTheDocument()
  })
})
