const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'http://127.0.0.1:54321'

export function photoUrl(path: string | null): string | null {
  if (!path) return null
  return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/menu-photos/${path}`
}
