import { useState } from 'react'
import { formatMoney } from '../../../domain/money'
import { centsToInput, parseMoneyInput } from '../../../domain/moneyInput'
import type { Extra, Ingredient } from '../../../domain/staffTypes'
import { Button } from '../../../shared/ui/Button'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { Notice } from '../../../shared/ui/Notice'
import { AdminTitle, CARD } from '../AdminLayout'
import { useCatalogViewModel } from '../viewmodels/useCatalogViewModel'
import { INPUT, Toggle } from './fields'

function IngredientRow({ ing, vm }: { ing: Ingredient; vm: ReturnType<typeof useCatalogViewModel<Ingredient>> }) {
  const [name, setName] = useState(ing.name)
  return (
    <div className="flex items-center gap-2 border-t border-avena py-2">
      <input aria-label={`Nombre de ${ing.name}`} className={`${INPUT} flex-1`} maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name.trim() !== ing.name) void vm.update(ing.id, { name: name.trim() }) }} />
      <Toggle label={`${ing.name} disponible`} checked={ing.is_available} onChange={(v) => void vm.update(ing.id, { is_available: v })} />
      <button type="button" onClick={() => vm.askDelete(ing)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[#B42318]">Borrar</button>
    </div>
  )
}

const emptyExtra = { name: '', price: '', cost: '', ingredientId: '' }

export function IngredientsExtrasView() {
  const ingredients = useCatalogViewModel<Ingredient>('ingredients')
  const extras = useCatalogViewModel<Extra>('extras')
  const [newIngredient, setNewIngredient] = useState('')
  const [extra, setExtra] = useState<typeof emptyExtra & { id?: string }>(emptyExtra)
  const [extraError, setExtraError] = useState<string | null>(null)

  async function saveExtra() {
    const price = parseMoneyInput(extra.price)
    const cost = extra.cost.trim() ? parseMoneyInput(extra.cost) : 0
    if (!extra.name.trim()) return setExtraError('Escribe el nombre del extra')
    if (price === null || cost === null) return setExtraError('Escribe precio y costo válidos, por ejemplo 30 o 12.50')
    setExtraError(null)
    const body = { name: extra.name.trim(), price_cents: price, cost_cents: cost, ingredient_id: extra.ingredientId || null }
    if (await (extra.id ? extras.update(extra.id, body) : extras.create(body))) setExtra(emptyExtra)
  }

  return (
    <>
      <AdminTitle title="Ingredientes y extras" />
      <Notice text={ingredients.notice ?? extras.notice} onClose={() => { ingredients.dismissNotice(); extras.dismissNotice() }} />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={`${CARD} flex flex-col gap-2`}>
          <h2 className="m-0 text-base font-bold">Ingredientes</h2>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault()
            if (newIngredient.trim() && await ingredients.create({ name: newIngredient.trim() })) setNewIngredient('')
          }}>
            <input aria-label="Nuevo ingrediente" placeholder="Nuevo ingrediente" className={`${INPUT} flex-1`} maxLength={80}
              value={newIngredient} onChange={(e) => setNewIngredient(e.target.value)} />
            <Button type="submit" variant="soft" className="!min-h-11 !py-2" disabled={!newIngredient.trim()}>Agregar</Button>
          </form>
          {ingredients.items.map((ing) => <IngredientRow key={`${ing.id}-${ing.name}`} ing={ing} vm={ingredients} />)}
        </section>
        <section className={`${CARD} flex flex-col gap-2`}>
          <h2 className="m-0 text-base font-bold">Extras</h2>
          <form className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_90px_90px_1fr_auto]" onSubmit={(e) => { e.preventDefault(); void saveExtra() }}>
            <input aria-label="Nombre del extra" placeholder="Nombre" className={INPUT} maxLength={80} value={extra.name} onChange={(e) => setExtra({ ...extra, name: e.target.value })} />
            <input aria-label="Precio" placeholder="Precio" inputMode="decimal" className={INPUT} value={extra.price} onChange={(e) => setExtra({ ...extra, price: e.target.value })} />
            <input aria-label="Costo" placeholder="Costo" inputMode="decimal" className={INPUT} value={extra.cost} onChange={(e) => setExtra({ ...extra, cost: e.target.value })} />
            <select aria-label="Depende del ingrediente" className={INPUT} value={extra.ingredientId} onChange={(e) => setExtra({ ...extra, ingredientId: e.target.value })}>
              <option value="">Sin ingrediente</option>
              {ingredients.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <Button type="submit" variant="soft" className="!min-h-11 !py-2">{extra.id ? 'Guardar' : 'Agregar'}</Button>
          </form>
          {extraError && <p role="alert" className="m-0 text-sm font-semibold text-[#B42318]">{extraError}</p>}
          {extras.items.map((ex) => (
            <div key={ex.id} className="flex items-center gap-2 border-t border-avena py-2">
              <div className="flex flex-1 flex-col">
                <span className="font-bold">{ex.name}</span>
                <span className="text-xs text-musgo">+{formatMoney(ex.price_cents)} · costo {formatMoney(ex.cost_cents)}
                  {ex.ingredient_id && ` · depende de ${ingredients.items.find((i) => i.id === ex.ingredient_id)?.name ?? 'un ingrediente'}`}</span>
              </div>
              <Toggle label={`${ex.name} disponible`} checked={ex.is_available} onChange={(v) => void extras.update(ex.id, { is_available: v })} />
              <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-arena"
                onClick={() => setExtra({ id: ex.id, name: ex.name, price: centsToInput(ex.price_cents), cost: centsToInput(ex.cost_cents), ingredientId: ex.ingredient_id ?? '' })}>Editar</button>
              <button type="button" onClick={() => extras.askDelete(ex)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[#B42318]">Borrar</button>
            </div>
          ))}
        </section>
      </div>
      {ingredients.pendingDelete && (
        <ConfirmDialog title={`¿Borrar ${ingredients.pendingDelete.name}?`} body="Se quita de los platillos que lo usan."
          confirmLabel="Borrar" onCancel={ingredients.cancelDelete} onConfirm={() => void ingredients.confirmDelete()} />
      )}
      {extras.pendingDelete && (
        <ConfirmDialog title={`¿Borrar ${extras.pendingDelete.name}?`} body="Deja de ofrecerse en los platillos."
          confirmLabel="Borrar" onCancel={extras.cancelDelete} onConfirm={() => void extras.confirmDelete()} />
      )}
    </>
  )
}
