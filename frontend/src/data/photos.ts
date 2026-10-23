import { SUPABASE_URL } from './supabase'

export function photoUrl(path: string | null): string | null {
  if (!path) return null
  return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/menu-photos/${path}`
}
