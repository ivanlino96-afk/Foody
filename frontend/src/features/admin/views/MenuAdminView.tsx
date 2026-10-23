import { useState } from 'react'
import { photoUrl } from '../../../data/photos'
import { formatMoney } from '../../../domain/money'
import type { Category, Dish, Extra, Ingredient } from '../../../domain/staffTypes'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { PencilIcon, PlusIcon, TrashIcon } from '../../../shared/ui/icons'
import { Notice } from '../../../shared/ui/Notice'
import { AdminTitle, CARD } from '../AdminLayout'
import { useCatalogViewModel } from '../viewmodels/useCatalogViewModel'
import { DishForm } from './DishForm'
import { IconAction, INPUT, PRIMARY, SECONDARY, Toggle } from './fields'

const PILL = 'min-h-9 flex-none rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors'

export function MenuAdminView() {
  const dishes = useCatalogViewModel<Dish>('menu-items')
  const categories = useCatalogViewModel<Category>('categories')
  const ingredients = useCatalogViewModel<Ingredient>('ingredients')
  const extras = useCatalogViewModel<Extra>('extras')
  const [editing, setEditing] = useState<Dish | 'new' | null>(null)
  const [newCategory, setNewCategory] = useState('')
  const [shown, setShown] = useState<string | null>(null)
  const options = { categories: categories.items, ingredients: ingredients.items, extras: extras.items }

  const groups = categories.items.filter((c) => !shown || c.id === shown)
    .map((c) => ({ category: c, dishes: dishes.items.filter((d) => d.category_id === c.id) }))

  return (
    <>
      <AdminTitle title="Menú">
        <span className="text-sm text-musgo tabular-nums">{dishes.items.length} platillos · {categories.items.length} categorías</span>
        <button type="button" className={`${PRIMARY} ml-auto`} onClick={() => setEditing('new')}>
          <PlusIcon size={16} />Nuevo platillo
        </button>
      </AdminTitle>
      <Notice text={dishes.notice ?? categories.notice} onClose={() => { dishes.dismissNotice(); categories.dismissNotice() }} />
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filtrar por categoría" className="flex min-w-0 gap-1 overflow-x-auto rounded-full bg-hoja-claro p-1">
          {[{ id: null, name: 'Todas' }, ...categories.items].map((c) => (
            <button key={c.id ?? 'all'} type="button" aria-pressed={shown === c.id} onClick={() => setShown(c.id)}
              className={`${PILL} ${shown === c.id ? 'bg-white font-semibold text-carbon shadow-[0_1px_2px_rgba(27,30,27,0.08)]' : 'text-musgo hover:text-carbon'}`}>
              {c.name}
            </button>
          ))}
        </div>
        <form className="ml-auto flex items-center gap-2" onSubmit={async (e) => {
          e.preventDefault()
          if (newCategory.trim() && await categories.create({ name: newCategory.trim(), sort_order: categories.items.length + 1 })) setNewCategory('')
        }}>
          <input aria-label="Nueva categoría" placeholder="Nueva categoría" className={`${INPUT} w-52`} maxLength={80}
            value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          <button type="submit" className={SECONDARY} disabled={!newCategory.trim()}>Agregar</button>
        </form>
      </div>
      <section className={`${CARD} flex flex-col !p-0`}>
        {groups.map(({ category, dishes: list }) => (
          <div key={category.id} className="flex flex-col border-b border-linea px-[18px] pb-2 last:border-b-0">
            <div className="flex items-center gap-3 pt-4 pb-1">
              <h2 className="m-0 text-[13px] font-semibold tracking-[0.06em] text-musgo uppercase">{category.name}</h2>
              <span className="text-xs text-apagado tabular-nums">{list.length}</span>
              <span className="ml-auto flex items-center text-[13px] text-musgo">Visible
                <Toggle label={`${category.name} visible`} checked={category.is_active}
                  onChange={(v) => void categories.update(category.id, { is_active: v })} />
              </span>
              <IconAction label={`Borrar categoría ${category.name}`} icon={TrashIcon} danger onClick={() => categories.askDelete(category)} />
            </div>
            {list.length === 0 && <p className="m-0 py-3 text-sm text-apagado">Sin platillos todavía.</p>}
            {list.map((d, i) => {
              const src = photoUrl(d.photo_path)
              const margin = d.price_cents ? Math.round(((d.price_cents - d.cost_cents) / d.price_cents) * 100) : 0
              return (
                <div key={d.id} className={`grid grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-x-4 py-2.5 ${i ? 'border-t border-linea/60' : ''} md:grid-cols-[44px_minmax(0,1fr)_96px_80px_auto_auto]`}>
                  {src ? <img src={src} alt="" className="size-11 rounded-[10px] object-cover" />
                    : <span className="size-11 rounded-[10px] bg-hoja-claro" aria-hidden="true" />}
                  <div className="flex min-w-0 flex-col">
                    <span className={`truncate font-semibold ${d.is_active ? '' : 'text-musgo line-through'}`}>{d.name}</span>
                    <span className="text-xs text-musgo">{d.is_available ? 'Disponible' : 'No disponible'}<span className="md:hidden"> · {formatMoney(d.price_cents)}</span></span>
                  </div>
                  <span className="hidden text-right text-sm font-semibold tabular-nums md:block">{formatMoney(d.price_cents)}</span>
                  <span className="hidden text-right text-xs text-musgo tabular-nums md:block" title={`Costo ${formatMoney(d.cost_cents)}`}>Margen {margin}%</span>
                  <Toggle label={`${d.name} disponible`} checked={d.is_available} onChange={(v) => void dishes.update(d.id, { is_available: v })} />
                  <span className="flex">
                    <IconAction label={`Editar ${d.name}`} icon={PencilIcon} onClick={() => setEditing(d)} />
                    <IconAction label={`Borrar ${d.name}`} icon={TrashIcon} danger onClick={() => dishes.askDelete(d)} />
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </section>
      {editing && (
        <DishForm dish={editing === 'new' ? undefined : editing} options={options} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void dishes.reload() }} />
      )}
      {dishes.pendingDelete && (
        <ConfirmDialog title={`¿Borrar ${dishes.pendingDelete.name}?`} body="Deja de aparecer en el menú. Las órdenes pasadas se conservan."
          confirmLabel="Borrar" onCancel={dishes.cancelDelete} onConfirm={() => void dishes.confirmDelete()} />
      )}
      {categories.pendingDelete && (
        <ConfirmDialog title={`¿Borrar la categoría ${categories.pendingDelete.name}?`} body="Solo se puede borrar si ya no tiene platillos."
          confirmLabel="Borrar" onCancel={categories.cancelDelete} onConfirm={() => void categories.confirmDelete()} />
      )}
    </>
  )
}
