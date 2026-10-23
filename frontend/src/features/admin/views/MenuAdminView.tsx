import { useState } from 'react'
import { photoUrl } from '../../../data/photos'
import { formatMoney } from '../../../domain/money'
import type { Category, Dish, Extra, Ingredient } from '../../../domain/staffTypes'
import { Button } from '../../../shared/ui/Button'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { Notice } from '../../../shared/ui/Notice'
import { AdminTitle, CARD } from '../AdminLayout'
import { useCatalogViewModel } from '../viewmodels/useCatalogViewModel'
import { DishForm } from './DishForm'
import { INPUT, Toggle } from './fields'

export function MenuAdminView() {
  const dishes = useCatalogViewModel<Dish>('menu-items')
  const categories = useCatalogViewModel<Category>('categories')
  const ingredients = useCatalogViewModel<Ingredient>('ingredients')
  const extras = useCatalogViewModel<Extra>('extras')
  const [editing, setEditing] = useState<Dish | 'new' | null>(null)
  const [newCategory, setNewCategory] = useState('')
  const options = { categories: categories.items, ingredients: ingredients.items, extras: extras.items }

  const groups = categories.items.map((c) => ({ category: c, dishes: dishes.items.filter((d) => d.category_id === c.id) }))

  return (
    <>
      <AdminTitle title="Menú">
        <Button className="ml-auto !min-h-11 !py-2" onClick={() => setEditing('new')}>Nuevo platillo</Button>
      </AdminTitle>
      <Notice text={dishes.notice ?? categories.notice} onClose={() => { dishes.dismissNotice(); categories.dismissNotice() }} />
      <form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => {
        e.preventDefault()
        if (newCategory.trim() && await categories.create({ name: newCategory.trim(), sort_order: categories.items.length + 1 })) setNewCategory('')
      }}>
        <label className="flex flex-col gap-1 text-sm font-semibold">Nueva categoría
          <input className={`${INPUT} w-60`} maxLength={80} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
        </label>
        <Button type="submit" variant="soft" className="!min-h-11 !py-2" disabled={!newCategory.trim()}>Agregar</Button>
      </form>
      {groups.map(({ category, dishes: list }) => (
        <section key={category.id} className={`${CARD} flex flex-col gap-2`}>
          <div className="flex items-center gap-3">
            <h2 className="m-0 text-base font-bold">{category.name}</h2>
            <span className="text-xs text-musgo">{list.length} platillos</span>
            <span className="ml-auto flex items-center gap-2 text-sm text-musgo">Visible
              <Toggle label={`${category.name} visible`} checked={category.is_active}
                onChange={(v) => void categories.update(category.id, { is_active: v })} />
            </span>
            <button type="button" onClick={() => categories.askDelete(category)}
              className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[#B42318]">Borrar</button>
          </div>
          {list.map((d) => {
            const src = photoUrl(d.photo_path)
            return (
              <div key={d.id} className="flex items-center gap-3 border-t border-avena py-2">
                {src ? <img src={src} alt="" className="size-12 rounded-lg object-cover" />
                  : <span className="size-12 rounded-lg bg-arena" aria-hidden="true" />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={`font-bold ${d.is_active ? '' : 'text-musgo line-through'}`}>{d.name}</span>
                  <span className="text-xs text-musgo">{formatMoney(d.price_cents)} · costo {formatMoney(d.cost_cents)}{d.is_available ? '' : ' · No disponible'}</span>
                </div>
                <Toggle label={`${d.name} disponible`} checked={d.is_available} onChange={(v) => void dishes.update(d.id, { is_available: v })} />
                <button type="button" onClick={() => setEditing(d)} className="min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-arena">Editar</button>
                <button type="button" onClick={() => dishes.askDelete(d)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[#B42318]">Borrar</button>
              </div>
            )
          })}
        </section>
      ))}
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
