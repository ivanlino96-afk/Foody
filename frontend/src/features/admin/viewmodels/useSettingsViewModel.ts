import { useEffect, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import { useAuth } from '../../auth/AuthContext'

interface SettingsForm {
  name: string
  autoRelease: string
  tips: string
}

const TIPS_ERROR = 'Escribe de 1 a 5 porcentajes enteros entre 1 y 100'

function parseTips(text: string): number[] | null {
  const parts = text.split(',').map((p) => p.trim().replace(/%$/, '')).filter(Boolean)
  if (parts.length < 1 || parts.length > 5) return null
  const values = parts.map(Number)
  return values.every((v, i) => /^\d+$/.test(parts[i]) && v >= 1 && v <= 100) ? values : null
}

export function useSettingsViewModel() {
  const { api } = useAuth()
  const [form, setForm] = useState<SettingsForm | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof SettingsForm, string>>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.settings().then(
      (s) => setForm({ name: s.name, autoRelease: String(s.auto_release_minutes), tips: s.tip_options.join(', ') }),
      (err) => setNotice(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración'),
    )
  }, [api])

  async function save() {
    if (!form) return
    const found: typeof errors = {}
    const minutes = Number(form.autoRelease)
    const tips = parseTips(form.tips)
    if (!form.name.trim()) found.name = 'Escribe el nombre del restaurante'
    if (!/^\d+$/.test(form.autoRelease.trim()) || minutes > 240) found.autoRelease = 'Entre 0 y 240 minutos'
    if (!tips) found.tips = TIPS_ERROR
    setErrors(found)
    setSaved(false)
    if (Object.keys(found).length || !tips) return
    setSaving(true)
    setNotice(null)
    try {
      const s = await api.saveSettings({ name: form.name.trim(), auto_release_minutes: minutes, tip_options: tips })
      setForm({ name: s.name, autoRelease: String(s.auto_release_minutes), tips: s.tip_options.join(', ') })
      setSaved(true)
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return {
    loading: form === null,
    form: form ?? { name: '', autoRelease: '', tips: '' },
    set: (key: keyof SettingsForm, value: string) => { setSaved(false); setForm((f) => (f ? { ...f, [key]: value } : f)) },
    errors, notice, saved, saving, save,
  }
}
