import type { ComponentType, SVGProps } from 'react'
import { NavLink, Outlet } from 'react-router'
import {
  GridIcon, LeafIcon, LogoutIcon, MapIcon, PulseIcon, QrIcon, ReceiptIcon, SlidersIcon, ToggleIcon, UsersIcon, UtensilsIcon,
} from '../../shared/ui/icons'
import { useAuth } from '../auth/AuthContext'

type NavIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

const NAV: { title: string; items: [string, string, NavIcon][] }[] = [
  { title: 'Inicio', items: [['/admin', 'Dashboard', GridIcon], ['/admin/en-vivo', 'En vivo', PulseIcon], ['/admin/ordenes', 'Órdenes', ReceiptIcon]] },
  { title: 'Catálogo', items: [
    ['/admin/menu', 'Menú', UtensilsIcon],
    ['/admin/ingredientes', 'Ingredientes y extras', LeafIcon],
    ['/admin/disponibilidad', 'Disponibilidad', ToggleIcon],
  ] },
  { title: 'Local', items: [['/admin/plano', 'Plano del local', MapIcon], ['/admin/mesas', 'Mesas y QR', QrIcon]] },
  { title: 'Equipo', items: [['/admin/personal', 'Personal', UsersIcon], ['/admin/configuracion', 'Configuración', SlidersIcon]] },
]

function initials(name?: string) {
  return (name ?? '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

/** B-Admin shell: green top bar, white sidebar grouped by area (a scrolling row under 1024 px) and the section on the right. */
export function AdminLayout() {
  const { staff, signOut } = useAuth()
  return (
    <div className="flex min-h-dvh flex-col bg-white text-carbon">
      <header className="sticky top-0 z-20 flex h-16 flex-none items-center gap-4 bg-bosque px-4 text-white md:px-6">
        <span className="text-2xl font-extrabold tracking-tight">foody<span className="text-trigo">.</span></span>
        <span className="hidden h-6 w-px bg-white/20 sm:block" />
        <span className="hidden text-sm font-medium text-niebla sm:block">Administración</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-right text-sm leading-tight md:block">
            <span className="block font-semibold">{staff?.full_name}</span>
            <span className="block text-xs text-niebla">Administrador</span>
          </span>
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-white/15 text-[13px] font-semibold">
            {initials(staff?.full_name)}
          </span>
          <button type="button" onClick={() => void signOut()} aria-label="Salir"
            className="flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold text-white hover:bg-white/10">
            <LogoutIcon size={18} /><span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav aria-label="Administración"
          className="flex flex-none gap-1 overflow-x-auto border-b border-linea bg-white px-3 py-2 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-[248px] lg:flex-col lg:gap-6 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
          {NAV.map((group) => (
            <div key={group.title} className="flex flex-none gap-1 lg:flex-col">
              <span className="hidden px-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-apagado uppercase lg:block">{group.title}</span>
              {group.items.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} end={to === '/admin'}
                  className={({ isActive }) => `flex min-h-11 flex-none items-center gap-3 rounded-[10px] px-3 text-sm whitespace-nowrap no-underline transition-colors ${
                    isActive ? 'bg-bosque font-semibold text-white' : 'font-medium text-musgo hover:bg-hoja-claro hover:text-carbon'}`}>
                  <Icon size={18} strokeWidth={1.8} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <main className="flex min-w-0 flex-1 flex-col gap-[18px] px-4 py-6 md:px-[30px]">
          <Outlet />
        </main>
      </div>
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
