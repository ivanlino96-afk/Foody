import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../../data/api/http'
import type { CatalogPath } from '../../../data/api/staffApi'
import { useAuth } from '../../auth/AuthContext'

const messageOf = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback)

/** List + create/update/delete for one admin catalog; delete goes through askDelete → confirmDelete. */
export function useCatalogViewModel<T extends { id: string; name: string }>(kind: CatalogPath) {
  const { api } = useAuth()
  const [items, setItems] = useState<T[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<T | null>(null)

  const reload = useCallback(async () => {
    try {
      setItems(await api.listCatalog<T>(kind))
    } catch (err) {
      setNotice(messageOf(err, 'No se pudo cargar la lista'))
    }
  }, [api, kind])

  useEffect(() => {
    void reload()
  }, [reload])

  const mutate = useCallback(async (fn: () => Promise<unknown>, fallback: string) => {
    setNotice(null)
    try {
      await fn()
      return true
    } catch (err) {
      setNotice(messageOf(err, fallback))
      return false
    } finally {
      await reload()
    }
  }, [reload])

  return {
    items: items ?? [],
    loading: items === null,
    notice,
    dismissNotice: () => setNotice(null),
    reload,
    create: (body: unknown) => mutate(() => api.createCatalog(kind, body), 'No se pudo guardar'),
    update: (id: string, body: unknown) => mutate(() => api.updateCatalog(kind, id, body), 'No se pudo guardar'),
    pendingDelete,
    askDelete: (item: T) => setPendingDelete(item),
    cancelDelete: () => setPendingDelete(null),
    confirmDelete: async () => {
      if (!pendingDelete) return
      const target = pendingDelete
      setPendingDelete(null)
      await mutate(() => api.deleteCatalog(kind, target.id), `No se pudo borrar ${target.name}`)
    },
  }
}
