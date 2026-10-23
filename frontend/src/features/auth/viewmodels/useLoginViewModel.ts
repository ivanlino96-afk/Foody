import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../AuthContext'
import { canOpen, homeFor } from '../RequireRole'

export function useLoginViewModel() {
  const { status, staff, notice, signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'signed_in' || !staff) return
    const next = params.get('next') ?? ''
    navigate(canOpen(staff.role, next) ? next : homeFor(staff.role), { replace: true })
  }, [status, staff, params, navigate])

  const canSubmit = email.trim() !== '' && password !== '' && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const message = await signIn(email, password)
    setSubmitting(false)
    setError(message)
  }

  return { email, setEmail, password, setPassword, canSubmit, submitting, error, notice, loading: status === 'loading', submit }
}
