import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import type { AdminTable } from '../../../domain/staffTypes'
import { useAuth } from '../../auth/AuthContext'

export interface TableForm {
  id?: string
  code: string
  label: string
  zone: string
  capacity: string
}

const EMPTY: TableForm = { code: '', label: '', zone: '', capacity: '' }
const CODE = /^[A-Za-z0-9 _-]{1,20}$/

function validate(f: TableForm): { body?: Record<string, unknown>; errors: Partial<Record<keyof TableForm, string>> } {
  const errors: Partial<Record<keyof TableForm, string>> = {}
  const code = f.code.trim()
  const capacity = f.capacity.trim() === '' ? null : Number(f.capacity)
  if (!CODE.test(code)) errors.code = 'Usa letras, números, espacio, - o _ (hasta 20)'
  if (capacity !== null && !(Number.isInteger(capacity) && capacity >= 1 && capacity <= 50)) errors.capacity = 'Entre 1 y 50 personas'
  if (Object.keys(errors).length) return { errors }
  return { errors, body: { code, label: f.label.trim() || null, zone: f.zone.trim() || null, capacity } }
}

export function useTablesAdminViewModel() {
  const { api } = useAuth()
  const [tables, setTables] = useState<AdminTable[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState<TableForm>(EMPTY)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof TableForm, string>>>({})
  const [pendingDelete, setPendingDelete] = useState<AdminTable | null>(null)
  const [pendingRegenerate, setPendingRegenerate] = useState<AdminTable | null>(null)
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    try {
      setTables(await api.adminTables())
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudieron cargar las mesas')
    }
  }, [api])
  useEffect(() => {
    void reload()
  }, [reload])

  // Object URLs are revoked when the screen unmounts.
  useEffect(() => () => Object.values(qrUrls).forEach((u) => URL.revokeObjectURL(u)), [qrUrls])

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setNotice(null)
    try {
      await fn()
      return true
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudo completar la acción')
      return false
    } finally {
      await reload()
    }
  }, [reload])

  /** Fetches the QR PNG with the admin token (an <img src> could not send it) and keeps an object URL per table+token. */
  const loadQr = useCallback(async (t: AdminTable) => {
    const key = `${t.id}:${t.qr_token}`
    if (qrUrls[key]) return qrUrls[key]
    const url = URL.createObjectURL(await api.tableQr(t.id))
    setQrUrls((m) => ({ ...m, [key]: url }))
    return url
  }, [api, qrUrls])

  return {
    tables: tables ?? [],
    loading: tables === null,
    notice,
    dismissNotice: () => setNotice(null),
    form,
    setForm,
    formErrors,
    editTable: (t: AdminTable) => {
      setFormErrors({})
      setForm({ id: t.id, code: t.code, label: t.label ?? '', zone: t.zone ?? '', capacity: t.capacity ? String(t.capacity) : '' })
    },
    resetForm: () => { setForm(EMPTY); setFormErrors({}) },
    saveForm: async () => {
      const { body, errors } = validate(form)
      setFormErrors(errors)
      if (!body) return false
      const ok = await run(() => (form.id ? api.updateTable(form.id, body) : api.createTable(body)))
      if (ok) setForm(EMPTY)
      return ok
    },
    pendingDelete,
    askDelete: setPendingDelete,
    cancelDelete: () => setPendingDelete(null),
    confirmDelete: async () => {
      const t = pendingDelete
      setPendingDelete(null)
      if (t) await run(() => api.deleteTable(t.id))
    },
    pendingRegenerate,
    askRegenerate: setPendingRegenerate,
    cancelRegenerate: () => setPendingRegenerate(null),
    confirmRegenerate: async () => {
      const t = pendingRegenerate
      setPendingRegenerate(null)
      if (t) await run(() => api.regenerateQr(t.id))
    },
    qrFor: (t: AdminTable) => qrUrls[`${t.id}:${t.qr_token}`] ?? null,
    loadQr,
    dinerUrl: (t: AdminTable) => `${window.location.origin}/mesa/${t.qr_token}`,
  }
}
