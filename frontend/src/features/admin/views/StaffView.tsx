import { useEffect, useState } from 'react'
import type { StaffRole, StaffRow } from '../../../domain/staffTypes'
import { BellServiceIcon, ChefHatIcon, CloseIcon, PlusIcon, ShieldIcon } from '../../../shared/ui/icons'
import { Notice } from '../../../shared/ui/Notice'
import { useAuth } from '../../auth/AuthContext'
import { AdminTitle, CARD } from '../AdminLayout'
import { ROLE_LABEL, useStaffViewModel } from '../viewmodels/useStaffViewModel'
import { Field, PRIMARY, SECONDARY, Toggle } from './fields'

type Vm = ReturnType<typeof useStaffViewModel>

/** Order and wording of each team on the page: waiters and kitchen first, admins last. */
const TEAMS: { role: StaffRole; title: string; hint: string; icon: typeof ChefHatIcon }[] = [
  { role: 'waiter', title: 'Meseros', hint: 'Toman órdenes, atienden mesas y cobran.', icon: BellServiceIcon },
  { role: 'kitchen', title: 'Cocina', hint: 'Ven las órdenes y las marcan como listas.', icon: ChefHatIcon },
  { role: 'admin', title: 'Administradores', hint: 'Acceso completo a este panel.', icon: ShieldIcon },
]

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function Member({ s, me, vm }: { s: StaffRow; me: boolean; vm: Vm }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-linea/60 py-2.5 first:border-t-0 ${s.is_active ? '' : 'opacity-60'}`}>
      <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-hoja-claro text-[13px] font-semibold text-bosque">
        {initials(s.full_name)}
      </span>
      <div className="flex min-w-0 flex-1 basis-40 flex-col">
        <span className="truncate font-semibold">
          {s.full_name}{me && <span className="ml-2 rounded-full bg-hoja-claro px-2 py-0.5 text-[11px] font-medium text-musgo">Tú</span>}
        </span>
        <span className="truncate text-[13px] text-musgo">{s.email ?? 'Sin correo'}</span>
      </div>
      <label className="w-32 flex-none">
        <span className="sr-only">Rol de {s.full_name}</span>
        <select aria-label={`Rol de ${s.full_name}`} value={s.role}
          onChange={(e) => void vm.update(s.id, { role: e.target.value as StaffRole })}
          className="min-h-9 w-full rounded-full border border-linea bg-white px-3 text-sm text-carbon outline-none focus:border-bosque">
          {TEAMS.map((t) => <option key={t.role} value={t.role}>{ROLE_LABEL[t.role]}</option>)}
        </select>
      </label>
      <span className="flex w-28 flex-none items-center justify-end gap-1 text-[13px] text-musgo">
        {s.is_active ? 'Activo' : 'Inactivo'}
        <Toggle label={`${s.full_name} activo`} checked={s.is_active} onChange={(v) => void vm.update(s.id, { is_active: v })} />
      </span>
    </div>
  )
}

function NewMemberDialog({ vm, onClose }: { vm: Vm; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-carbon/30 sm:items-center sm:px-4" role="presentation" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="new-member-title" onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => { e.preventDefault(); if (await vm.create()) onClose() }}
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-t-[20px] bg-white p-6 sm:rounded-[20px]">
        <div className="flex items-start gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="new-member-title" className="m-0 text-lg font-semibold">Nuevo miembro del equipo</h2>
            <p className="m-0 text-sm text-musgo">Entrará con este correo y contraseña.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose}
            className="-mt-2 -mr-2 ml-auto flex size-11 flex-none items-center justify-center rounded-full text-musgo hover:bg-hoja-claro">
            <CloseIcon size={18} />
          </button>
        </div>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-semibold">Rol</legend>
          {TEAMS.map(({ role, hint, icon: Icon }) => {
            const on = vm.form.role === role
            return (
              <label key={role} className={`flex cursor-pointer items-center gap-3 rounded-[14px] border p-3 transition-colors ${
                on ? 'border-bosque bg-hoja-claro' : 'border-linea hover:bg-hoja-claro/60'}`}>
                <input type="radio" name="role" value={role} checked={on} className="sr-only"
                  onChange={() => vm.setForm({ ...vm.form, role })} />
                <span className={`flex size-10 flex-none items-center justify-center rounded-full ${on ? 'bg-bosque text-white' : 'bg-hoja-claro text-bosque'}`}>
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{ROLE_LABEL[role]}</span>
                  <span className="text-[13px] text-musgo">{hint}</span>
                </span>
                <span aria-hidden="true" className={`ml-auto size-4 flex-none rounded-full border-2 ${on ? 'border-bosque bg-bosque shadow-[inset_0_0_0_2px_white]' : 'border-linea'}`} />
              </label>
            )
          })}
        </fieldset>
        <Field label="Nombre" value={vm.form.fullName} maxLength={80} error={vm.errors.fullName} autoFocus
          onChange={(e) => vm.setForm({ ...vm.form, fullName: e.target.value })} />
        <Field label="Correo" type="email" autoComplete="off" value={vm.form.email} error={vm.errors.email}
          onChange={(e) => vm.setForm({ ...vm.form, email: e.target.value })} />
        <Field label="Contraseña" type="password" autoComplete="new-password" value={vm.form.password}
          error={vm.errors.password ?? undefined} placeholder="Mínimo 8 caracteres"
          onChange={(e) => vm.setForm({ ...vm.form, password: e.target.value })} />
        {vm.notice && <p role="alert" className="m-0 text-sm font-semibold text-[#B42318]">{vm.notice}</p>}
        <div className="flex gap-2">
          <button type="button" className={`${SECONDARY} !flex-1`} onClick={onClose}>Cancelar</button>
          <button type="submit" className={`${PRIMARY} !flex-1`} disabled={vm.saving}>{vm.saving ? 'Creando…' : 'Crear cuenta'}</button>
        </div>
      </form>
    </div>
  )
}

export function StaffView() {
  const vm = useStaffViewModel()
  const { staff: me } = useAuth()
  const [creating, setCreating] = useState(false)
  const [shown, setShown] = useState<StaffRole | null>(null)
  const active = vm.staff.filter((s) => s.is_active).length
  const teams = TEAMS.filter((t) => !shown || t.role === shown)
    .map((t) => ({ ...t, members: vm.staff.filter((s) => s.role === t.role) }))

  return (
    <>
      <AdminTitle title="Personal">
        {!vm.loading && <span className="text-sm text-musgo tabular-nums">{vm.staff.length} personas · {active} activas</span>}
        <button type="button" className={`${PRIMARY} ml-auto`} onClick={() => setCreating(true)}>
          <PlusIcon size={16} />Nuevo miembro
        </button>
      </AdminTitle>
      {!creating && <Notice text={vm.notice} onClose={vm.dismissNotice} />}
      <div role="group" aria-label="Filtrar por rol" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-hoja-claro p-1">
        {[{ role: null, title: 'Todos' }, ...TEAMS].map((t) => {
          const count = t.role ? vm.staff.filter((s) => s.role === t.role).length : vm.staff.length
          return (
            <button key={t.role ?? 'all'} type="button" aria-pressed={shown === t.role} onClick={() => setShown(t.role)}
              className={`flex min-h-9 flex-none items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors ${shown === t.role
                ? 'bg-white font-semibold text-carbon shadow-[0_1px_2px_rgba(27,30,27,0.08)]' : 'font-medium text-musgo hover:text-carbon'}`}>
              {t.title}<span className="text-xs text-apagado tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>
      <div className="grid items-start gap-[18px] xl:grid-cols-2">
        {teams.map(({ role, title, hint, icon: Icon, members }) => (
          <section key={role} className={`${CARD} flex flex-col gap-2 ${role === 'admin' && !shown ? 'xl:col-span-2' : ''}`}>
            <div className="flex items-center gap-3 pb-1">
              <span className="flex size-9 items-center justify-center rounded-full bg-bosque text-white"><Icon size={17} strokeWidth={1.8} /></span>
              <div className="flex flex-col">
                <h2 className="m-0 text-[15px] font-semibold">{title} <span className="font-normal text-apagado tabular-nums">{members.length}</span></h2>
                <span className="text-[13px] text-musgo">{hint}</span>
              </div>
            </div>
            <div className="flex flex-col">
              {members.map((s) => <Member key={s.id} s={s} me={s.id === me?.id} vm={vm} />)}
              {!vm.loading && members.length === 0 && (
                <p className="m-0 border-t border-linea/60 py-4 text-sm text-apagado">Nadie en este equipo todavía.</p>
              )}
            </div>
          </section>
        ))}
      </div>
      {creating && <NewMemberDialog vm={vm} onClose={() => { setCreating(false); vm.dismissNotice() }} />}
    </>
  )
}
