import { Link } from 'react-router'
import { formatMoney } from '../../../domain/money'
import type { MenuItem } from '../../../domain/types'
import { Badge } from '../../../shared/ui/Badge'
import { PlusIcon, SearchIcon } from '../../../shared/ui/icons'
import { useDiner } from '../DinerContext'
import { useMenuViewModel } from '../viewmodels/useMenuViewModel'
import { DishPhoto } from './DishPhoto'
import { MenuHeaderActions, RoundBanner } from './RoundBanner'

function meta(item: MenuItem): string {
  return [item.tags[0], item.prep_minutes ? `${item.prep_minutes} min` : null].filter(Boolean).join(' · ')
}

function DishCard({ item, href }: { item: MenuItem; href: string }) {
  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl bg-white border border-linea ${item.available ? '' : 'opacity-60'}`}>
      <Link to={href} className="relative block h-28 text-inherit no-underline" aria-label={`Ver ${item.name}`}>
        <DishPhoto path={item.photo_path} name={item.name} className="h-28 w-full" />
        {!item.available && <span className="absolute right-2 top-2"><Badge tone="dark">No disponible</Badge></span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-2.5">
        <span className="text-[15px] font-bold leading-tight">{item.name}</span>
        {meta(item) && <span className="text-xs text-musgo">{meta(item)}</span>}
        <div className="mt-auto flex items-center justify-between pt-1.5">
          <span className="text-[15px] font-extrabold">{formatMoney(item.price_cents)}</span>
          {item.available && (
            <Link to={href} aria-label={`Agregar ${item.name}`}
              className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-bosque text-white">
              <PlusIcon size={18} />
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}

export function MenuView() {
  const vm = useMenuViewModel()
  const { token } = useDiner()

  const tabs = [{ id: null, name: 'Todo' }, ...vm.categories]
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-avena pb-28">
      <header className="sticky top-0 z-10 flex flex-col gap-3.5 bg-white pb-3">
        <div className="flex flex-col gap-3.5 bg-bosque px-5 pt-[18px] pb-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-extrabold tracking-[-0.03em]">foody<span className="text-trigo">.</span></span>
            <span className="text-[13px] text-niebla">{vm.tableLine}</span>
          </div>
          <MenuHeaderActions />
        </div>
        <label className="flex h-11 items-center gap-2.5 rounded-xl bg-white px-3.5">
          <SearchIcon size={18} className="text-musgo" />
          <input value={vm.query} onChange={(e) => vm.setQuery(e.target.value)} placeholder="Buscar platillos"
            aria-label="Buscar platillos" type="search"
            className="flex-1 border-0 bg-transparent text-base font-medium text-carbon outline-none" />
        </label>
        </div>
        <nav aria-label="Categorías" className="flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
          {tabs.map((c) => {
            const active = vm.activeCategoryId === c.id
            return (
              <button key={c.id ?? 'all'} type="button" onClick={() => vm.setActiveCategory(c.id)} aria-pressed={active}
                className={`min-h-10 flex-none rounded-full border px-4 text-[14px] ${active ? 'border-bosque bg-bosque font-bold text-white' : 'border-linea bg-white font-semibold text-[#44483F]'}`}>
                {c.name}
              </button>
            )
          })}
        </nav>
      </header>

      <RoundBanner />

      {vm.status === 'loading' ? (
        <main className="grid grid-cols-2 gap-3 px-5 pt-3.5" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-white/70" />)}
        </main>
      ) : (
        <main className="grid grid-cols-2 gap-3 px-5 pt-3.5">
          {vm.visibleItems.map((item) => (
            <DishCard key={item.id} item={item} href={`/mesa/${token}/platillo/${item.id}`} />
          ))}
          {vm.visibleItems.length === 0 && (
            <p className="col-span-2 py-10 text-center text-[15px] text-musgo">No encontramos platillos con ese nombre.</p>
          )}
        </main>
      )}

      {vm.cartCount > 0 && (
        <footer className="fixed inset-x-0 bottom-[max(20px,env(safe-area-inset-bottom))] z-10 mx-auto max-w-[480px] px-4">
          <Link to={`/mesa/${token}/pedido`}
            className="flex w-full items-center gap-3 rounded-[14px] bg-bosque px-[18px] py-4 text-base font-bold text-white no-underline shadow-[0_8px_24px_rgba(47,74,58,0.3)]">
            <span className="rounded-lg bg-white px-2 py-[3px] text-[13px] font-extrabold text-bosque">{vm.cartCount}</span>
            <span className="flex-1 text-left">Ver pedido</span>
            <span>{formatMoney(vm.cartTotalCents)}</span>
          </Link>
        </footer>
      )}
    </div>
  )
}
