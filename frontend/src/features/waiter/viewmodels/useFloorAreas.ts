import { useEffect, useState } from 'react'
import type { FloorArea } from '../../../domain/floor'
import { useAuth } from '../../auth/AuthContext'

/** Areas drawn by the admin; they change rarely, so they load once per visit. An error leaves the plan without areas. */
export function useFloorAreas(): FloorArea[] {
  const { api } = useAuth()
  const [areas, setAreas] = useState<FloorArea[]>([])
  useEffect(() => {
    let alive = true
    api.floorAreas()
      .then((rows) => alive && setAreas(rows.map((a) => ({ id: a.id, key: a.id, name: a.name, kind: a.kind, x: a.x, y: a.y,
        width: a.width, depth: a.depth }))))
      .catch(() => undefined)
    return () => { alive = false }
  }, [api])
  return areas
}
