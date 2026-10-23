import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import type { StaffRole, StaffRow } from '../../../domain/staffTypes'
import { useAuth } from '../../auth/AuthContext'

export interface StaffForm {
  email: string
  password: string
  fullName: string
  role: StaffRole
}

export const ROLE_LABEL: Record<StaffRole, string> = { admin: 'Admin', kitchen: 'Cocina', waiter: 'Mesero' }
const EMPTY: StaffForm = { email: '', password: '', fullName: '', role: 'waiter' }
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function useStaffViewModel() {
  const { api } = useAuth()
  const [staff, setStaff] = useState<StaffRow[] | null>(null)
  const [form, setForm] = useState<StaffForm>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof StaffForm, string>>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    try {
      setStaff(await api.staff())
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudo cargar el personal')
    }
  }, [api])
  useEffect(() => {
    void reload()
  }, [reload])

  async function create() {
    const email = form.email.trim().toLowerCase()
    const found: typeof errors = {}
    if (!EMAIL.test(email)) found.email = 'Escribe un correo válido'
    if (form.password.length < 8) found.password = 'La contraseña necesita al menos 8 caracteres'
    else if (form.password.length > 72) found.password = 'La contraseña admite hasta 72 caracteres'
    if (!form.fullName.trim()) found.fullName = 'Escribe el nombre'
    setErrors(found)
    if (Object.keys(found).length) return false
    setSaving(true)
    setNotice(null)
    try {
      await api.createStaff({ email, password: form.password, full_name: form.fullName.trim(), role: form.role })
      setForm(EMPTY)
      return true
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta')
      return false
    } finally {
      setSaving(false)
      await reload()
    }
  }

  async function update(id: string, patch: Partial<Pick<StaffRow, 'full_name' | 'role' | 'is_active'>>) {
    setNotice(null)
    try {
      await api.updateStaff(id, patch)
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudo guardar')
    } finally {
      await reload()
    }
  }

  return { staff: staff ?? [], loading: staff === null, form, setForm, errors, saving, notice,
    dismissNotice: () => setNotice(null), create, update }
}
