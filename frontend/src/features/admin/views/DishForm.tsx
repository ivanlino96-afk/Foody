import { formatMoney } from '../../../domain/money'
import type { Dish } from '../../../domain/staffTypes'
import { Button } from '../../../shared/ui/Button'
import { useDishFormViewModel, type DishOptions } from '../viewmodels/useDishFormViewModel'
import { Field, INPUT } from './fields'

export function DishForm({ dish, options, onClose, onSaved }:
  { dish?: Dish; options: DishOptions; onClose: () => void; onSaved: () => void }) {
  const vm = useDishFormViewModel(dish, options, onSaved)
  const f = vm.fields
  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-carbon/30" role="presentation" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label={vm.isNew ? 'Nuevo platillo' : `Editar ${dish?.name}`}
        onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void vm.save() }}
        className="flex h-full w-full max-w-xl flex-col gap-4 overflow-y-auto bg-white p-6">
        <div className="flex items-center">
          <h2 className="m-0 text-xl font-extrabold">{vm.isNew ? 'Nuevo platillo' : 'Editar platillo'}</h2>
          <button type="button" onClick={onClose} className="ml-auto min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-avena">Cerrar</button>
        </div>
        <Field label="Nombre" value={f.name} maxLength={80} error={vm.errors.name} onChange={(e) => vm.set('name', e.target.value)} />
        <Field label="Descripción" error={vm.errors.description}>
          <textarea className={`${INPUT} min-h-20 py-2`} maxLength={500} value={f.description} onChange={(e) => vm.set('description', e.target.value)} />
        </Field>
        <Field label="Categoría" error={vm.errors.categoryId}>
          <select className={INPUT} value={f.categoryId} onChange={(e) => vm.set('categoryId', e.target.value)}>
            <option value="">Elige…</option>
            {options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Precio" inputMode="decimal" value={f.priceText} error={vm.errors.priceText} onChange={(e) => vm.set('priceText', e.target.value)} />
          <Field label="Costo" inputMode="decimal" value={f.costText} error={vm.errors.costText} onChange={(e) => vm.set('costText', e.target.value)} />
          <Field label="Minutos" inputMode="numeric" value={f.prepText} error={vm.errors.prepText} onChange={(e) => vm.set('prepText', e.target.value)} />
        </div>
        <Field label="Etiquetas (separadas por coma)" value={f.tagsText} onChange={(e) => vm.set('tagsText', e.target.value)} />
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <label className="flex items-center gap-2"><input type="checkbox" className="size-5" checked={f.isActive} onChange={(e) => vm.set('isActive', e.target.checked)} />Visible en el menú</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-5" checked={f.isAvailable} onChange={(e) => vm.set('isAvailable', e.target.checked)} />Disponible hoy</label>
        </div>

        <fieldset className="flex flex-col gap-2 rounded-xl border border-linea p-3">
          <legend className="px-1 text-sm font-bold">Ingredientes</legend>
          {options.ingredients.map((ing) => {
            const link = vm.ingredientLinks.find((l) => l.ingredient_id === ing.id)
            return (
              <div key={ing.id} className="flex min-h-11 items-center gap-3 text-sm">
                <label className="flex flex-1 items-center gap-2"><input type="checkbox" className="size-5" checked={!!link} onChange={() => vm.toggleIngredient(ing.id)} />{ing.name}</label>
                {link && (
                  <label className="flex items-center gap-2 text-musgo">
                    <input type="checkbox" className="size-5" checked={link.is_removable} onChange={(e) => vm.setRemovable(ing.id, e.target.checked)} />Se puede quitar
                  </label>
                )}
              </div>
            )
          })}
        </fieldset>

        <fieldset className="flex flex-col gap-2 rounded-xl border border-linea p-3">
          <legend className="px-1 text-sm font-bold">Extras</legend>
          {options.extras.map((ex) => {
            const link = vm.extraLinks.find((l) => l.extra_id === ex.id)
            return (
              <div key={ex.id} className="flex min-h-11 items-center gap-3 text-sm">
                <label className="flex flex-1 items-center gap-2"><input type="checkbox" className="size-5" checked={!!link} onChange={() => vm.toggleExtra(ex.id)} />{ex.name} · {formatMoney(ex.price_cents)}</label>
                {link && (
                  <label className="flex items-center gap-2 text-musgo">Máximo
                    <input type="number" min={1} max={10} value={link.max_quantity} onChange={(e) => vm.setMaxQuantity(ex.id, Number(e.target.value))}
                      className="min-h-11 w-16 rounded-lg border border-linea px-2 text-base" />
                  </label>
                )}
              </div>
            )
          })}
        </fieldset>

        <Field label="Foto (JPG, PNG o WebP, hasta 5 MB)" error={vm.photoError ?? undefined}>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="text-sm"
            onChange={(e) => vm.pickPhoto(e.target.files?.[0] ?? null)} />
        </Field>

        {vm.error && <p role="alert" className="m-0 text-sm font-semibold text-[#B42318]">{vm.error}</p>}
        <div className="mt-auto flex gap-2 pt-2">
          <Button variant="soft" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={vm.saving}>{vm.saving ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </form>
    </div>
  )
}
