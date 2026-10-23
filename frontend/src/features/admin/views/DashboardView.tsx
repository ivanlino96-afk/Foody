import { Link } from 'react-router'
import { longDate } from '../../../shared/time'
import { AdminTitle, CARD } from '../AdminLayout'
import { useDashboardViewModel } from '../viewmodels/useDashboardViewModel'
import { OrdersTable } from './OrdersView'

const SECTION_TITLE = 'm-0 text-[15px] font-semibold'
const LINK = 'text-sm font-semibold text-bosque no-underline hover:underline'

function LiveStatus({ connected }: { connected: boolean }) {
  return (
    <span role="status" className="flex items-center gap-2 text-[13px] font-medium text-musgo">
      <span className="relative flex size-2">
        {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-bosque/40 motion-reduce:hidden" />}
        <span className={`relative inline-flex size-2 rounded-full ${connected ? 'bg-bosque' : 'bg-trigo'}`} />
      </span>
      {connected ? 'En vivo' : 'Reconectando'}
    </span>
  )
}

export function DashboardView() {
  const vm = useDashboardViewModel()
  const peak = vm.bars.find((b) => b.peak)
  const kitchen = vm.now?.slice(0, 3) ?? []
  const bills = vm.now?.[3]
  const inKitchen = kitchen.reduce((n, k) => n + k.n, 0)
  return (
    <>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <AdminTitle title="Dashboard">{vm.live && <LiveStatus connected={vm.connected} />}</AdminTitle>
          <p className="m-0 text-sm text-musgo first-letter:uppercase">{longDate(vm.date)}</p>
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm font-medium text-musgo">
          Día
          <input type="date" value={vm.date} onChange={(e) => vm.setDate(e.target.value)}
            className="min-h-11 rounded-[10px] border border-linea bg-white px-3 text-base text-carbon" />
        </label>
      </div>
      {vm.error && <p role="alert" className="m-0 text-sm font-semibold text-[#B42318]">{vm.error}</p>}

      <section aria-label="Indicadores del día"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-linea bg-linea md:grid-cols-3 xl:grid-cols-[1.35fr_repeat(5,1fr)]">
        {vm.kpis.map((k, i) => (
          <div key={k.label} className={`flex min-w-0 flex-col gap-1 px-5 py-4 last:col-span-2 md:last:col-span-1 ${i === 0 ? 'col-span-2 bg-bosque text-white md:col-span-1' : 'bg-white'}`}>
            <span className={`text-[13px] font-medium ${i === 0 ? 'text-niebla' : 'text-musgo'}`}>{k.label}</span>
            <span className={`truncate font-semibold tracking-tight tabular-nums ${i === 0 ? 'text-[30px]' : 'text-[24px]'}`}>{k.value}</span>
            <span className={`text-xs ${k.alert ? 'font-semibold text-[#B42318]' : i === 0 ? 'text-niebla' : 'text-musgo'}`}>{k.sub}</span>
          </div>
        ))}
      </section>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={`${CARD} flex flex-col gap-4`}>
          <div className="flex items-baseline gap-3">
            <h2 className={SECTION_TITLE}>Ventas por hora</h2>
            {peak && <span className="ml-auto text-[13px] text-musgo">Pico a las <span className="font-semibold text-carbon">{peak.hour}</span> · {peak.label}</span>}
          </div>
          {vm.bars.length === 0 ? (
            <p className="m-0 flex min-h-[200px] items-center justify-center text-sm text-musgo">Aún no hay ventas este día.</p>
          ) : (
            <>
              <div className="flex min-h-[200px] flex-1 gap-3">
                <div aria-hidden="true" className="flex w-10 flex-none flex-col justify-between text-right text-[11px] text-apagado tabular-nums">
                  {vm.scale.map((s) => <span key={s} className="-translate-y-1/2 last:translate-y-1/2">{s}</span>)}
                </div>
                <div role="img" aria-label={`Ventas por hora, pico a las ${peak?.hour} con ${peak?.label}`}
                  className="relative flex flex-1 items-end gap-1.5">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                    <span className="border-t border-dashed border-linea" />
                    <span className="border-t border-dashed border-linea" />
                    <span className="border-t border-linea" />
                  </div>
                  {vm.bars.map((b) => (
                    <div key={b.hour} title={`${b.hour}: ${b.label}`} className="group relative flex h-full flex-1 items-end justify-center">
                      <div className={`w-full max-w-9 rounded-t-[3px] transition-colors ${b.peak ? 'bg-bosque' : 'bg-niebla group-hover:bg-[#B4CABA]'}`}
                        style={{ height: `${Math.max(b.pct, b.pct > 0 ? 2 : 0)}%` }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3" aria-hidden="true">
                <span className="w-10 flex-none" />
                <div className="flex flex-1 gap-1.5">
                  {vm.bars.map((b) => (
                    <span key={b.hour} className={`flex-1 text-center text-[11px] tabular-nums ${b.peak ? 'font-semibold text-carbon' : 'text-apagado'}`}>{b.hour}</span>
                  ))}
                </div>
              </div>
              <table className="sr-only">
                <caption>Ventas por hora</caption>
                <tbody>{vm.bars.map((b) => <tr key={b.hour}><th>{b.hour}</th><td>{b.label}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </section>

        <section className={`${CARD} flex flex-col gap-4`}>
          <div className="flex items-baseline gap-3">
            <h2 className={SECTION_TITLE}>Ahora mismo</h2>
            {vm.now && <span className="ml-auto text-[13px] text-musgo tabular-nums">{inKitchen} en cocina</span>}
          </div>
          {vm.now ? (
            <>
              <div aria-hidden="true" className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-hoja-claro">
                {inKitchen > 0 && kitchen.map((k) => k.n > 0 && (
                  <span key={k.label} style={{ flexGrow: k.n, background: k.color }} />
                ))}
              </div>
              <ul className="m-0 flex list-none flex-col p-0">
                {kitchen.map((k) => (
                  <li key={k.label} className="flex items-center gap-2.5 border-b border-linea/70 py-2.5 last:border-b-0">
                    <span className="size-2 rounded-full" style={{ background: k.color }} />
                    <span className="text-sm">{k.label}</span>
                    <span className="ml-auto text-base font-semibold tabular-nums">{k.n}</span>
                  </li>
                ))}
              </ul>
              {bills && (
                <div className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 ${bills.n > 0 ? 'bg-[#FDF0EE] text-[#8A1C12]' : 'bg-hoja-claro text-musgo'}`}>
                  <span className="text-sm font-medium">{bills.label}</span>
                  <span className="ml-auto text-base font-semibold tabular-nums">{bills.n}</span>
                </div>
              )}
            </>
          ) : <p className="m-0 text-sm text-musgo">Solo se muestra para el día de hoy.</p>}
          {vm.cancelReasons.length > 0 && (
            <p className="m-0 text-xs leading-relaxed text-musgo">Cancelaciones: {vm.cancelReasons.join(' · ')}</p>
          )}
          <Link to="/cocina" className={`${LINK} mt-auto`}>Abrir tablero de cocina</Link>
        </section>
      </div>

      <section className={`${CARD} flex flex-col gap-2`}>
        <div className="flex items-baseline gap-2">
          <h2 className={SECTION_TITLE}>Órdenes del día</h2>
          <Link to="/admin/ordenes" className={`${LINK} ml-auto`}>Ver historial</Link>
        </div>
        <OrdersTable date={vm.date} />
      </section>
    </>
  )
}
