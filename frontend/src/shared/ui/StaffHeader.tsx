import type { ReactNode } from 'react'
import type { StaffRole } from '../../domain/staffTypes'
import { useAuth } from '../../features/auth/AuthContext'

const ROLE_CHIP: Record<StaffRole, string> = { kitchen: 'COCINA', waiter: 'MESERO', admin: 'ADMIN' }

/** White staff header: brand, black role chip, optional section nav and the sign-out button. */
export function StaffHeader({ area, children }: { area: StaffRole; children?: ReactNode }) {
  const { staff, signOut } = useAuth()
  return (
    <header className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center gap-4 border-b border-linea bg-white px-6 py-2">
      <span className="text-2xl font-extrabold tracking-tight text-carbon">foody<span className="text-madera">.</span></span>
      <span className="rounded-md bg-carbon px-2 py-1 text-xs font-bold tracking-widest text-white">{ROLE_CHIP[area]}</span>
      <nav className="flex flex-1 flex-wrap items-center gap-1">{children}</nav>
      {staff && <span className="text-sm text-musgo">{staff.full_name}</span>}
      <button type="button" onClick={() => void signOut()}
        className="min-h-11 rounded-xl px-3 text-sm font-semibold text-carbon hover:bg-arena">Salir</button>
    </header>
  )
}
