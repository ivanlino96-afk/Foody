import { useState } from 'react'
import { formatMoney } from '../../../domain/money'
import { centsToInput, parseMoneyInput } from '../../../domain/moneyInput'
import type { Extra, Ingredient } from '../../../domain/staffTypes'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { PencilIcon, TrashIcon } from '../../../shared/ui/icons'
import { Notice } from '../../../shared/ui/Notice'
import { AdminTitle, CARD } from '../AdminLayout'
import { useCatalogViewModel } from '../viewmodels/useCatalogViewModel'
import { IconAction, INPUT, PRIMARY, SECONDARY, Toggle } from './fields'

function IngredientRow({ ing, vm }: { ing: Ingredient; vm: ReturnType<typeof useCatalogViewModel<Ingredient>> }) {
  const [name, setName] = useState(ing.name)
  return (
    <div className="flex items-center gap-1 border-t border-linea/60 py-1">
      <input aria-label={`Nombre de ${ing.name}`} maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
        className={`min-h-11 min-w-0 flex-1 rounded-[10px] border border-transparent bg-transparent px-3 text-[15px] outline-none transition-colors hover:bg-hoja-claro focus:border-bosque focus:bg-white ${ing.is_available ? 'text-carbon' : 'text-apagado'}`}
        onBlur={() => { if (name.trim() && name.trim() !== ing.name) void vm.update(ing.id, { name: name.trim() }) }} />
      {!ing.is_available && <span className="text-xs text-apagado">Agotado</span>}
      <Toggle label={`${ing.name} disponible`} checked={ing.is_available} onChange={(v) => void vm.update(ing.id, { is_available: v })} />
      <IconAction label={`Borrar ${ing.name}`} icon={TrashIcon} danger onClick={() => vm.askDelete(ing)} />
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
      <AdminTitle title="Ingredientes y extras">
        <span className="text-sm text-musgo tabular-nums">{ingredients.items.length} ingredientes · {extras.items.length} extras</span>
      </AdminTitle>
      <Notice text={ingredients.notice ?? extras.notice} onClose={() => { ingredients.dismissNotice(); extras.dismissNotice() }} />
      <div className="grid items-start gap-[18px] xl:grid-cols-2">
        <section className={`${CARD} flex flex-col gap-3`}>
          <div className="flex items-baseline gap-2">
            <h2 className="m-0 text-[15px] font-semibold">Ingredientes</h2>
            <span className="text-[13px] text-musgo">Si uno se agota, sus platillos dejan de ofrecerse.</span>
          </div>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault()
            if (newIngredient.trim() && await ingredients.create({ name: newIngredient.trim() })) setNewIngredient('')
          }}>
            <input aria-label="Nuevo ingrediente" placeholder="Nuevo ingrediente" className={`${INPUT} flex-1`} maxLength={80}
              value={newIngredient} onChange={(e) => setNewIngredient(e.target.value)} />
            <button type="submit" className={SECONDARY} disabled={!newIngredient.trim()}>Agregar</button>
          </form>
          <div className="flex flex-col">
            {ingredients.items.map((ing) => <IngredientRow key={`${ing.id}-${ing.name}`} ing={ing} vm={ingredients} />)}
          </div>
        </section>
        <section className={`${CARD} flex flex-col gap-3`}>
          <div className="flex items-baseline gap-2">
            <h2 className="m-0 text-[15px] font-semibold">Extras</h2>
            <span className="text-[13px] text-musgo">Lo que el comensal puede sumar a un platillo.</span>
          </div>
          <form className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_96px_96px]" onSubmit={(e) => { e.preventDefault(); void saveExtra() }}>
            <input aria-label="Nombre del extra" placeholder="Nombre" className={INPUT} maxLength={80} value={extra.name} onChange={(e) => setExtra({ ...extra, name: e.target.value })} />
            <input aria-label="Precio" placeholder="Precio" inputMode="decimal" className={INPUT} value={extra.price} onChange={(e) => setExtra({ ...extra, price: e.target.value })} />
            <input aria-label="Costo" placeholder="Costo" inputMode="decimal" className={INPUT} value={extra.cost} onChange={(e) => setExtra({ ...extra, cost: e.target.value })} />
            <select aria-label="Depende del ingrediente" className={`${INPUT} md:col-span-2`} value={extra.ingredientId} onChange={(e) => setExtra({ ...extra, ingredientId: e.target.value })}>
              <option value="">Sin ingrediente</option>
              {ingredients.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <button type="submit" className={extra.id ? PRIMARY : SECONDARY}>{extra.id ? 'Guardar' : 'Agregar'}</button>
          </form>
          {extraError && <p role="alert" className="m-0 text-sm font-semibold text-[#B42318]">{extraError}</p>}
          <div className="flex flex-col">
            {extras.items.map((ex) => (
              <div key={ex.id} className={`flex items-center gap-1 border-t border-linea/60 py-2 ${extra.id === ex.id ? 'bg-hoja-claro' : ''}`}>
                <div className="flex min-w-0 flex-1 flex-col px-3">
                  <span className={`font-semibold ${ex.is_available ? '' : 'text-apagado'}`}>{ex.name}</span>
                  <span className="text-xs text-musgo">costo {formatMoney(ex.cost_cents)}
                    {ex.ingredient_id && ` · depende de ${ingredients.items.find((i) => i.id === ex.ingredient_id)?.name ?? 'un ingrediente'}`}</span>
                </div>
                <span className="px-2 text-sm font-semibold tabular-nums">+{formatMoney(ex.price_cents)}</span>
                <Toggle label={`${ex.name} disponible`} checked={ex.is_available} onChange={(v) => void extras.update(ex.id, { is_available: v })} />
                <IconAction label={`Editar ${ex.name}`} icon={PencilIcon}
                  onClick={() => setExtra({ id: ex.id, name: ex.name, price: centsToInput(ex.price_cents), cost: centsToInput(ex.cost_cents), ingredientId: ex.ingredient_id ?? '' })} />
                <IconAction label={`Borrar ${ex.name}`} icon={TrashIcon} danger onClick={() => extras.askDelete(ex)} />
              </div>
            ))}
          </div>
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
