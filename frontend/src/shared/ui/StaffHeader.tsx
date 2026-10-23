import type { ReactNode } from 'react'
import type { StaffRole } from '../../domain/staffTypes'
import { useAuth } from '../../features/auth/AuthContext'

const ROLE_CHIP: Record<StaffRole, string> = { kitchen: 'COCINA', waiter: 'MESERO', admin: 'ADMIN' }

/** Green staff header: brand, black role chip, optional section nav and the sign-out button. */
export function StaffHeader({ area, children }: { area: StaffRole; children?: ReactNode }) {
  const { staff, signOut } = useAuth()
  return (
    <header className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center gap-4 bg-bosque px-6 py-2 text-white">
      <span className="text-2xl font-extrabold tracking-tight text-white">foody<span className="text-trigo">.</span></span>
      <span className="rounded-md bg-white px-2 py-1 text-xs font-bold tracking-widest text-bosque">{ROLE_CHIP[area]}</span>
      <nav className="flex flex-1 flex-wrap items-center gap-1">{children}</nav>
      {staff && <span className="text-sm text-niebla">{staff.full_name}</span>}
      <button type="button" onClick={() => void signOut()}
        className="min-h-11 rounded-xl px-3 text-sm font-semibold text-white hover:bg-white/10">Salir</button>
    </header>
  )
}
