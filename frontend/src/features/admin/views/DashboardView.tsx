import { Link } from 'react-router'
import { AdminTitle, CARD } from '../AdminLayout'
import { useDashboardViewModel } from '../viewmodels/useDashboardViewModel'
import { OrdersTable } from './OrdersView'

export function DashboardView() {
  const vm = useDashboardViewModel()
  const peak = vm.bars.find((b) => b.peak)
  return (
    <>
      <AdminTitle title="Dashboard">
        {vm.live && <span className="rounded-md bg-[#E4ECE6] px-2 py-1 text-xs font-bold text-bosque-oscuro">EN VIVO</span>}
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
          Día
          <input type="date" value={vm.date} onChange={(e) => vm.setDate(e.target.value)}
            className="min-h-11 rounded-[10px] border border-linea bg-white px-3 text-base" />
        </label>
      </AdminTitle>
      {vm.error && <p role="alert" className="m-0 text-sm font-semibold text-[#B42318]">{vm.error}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {vm.kpis.map((k) => (
          <div key={k.label} className={`${CARD} flex flex-col gap-1.5 !p-4`}>
            <span className="text-[13px] font-semibold text-musgo">{k.label}</span>
            <span className="text-[26px] font-extrabold tracking-tight">{k.value}</span>
            <span className={`text-xs font-semibold ${k.alert ? 'text-[#B91C1C]' : 'text-musgo'}`}>{k.sub}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 lg:h-[300px] lg:flex-row">
        <section className={`${CARD} flex flex-[2] flex-col gap-3`}>
          <h2 className="m-0 text-base font-bold">Ventas por hora</h2>
          {vm.bars.length === 0 ? (
            <p className="m-0 flex flex-1 items-center justify-center py-10 text-sm text-musgo">Aún no hay ventas este día.</p>
          ) : (
            <>
              <div role="img" aria-label={`Ventas por hora, pico a las ${peak?.hour} con ${peak?.label}`}
                className="flex min-h-[180px] flex-1 items-end gap-0.5 border-b border-linea">
                {vm.bars.map((b) => (
                  <div key={b.hour} title={`${b.hour}: ${b.label}`} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className={`text-xs ${b.peak ? 'font-bold text-carbon' : 'text-musgo opacity-0 group-hover:opacity-100'}`}>{b.label}</span>
                    <div className={`w-full max-w-12 rounded-t ${b.peak ? 'bg-bosque' : 'bg-[#C9D8CD] group-hover:bg-[#9DB8A5]'}`}
                      style={{ height: `${Math.max(b.pct, b.pct > 0 ? 2 : 0) * 0.85}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-0.5" aria-hidden="true">
                {vm.bars.map((b) => <span key={b.hour} className="flex-1 text-center text-xs text-musgo">{b.hour}</span>)}
              </div>
              <table className="sr-only">
                <caption>Ventas por hora</caption>
                <tbody>{vm.bars.map((b) => <tr key={b.hour}><th>{b.hour}</th><td>{b.label}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </section>
        <section className={`${CARD} flex flex-1 flex-col gap-3.5`}>
          <h2 className="m-0 text-base font-bold">Ahora mismo</h2>
          {vm.now ? vm.now.map((n) => (
            <div key={n.label} className="flex items-center gap-2.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: n.color }} />
              <span className="text-sm font-semibold">{n.label}</span>
              <span className="ml-auto text-xl font-extrabold">{n.n}</span>
            </div>
          )) : <p className="m-0 text-sm text-musgo">Solo se muestra para el día de hoy.</p>}
          {vm.cancelReasons.length > 0 && (
            <p className="m-0 text-xs text-musgo">Cancelaciones: {vm.cancelReasons.join(' · ')}</p>
          )}
          <Link to="/cocina" className="mt-auto text-sm font-bold text-bosque no-underline">Abrir tablero de cocina</Link>
        </section>
      </div>
      <section className={`${CARD} flex flex-col gap-1.5`}>
        <div className="flex items-center gap-2">
          <h2 className="m-0 text-base font-bold">Órdenes del día</h2>
          <Link to="/admin/ordenes" className="ml-auto text-sm font-bold text-bosque no-underline">Ver historial</Link>
        </div>
        <OrdersTable date={vm.date} />
      </section>
    </>
  )
}
