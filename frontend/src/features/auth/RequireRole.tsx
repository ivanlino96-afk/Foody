import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { StaffRole } from '../../domain/staffTypes'
import { useAuth } from './AuthContext'

const HOME: Record<StaffRole, string> = { kitchen: '/cocina', waiter: '/mesero', admin: '/admin' }

export function homeFor(role: StaffRole): string {
  return HOME[role]
}

/** Whether `role` may open `path`; the admin may open every staff area. */
export function canOpen(role: StaffRole, path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false
  if (role === 'admin') return ['/cocina', '/mesero', '/admin'].some((p) => path === p || path.startsWith(`${p}/`))
  const home = HOME[role]
  return path === home || path.startsWith(`${home}/`)
}

export function StaffLoading() {
  return <main className="flex min-h-dvh items-center justify-center bg-avena text-musgo">Cargando…</main>
}

export function RequireRole({ roles, children }: { roles: StaffRole[]; children: ReactNode }) {
  const { status, staff } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <StaffLoading />
  if (status === 'signed_out' || !staff) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (staff.role !== 'admin' && !roles.includes(staff.role)) return <Navigate to={homeFor(staff.role)} replace />
  return <>{children}</>
}
