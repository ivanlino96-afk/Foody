import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { StaffRole } from '../../../domain/staffTypes'
import { useAuth } from '../AuthContext'
import { canOpen, homeFor } from '../RequireRole'

export function useLoginViewModel() {
  const { status, staff, notice, signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only a sign-in made on this page leaves it on its own; an older session is offered, not followed,
  // so someone on a shared device can switch accounts.
  const [submitted, setSubmitted] = useState(false)

  const goHome = useCallback((role: StaffRole) => {
    const next = params.get('next') ?? ''
    navigate(canOpen(role, next) ? next : homeFor(role), { replace: true })
  }, [params, navigate])

  useEffect(() => {
    if (submitted && status === 'signed_in' && staff) goHome(staff.role)
  }, [submitted, status, staff, goHome])

  const canSubmit = email.trim() !== '' && password !== '' && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const message = await signIn(email, password)
    setSubmitting(false)
    setError(message)
    if (!message) setSubmitted(true)
  }

  const current = !submitted && !submitting && status === 'signed_in' && staff ? staff : null

  return { current, proceed: () => current && goHome(current.role), switchAccount: () => void signOut(), email, setEmail, password, setPassword, canSubmit, submitting, error, notice, loading: status === 'loading', submit }
}
