import { SearchIcon } from '../../../shared/ui/icons'
import { AdminTitle, CARD } from '../AdminLayout'
import { useOrdersViewModel, type OrderFilters } from '../viewmodels/useOrdersViewModel'

const FIELD = 'min-h-9 rounded-full bg-white px-3 text-sm text-carbon outline-none'
const GRID = 'grid grid-cols-[64px_56px_1fr_120px_64px_96px] items-center gap-3 md:grid-cols-[80px_80px_1fr_140px_110px_110px]'

function Rows({ vm }: { vm: ReturnType<typeof useOrdersViewModel> }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className={`${GRID} border-b border-linea py-2 text-[11px] font-semibold tracking-[0.06em] text-musgo uppercase`}>
          <span>Orden</span><span>Mesa</span><span>Ronda</span><span>Estado</span><span>Hora</span><span className="text-right">Total</span>
        </div>
        {vm.rows.map((o) => (
          <div key={o.id} className={`${GRID} border-b border-linea/60 py-2.5 text-sm tabular-nums last:border-b-0`}>
            <span className="font-semibold">{o.number}</span>
            <span>{o.table}</span>
            <span className="text-musgo">R{o.round}{o.cancelReason ? ` · ${o.cancelReason}` : ''}</span>
            <span className="flex items-center gap-2"><span className={`size-1.5 flex-none rounded-full ${o.tone}`} />{o.status}</span>
            <span className="text-musgo">{o.time}</span>
            <span className="text-right font-semibold">{o.total}</span>
          </div>
        ))}
        {!vm.loading && vm.rows.length === 0 && <p className="py-4 text-sm text-musgo">No hay órdenes con estos filtros.</p>}
      </div>
    </div>
  )
}

/** Compact one-day table for the dashboard. */
export function OrdersTable({ date }: { date: string }) {
  const vm = useOrdersViewModel(date)
  return <Rows vm={vm} />
}

export function OrdersView() {
  const vm = useOrdersViewModel()
  const set = <K extends keyof OrderFilters>(k: K) => (e: { target: { value: string } }) => vm.setFilter(k, e.target.value as OrderFilters[K])
  return (
    <>
      <AdminTitle title="Órdenes">
        {!vm.loading && <span className="text-sm text-musgo tabular-nums">{vm.rows.length} {vm.rows.length === 1 ? 'orden' : 'órdenes'}</span>}
      </AdminTitle>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-hoja-claro p-1">
          <input type="date" aria-label="Desde" className={`${FIELD} !bg-transparent`} value={vm.filters.from} onChange={set('from')} />
          <span className="text-sm text-apagado" aria-hidden="true">a</span>
          <input type="date" aria-label="Hasta" className={`${FIELD} !bg-transparent`} value={vm.filters.to} onChange={set('to')} />
        </div>
        <div role="group" aria-label="Estado" className="flex gap-1 overflow-x-auto rounded-full bg-hoja-claro p-1">
          {[{ value: '', label: 'Todas' }, ...vm.statuses].map((s) => (
            <button key={s.value} type="button" aria-pressed={vm.filters.status === s.value} onClick={() => set('status')({ target: { value: s.value } })}
              className={`min-h-9 flex-none rounded-full px-4 text-sm whitespace-nowrap transition-colors ${vm.filters.status === s.value
                ? 'bg-white font-semibold text-carbon shadow-[0_1px_2px_rgba(27,30,27,0.08)]' : 'font-medium text-musgo hover:text-carbon'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 rounded-full bg-hoja-claro pl-4 text-musgo">
          <SearchIcon size={16} />
          <input aria-label="Mesa" placeholder="Mesa, ej. M1" className={`${FIELD} w-32 !bg-transparent !pl-0`} value={vm.filters.table} onChange={set('table')} />
        </label>
      </div>
      {vm.error && <p role="alert" className="m-0 text-sm font-semibold text-[#B42318]">{vm.error}</p>}
      <section className={CARD}><Rows vm={vm} /></section>
    </>
  )
}
