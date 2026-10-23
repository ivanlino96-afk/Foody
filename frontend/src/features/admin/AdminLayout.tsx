import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'

const NAV = [
  ['/admin', 'Dashboard'],
  ['/admin/ordenes', 'Órdenes'],
  ['/admin/menu', 'Menú'],
  ['/admin/ingredientes', 'Ingredientes y extras'],
  ['/admin/disponibilidad', 'Disponibilidad'],
  ['/admin/plano', 'Plano del local'],
  ['/admin/mesas', 'Mesas y QR'],
  ['/admin/personal', 'Personal'],
  ['/admin/configuracion', 'Configuración'],
] as const

/** B-Admin shell: green sidebar (a scrolling top bar under 1024 px) and the section on the right. */
export function AdminLayout() {
  const { staff, signOut } = useAuth()
  return (
    <div className="flex min-h-dvh flex-col bg-white text-carbon lg:flex-row">
      <nav aria-label="Administración"
        className="flex flex-none gap-0.5 overflow-x-auto bg-bosque px-3.5 py-3 text-white lg:w-[232px] lg:flex-col lg:overflow-visible lg:py-[22px]">
        <span className="px-3 pr-6 text-2xl font-extrabold tracking-tight lg:pb-[22px]">foody<span className="text-trigo">.</span></span>
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/admin'}
            className={({ isActive }) => `flex min-h-11 flex-none items-center rounded-[10px] px-3 text-sm whitespace-nowrap no-underline ${
              isActive ? 'bg-white font-bold text-bosque' : 'font-medium text-niebla hover:bg-white/10'}`}>
            {label}
          </NavLink>
        ))}
        <div className="flex flex-none items-center gap-2 px-3 lg:mt-auto lg:flex-col lg:items-start lg:pt-3">
          <span className="text-[13px] whitespace-nowrap text-niebla">{staff?.full_name} · Admin</span>
          <button type="button" onClick={() => void signOut()}
            className="min-h-11 rounded-lg px-2 text-sm font-semibold text-white hover:bg-white/10">Salir</button>
        </div>
      </nav>
      <main className="flex min-w-0 flex-1 flex-col gap-[18px] px-4 py-6 md:px-[30px]">
        <Outlet />
      </main>
    </div>
  )
}

export function AdminTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5">
      <h1 className="m-0 text-[26px] font-extrabold tracking-tight">{title}</h1>
      {children}
    </div>
  )
}

export const CARD = 'rounded-[14px] border border-linea bg-white p-[18px]'
