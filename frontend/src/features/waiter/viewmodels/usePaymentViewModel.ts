import { useState } from 'react'
import { ApiError } from '../../../data/api/http'
import { formatMoney } from '../../../domain/money'
import { centsToInput, parseMoneyInput } from '../../../domain/moneyInput'
import type { PaymentMethod, PaymentResult, TableMapRow } from '../../../domain/staffTypes'
import { useAuth } from '../../auth/AuthContext'

const TIP_PCTS = [10, 15, 20]

/** `onRefused` runs when the backend rejects the payment (e.g. another waiter already charged) so the map refreshes. */
export function usePaymentViewModel(table: TableMapRow, onDone: (result: PaymentResult) => void, onRefused?: () => void) {
  const { api } = useAuth()
  const balance = table.balance_cents
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amountText, setAmountText] = useState(() => centsToInput(balance))
  const [tipText, setTipText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const tipPresets = TIP_PCTS.map((pct) => ({ label: `${pct}%`, cents: Math.round((balance * pct) / 100) }))

  async function submit() {
    const amount = parseMoneyInput(amountText)
    const tip = tipText.trim() === '' ? 0 : parseMoneyInput(tipText)
    if (amount === null || amount <= 0) return setError('Escribe un monto válido, por ejemplo 640.50')
    if (amount > balance) return setError(`El monto es mayor al saldo (${formatMoney(balance)})`)
    if (tip === null) return setError('Escribe una propina válida, por ejemplo 64')
    if (!table.session_id) return setError('Esta mesa no tiene una cuenta abierta')
    setError(null)
    setSubmitting(true)
    try {
      const result = await api.registerPayment(table.session_id, method, amount, tip)
      onDone(result)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el cobro')
      onRefused?.()
    } finally {
      setSubmitting(false)
    }
  }

  return {
    balanceCents: balance, method, setMethod, amountText, setAmountText, tipText, setTipText, tipPresets,
    applyTip: (cents: number) => setTipText(centsToInput(cents)), error, submitting, submit,
  }
}
