import type { StaffRole } from '../../../domain/staffTypes'
import { Button } from '../../../shared/ui/Button'
import { Notice } from '../../../shared/ui/Notice'
import { useAuth } from '../../auth/AuthContext'
import { AdminTitle, CARD } from '../AdminLayout'
import { ROLE_LABEL, useStaffViewModel } from '../viewmodels/useStaffViewModel'
import { Field, INPUT, Toggle } from './fields'

const ROLES = Object.entries(ROLE_LABEL) as [StaffRole, string][]

export function StaffView() {
  const vm = useStaffViewModel()
  const { staff: me } = useAuth()
  return (
    <>
      <AdminTitle title="Personal" />
      <Notice text={vm.notice} onClose={vm.dismissNotice} />
      <form className={`${CARD} grid items-start gap-3 md:grid-cols-[1fr_1fr_1fr_140px_auto]`}
        onSubmit={(e) => { e.preventDefault(); void vm.create() }}>
        <Field label="Nombre" value={vm.form.fullName} maxLength={80} error={vm.errors.fullName} onChange={(e) => vm.setForm({ ...vm.form, fullName: e.target.value })} />
        <Field label="Correo" type="email" autoComplete="off" value={vm.form.email} error={vm.errors.email} onChange={(e) => vm.setForm({ ...vm.form, email: e.target.value })} />
        <Field label="Contraseña" type="password" autoComplete="new-password" value={vm.form.password} error={vm.errors.password}
          onChange={(e) => vm.setForm({ ...vm.form, password: e.target.value })} />
        <Field label="Rol">
          <select className={INPUT} value={vm.form.role} onChange={(e) => vm.setForm({ ...vm.form, role: e.target.value as StaffRole })}>
            {ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Button type="submit" className="!min-h-11 self-end !py-2" disabled={vm.saving}>{vm.saving ? 'Creando…' : 'Crear cuenta'}</Button>
      </form>
      <section className={`${CARD} flex flex-col`}>
        {vm.staff.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-avena py-2.5 last:border-0">
            <div className="flex min-w-48 flex-1 flex-col">
              <span className={`font-bold ${s.is_active ? '' : 'text-musgo'}`}>{s.full_name}{s.id === me?.id ? ' (tú)' : ''}</span>
              <span className="text-xs text-musgo">{s.email ?? 'sin correo'}</span>
            </div>
            <select aria-label={`Rol de ${s.full_name}`} className={`${INPUT} w-36`} value={s.role}
              onChange={(e) => void vm.update(s.id, { role: e.target.value as StaffRole })}>
              {ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <span className="flex items-center gap-2 text-sm text-musgo">{s.is_active ? 'Activo' : 'Inactivo'}
              <Toggle label={`${s.full_name} activo`} checked={s.is_active} onChange={(v) => void vm.update(s.id, { is_active: v })} />
            </span>
          </div>
        ))}
      </section>
    </>
  )
}
