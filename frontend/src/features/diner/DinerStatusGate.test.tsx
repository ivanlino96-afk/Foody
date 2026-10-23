import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../data/api/http'
import { fakeApi, notFound } from '../../test/fakeApi'
import { renderDiner } from '../../test/renderDiner'
import { DinerStatusGate } from './DinerStatusGate'

describe('DinerStatusGate', () => {
  it('shows the invalid QR screen on any diner route', async () => {
    renderDiner(<DinerStatusGate><p>carrito</p></DinerStatusGate>, fakeApi({ getTable: async () => { throw notFound() } }), '/mesa/tok/pedido')
    expect(await screen.findByText('Este QR no es válido')).toBeInTheDocument()
    expect(screen.queryByText('carrito')).toBeNull()
  })

  it('treats a malformed token (422) as an invalid QR', async () => {
    const api = fakeApi({ getTable: async () => { throw new ApiError(422, 'validation_error', 'Revisa') } })
    renderDiner(<DinerStatusGate><p>menú</p></DinerStatusGate>, api)
    expect(await screen.findByText('Este QR no es válido')).toBeInTheDocument()
  })
})
