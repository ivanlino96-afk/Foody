import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { tableRow } from '../../../test/waiterFixtures'
import { useAuth } from '../../auth/AuthContext'
import { usePaymentViewModel } from './usePaymentViewModel'

afterEach(() => vi.unstubAllGlobals())

const TABLE = tableRow({ id: 't8', code: 'T2', status: 'bill_requested', session_id: 's8', balance_cents: 64000 })

function setup(payment: { status: number; body: unknown } = { status: 201, body: { payment_id: 'p', balance_cents: 0, table_status: 'closed' } }) {
  const fetchMock = stubFetch({ 'GET /me': meAs('waiter'), 'POST /waiter/sessions/s8/payments': payment })
  const onDone = vi.fn()
  const hook = renderHook(() => ({ vm: usePaymentViewModel(TABLE, onDone), auth: useAuth() }), { wrapper: staffWrapper() })
  return { ...hook, fetchMock, onDone }
}

describe('usePaymentViewModel', () => {
  it('starts with the balance and offers tip presets', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.auth.status).toBe('signed_in'))
    expect(result.current.vm.amountText).toBe('640.00')
    expect(result.current.vm.tipPresets.map((t) => [t.label, t.cents])).toEqual([['10%', 6400], ['15%', 9600], ['20%', 12800]])
  })

  it('payment over balance shows the error', async () => {
    const { result, fetchMock } = setup()
    await waitFor(() => expect(result.current.auth.status).toBe('signed_in'))
    act(() => result.current.vm.setAmountText('$700'))
    await act(() => result.current.vm.submit())
    expect(result.current.vm.error).toBe('El monto es mayor al saldo ($640.00)')
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/payments'))).toBe(false)

    act(() => result.current.vm.setAmountText('6,40'))
    await act(() => result.current.vm.submit())
    expect(result.current.vm.error).toBe('Escribe un monto válido, por ejemplo 640.50')
  })

  it('full payment closes the dialog and refreshes', async () => {
    const { result, fetchMock, onDone } = setup()
    await waitFor(() => expect(result.current.auth.status).toBe('signed_in'))
    act(() => result.current.vm.setMethod('card_terminal'))
    act(() => result.current.vm.applyTip(9600))
    await act(() => result.current.vm.submit())

    const pay = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/waiter/sessions/s8/payments'))
    expect(JSON.parse(String(pay?.[1]?.body))).toEqual({ method: 'card_terminal', amount_cents: 64000, tip_cents: 9600 })
    expect(onDone).toHaveBeenCalledWith({ payment_id: 'p', balance_cents: 0, table_status: 'closed' })
    expect(result.current.vm.error).toBeNull()
  })

  it('a conflicting payment keeps the dialog open with the backend message', async () => {
    const { result, onDone } = setup({ status: 409, body: { code: 'invalid_transition', message: 'Esta cuenta ya está cerrada' } })
    await waitFor(() => expect(result.current.auth.status).toBe('signed_in'))
    await act(() => result.current.vm.submit())
    expect(result.current.vm.error).toBe('Esta cuenta ya está cerrada')
    expect(onDone).not.toHaveBeenCalled()
  })
})
