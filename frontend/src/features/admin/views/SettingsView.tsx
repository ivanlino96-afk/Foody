import { Button } from '../../../shared/ui/Button'
import { Notice } from '../../../shared/ui/Notice'
import { AdminTitle, CARD } from '../AdminLayout'
import { useSettingsViewModel } from '../viewmodels/useSettingsViewModel'
import { Field } from './fields'

export function SettingsView() {
  const vm = useSettingsViewModel()
  return (
    <>
      <AdminTitle title="Configuración" />
      <Notice text={vm.notice} />
      <form className={`${CARD} flex max-w-xl flex-col gap-4`} onSubmit={(e) => { e.preventDefault(); void vm.save() }}>
        <Field label="Nombre del restaurante" value={vm.form.name} maxLength={80} error={vm.errors.name} onChange={(e) => vm.set('name', e.target.value)} />
        <Field label="Minutos para liberar una mesa cerrada (0 a 240)" inputMode="numeric" value={vm.form.autoRelease}
          error={vm.errors.autoRelease} onChange={(e) => vm.set('autoRelease', e.target.value)} />
        <Field label="Propinas sugeridas (%, separadas por coma)" value={vm.form.tips} placeholder="10, 15, 20"
          error={vm.errors.tips} onChange={(e) => vm.set('tips', e.target.value)} />
        <div className="flex items-center gap-3">
          <Button type="submit" className="!min-h-11 !py-2" disabled={vm.loading || vm.saving}>{vm.saving ? 'Guardando…' : 'Guardar'}</Button>
          {vm.saved && <span role="status" className="text-sm font-semibold text-bosque">Guardado</span>}
        </div>
      </form>
    </>
  )
}
