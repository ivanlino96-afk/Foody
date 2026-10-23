import { AdminTitle, CARD } from '../AdminLayout'
import { useOrdersViewModel, type OrderFilters } from '../viewmodels/useOrdersViewModel'

const FIELD = 'min-h-11 rounded-[10px] border border-linea bg-white px-3 text-base'
const GRID = 'grid grid-cols-[64px_56px_1fr_120px_64px_96px] items-center gap-3 md:grid-cols-[80px_80px_1fr_140px_110px_110px]'

function Rows({ vm }: { vm: ReturnType<typeof useOrdersViewModel> }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className={`${GRID} border-b border-linea py-2 text-xs font-bold tracking-wide text-musgo uppercase`}>
          <span>Orden</span><span>Mesa</span><span>Ronda</span><span>Estado</span><span>Hora</span><span className="text-right">Total</span>
        </div>
        {vm.rows.map((o) => (
          <div key={o.id} className={`${GRID} border-b border-avena py-2 text-sm`}>
            <span className="font-bold">{o.number}</span>
            <span>{o.table}</span>
            <span className="text-[#44483F]">R{o.round}{o.cancelReason ? ` · ${o.cancelReason}` : ''}</span>
            <span><span className={`rounded-md px-2 py-1 text-xs font-bold ${o.tone}`}>{o.status}</span></span>
            <span className="text-musgo">{o.time}</span>
            <span className="text-right font-bold">{o.total}</span>
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
      <AdminTitle title="Órdenes" />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm font-semibold">Desde<input type="date" className={FIELD} value={vm.filters.from} onChange={set('from')} /></label>
        <label className="flex flex-col text-sm font-semibold">Hasta<input type="date" className={FIELD} value={vm.filters.to} onChange={set('to')} /></label>
        <label className="flex flex-col text-sm font-semibold">Estado
          <select className={FIELD} value={vm.filters.status} onChange={set('status')}>
            <option value="">Todos</option>
            {vm.statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm font-semibold">Mesa<input className={`${FIELD} w-28`} placeholder="M1" value={vm.filters.table} onChange={set('table')} /></label>
      </div>
      {vm.error && <p role="alert" className="m-0 text-sm font-semibold text-[#B42318]">{vm.error}</p>}
      <section className={CARD}><Rows vm={vm} /></section>
    </>
  )
}
