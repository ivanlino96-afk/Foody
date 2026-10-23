import { Link, useNavigate, useParams } from 'react-router'
import { formatMoney } from '../../../domain/money'
import { Badge } from '../../../shared/ui/Badge'
import { BackIcon, MinusIcon, PlusIcon } from '../../../shared/ui/icons'
import { useDiner } from '../DinerContext'
import { useDishDetailViewModel } from '../viewmodels/useDishDetailViewModel'
import { DishPhoto } from './DishPhoto'

const stepper = 'flex h-9 w-9 items-center justify-center rounded-[10px] border-0'

export function DishDetailView() {
  const { itemId = '' } = useParams()
  const { token } = useDiner()
  const navigate = useNavigate()
  const vm = useDishDetailViewModel(itemId)
  const menuHref = `/mesa/${token}`

  if (!vm.item) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="m-0 text-[15px] text-musgo">{vm.loading ? 'Cargando platillo…' : 'Este platillo ya no está en el menú.'}</p>
        {!vm.loading && <Link to={menuHref} className="font-bold text-bosque">Volver al menú</Link>}
      </main>
    )
  }
  const item = vm.item
  const essentials = item.ingredients.filter((i) => !i.is_removable).map((i) => i.name)

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-white">
      <div className="flex-1 pb-4">
        <div className="relative">
          <DishPhoto path={item.photo_path} name={item.name} className="h-[220px] w-full" />
          <Link to={menuHref} aria-label="Volver al menú"
            className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-carbon shadow-[0_2px_8px_rgba(27,30,27,0.12)]">
            <BackIcon />
          </Link>
        </div>
        <div className="flex flex-col gap-2 px-5 pt-[18px]">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="m-0 text-2xl font-extrabold tracking-[-0.02em]">{item.name}</h1>
            <span className="text-xl font-extrabold">{formatMoney(item.price_cents)}</span>
          </div>
          {item.description && <p className="m-0 text-sm leading-normal text-musgo">{item.description}</p>}
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((t) => <Badge key={t} tone={t.toLowerCase() === 'picante' ? 'hot' : 'green'}>{t}</Badge>)}
            {item.prep_minutes && <Badge>{item.prep_minutes} min aprox.</Badge>}
            {!item.available && <Badge tone="dark">No disponible</Badge>}
          </div>
        </div>

        {item.ingredients.length > 0 && (
          <section className="flex flex-col gap-1 px-5 pt-[22px]">
            <h2 className="m-0 text-base font-extrabold">Ingredientes</h2>
            <p className="m-0 mb-1.5 text-[13px] text-musgo">
              Desmarca lo que no quieras.{essentials.length > 0 && ` ${essentials.join(', ')} no se ${essentials.length > 1 ? 'pueden' : 'puede'} quitar.`}
            </p>
            {item.ingredients.map((ing) => ing.available ? (
              <label key={ing.id} className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-arena">
                <input type="checkbox" checked={!vm.removed.has(ing.id)} disabled={!vm.canRemove(ing.id)}
                  onChange={() => vm.toggleIngredient(ing.id)} className="m-0 h-[22px] w-[22px] accent-bosque" />
                <span className="flex-1 text-[15px] font-semibold">{ing.name}</span>
                {vm.removed.has(ing.id) && <span className="text-xs font-bold text-[#B91C1C]">Sin {ing.name.toLowerCase()}</span>}
              </label>
            ) : (
              <div key={ing.id} className="flex min-h-12 items-center gap-3 border-b border-arena">
                <input type="checkbox" disabled aria-label={`${ing.name} no disponible`} className="m-0 h-[22px] w-[22px]" />
                <span className="flex-1 text-[15px] font-semibold text-apagado line-through">{ing.name}</span>
                <Badge>No disponible</Badge>
              </div>
            ))}
          </section>
        )}

        {item.extras.length > 0 && (
          <section className="flex flex-col gap-1 px-5 pt-[22px]">
            <h2 className="m-0 mb-1.5 text-base font-extrabold">Extras</h2>
            {item.extras.map((x) => (
              <div key={x.id} className="flex min-h-[52px] items-center gap-3 border-b border-arena">
                <div className="flex flex-1 flex-col">
                  <span className={`text-[15px] font-semibold ${x.available ? '' : 'text-apagado'}`}>{x.name}</span>
                  <span className="text-[13px] text-musgo">+{formatMoney(x.price_cents)}</span>
                </div>
                {x.available ? (
                  <div className="flex items-center gap-2.5">
                    <button type="button" aria-label={`Quitar ${x.name}`} onClick={() => vm.decExtra(x.id)}
                      disabled={vm.extraQty(x.id) === 0} className={`${stepper} bg-arena text-carbon disabled:opacity-40`}><MinusIcon size={16} /></button>
                    <span className="w-4 text-center text-[15px] font-extrabold">{vm.extraQty(x.id)}</span>
                    <button type="button" aria-label={`Agregar ${x.name}`} onClick={() => vm.incExtra(x.id)}
                      disabled={vm.extraQty(x.id) >= x.max_quantity} className={`${stepper} bg-bosque text-white disabled:opacity-40`}><PlusIcon size={16} /></button>
                  </div>
                ) : <Badge>No disponible</Badge>}
              </div>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-2 px-5 pt-[22px]">
          <label htmlFor="nota" className="text-base font-extrabold">Nota para cocina</label>
          <textarea id="nota" rows={2} value={vm.note} onChange={(e) => vm.setNote(e.target.value)} maxLength={200}
            placeholder="Alergias, sin picante, término…"
            className="resize-none rounded-xl border border-linea bg-[#F8F6F1] p-3 text-[15px] font-medium text-carbon" />
        </section>
      </div>

      <footer className="sticky bottom-0 flex flex-none items-center gap-3 border-t border-linea bg-white px-4 pb-[22px] pt-3.5">
        <div className="flex items-center gap-2.5 rounded-[14px] bg-arena p-1">
          <button type="button" aria-label="Menos" onClick={vm.dec} className="flex h-11 w-10 items-center justify-center border-0 bg-transparent text-carbon"><MinusIcon /></button>
          <span className="w-[18px] text-center text-base font-extrabold">{vm.quantity}</span>
          <button type="button" aria-label="Más" onClick={vm.inc} className="flex h-11 w-10 items-center justify-center border-0 bg-transparent text-carbon"><PlusIcon /></button>
        </div>
        <button type="button" disabled={!vm.canAdd} onClick={() => { vm.add(); navigate(menuHref) }}
          className="flex flex-1 justify-between rounded-[14px] border-0 bg-bosque p-4 text-base font-bold text-white disabled:bg-linea disabled:text-musgo">
          <span>{vm.canAdd ? 'Agregar' : 'No disponible'}</span><span>{formatMoney(vm.previewCents)}</span>
        </button>
      </footer>
    </div>
  )
}
