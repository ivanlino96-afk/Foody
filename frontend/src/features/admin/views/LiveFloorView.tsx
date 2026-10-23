import { lazy, Suspense } from 'react'
import { formatMoney } from '../../../domain/money'
import { CloseIcon } from '../../../shared/ui/icons'
import { AdminTitle, CARD } from '../AdminLayout'
import { orderNumber, useLiveFloorViewModel, type LiveTable } from '../viewmodels/useLiveFloorViewModel'
import { ORDER_STATUS } from '../viewmodels/useOrdersViewModel'

const FloorScene = lazy(() => import('../../floor/FloorScene').then((m) => ({ default: m.FloorScene })))
const PLAN_H = 'h-[min(70vh,720px)] min-h-[440px]'

function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span role="status" className="flex items-center gap-2 text-[13px] font-medium text-musgo">
      <span className="relative flex size-2">
        {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-bosque/40 motion-reduce:hidden" />}
        <span className={`relative inline-flex size-2 rounded-full ${connected ? 'bg-bosque' : 'bg-trigo'}`} />
      </span>
      {connected ? 'Conectado' : 'Reconectando'}
    </span>
  )
}

function TableDetail({ t, onClose }: { t: LiveTable; onClose(): void }) {
  const a = t.account
  const meta = [t.area, t.row.guests_count ? `${t.row.guests_count} personas` : null,
    t.minutesOpen !== null ? `abierta hace ${t.minutesOpen} min` : null].filter(Boolean).join(' · ')
  return (
    <section aria-label={`Mesa ${t.row.code}`} className={`${CARD} flex flex-col gap-4`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 flex items-center gap-2 text-xl font-semibold">
            {t.row.code}
            <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: t.status.fg }}>
              <span className="size-2 rounded-full" style={{ background: t.status.color }} />{t.status.label}
            </span>
          </h2>
          {meta && <span className="text-[13px] text-musgo">{meta}</span>}
        </div>
        <button type="button" aria-label="Cerrar detalle" onClick={onClose}
          className="-mt-1 -mr-2 ml-auto flex size-11 flex-none items-center justify-center rounded-full text-musgo hover:bg-hoja-claro">
          <CloseIcon size={18} />
        </button>
      </div>
      {!t.open && <p className="m-0 text-sm text-musgo">Sin cuenta abierta.</p>}
      {t.open && !a && <p className="m-0 text-sm text-musgo">Cargando la cuenta…</p>}
      {a && a.rounds.length === 0 && <p className="m-0 text-sm text-musgo">Aún no piden nada.</p>}
      {a?.rounds.map((r) => (
        <div key={r.order_id} className="flex flex-col gap-1.5 border-t border-linea/70 pt-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold tabular-nums">{orderNumber(r.daily_number)}</span>
            <span className="text-musgo">Ronda {r.round_number}</span>
            <span className="ml-auto flex items-center gap-1.5 text-[13px] text-musgo">
              <span className={`size-1.5 rounded-full ${ORDER_STATUS[r.status].tone}`} />{ORDER_STATUS[r.status].label}
            </span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {r.lines.map((l, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <span className="w-6 flex-none text-musgo tabular-nums">{l.quantity}×</span>
                <span className="min-w-0 flex-1">
                  {l.item_name}
                  {(l.extras.length > 0 || l.removed.length > 0 || l.note) && (
                    <span className="block text-xs text-musgo">
                      {[...l.extras.map((e) => `+ ${e}`), ...l.removed.map((x) => `sin ${x}`), l.note].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <span className="tabular-nums">{formatMoney(l.line_total_cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {a && (
        <dl className="m-0 flex flex-col gap-1 border-t border-linea pt-3 text-sm">
          <div className="flex"><dt className="text-musgo">Consumo</dt><dd className="m-0 ml-auto tabular-nums">{formatMoney(a.subtotal_cents)}</dd></div>
          {a.paid_cents > 0 && <div className="flex"><dt className="text-musgo">Pagado</dt><dd className="m-0 ml-auto tabular-nums">{formatMoney(a.paid_cents)}</dd></div>}
          <div className="flex text-base font-semibold"><dt>Por cobrar</dt><dd className="m-0 ml-auto tabular-nums">{formatMoney(a.balance_cents)}</dd></div>
        </dl>
      )}
    </section>
  )
}

export function LiveFloorView() {
  const vm = useLiveFloorViewModel()
  const s = vm.stats
  return (
    <>
      <AdminTitle title="En vivo"><LiveDot connected={vm.connected} /></AdminTitle>
      {vm.error && <p role="alert" className="m-0 text-sm font-semibold text-[#B42318]">{vm.error}</p>}

      <section aria-label="Resumen del salón"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-linea bg-linea md:grid-cols-4">
        {[
          ['Mesas ocupadas', `${s.occupied}/${s.total}`],
          ['Comensales', String(s.guests)],
          ['Cuentas abiertas', formatMoney(s.open)],
          ['Cuentas pedidas', String(s.bills)],
        ].map(([label, value], i) => (
          <div key={label} className={`flex flex-col gap-1 px-5 py-4 ${i === 0 ? 'bg-bosque text-white' : 'bg-white'}`}>
            <span className={`text-[13px] font-medium ${i === 0 ? 'text-niebla' : 'text-musgo'}`}>{label}</span>
            <span className="text-[24px] font-semibold tracking-tight tabular-nums">{value}</span>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-2">
          <Suspense fallback={<div className={`${PLAN_H} animate-pulse rounded-[18px] bg-hoja-claro`} />}>
            <FloorScene className={PLAN_H} view="3d" areas={vm.areas} tables={vm.planTables} overlays={vm.overlays}
              selected={vm.selected ? { type: 'table', key: vm.selected.row.id } : null}
              onSelect={(sel) => vm.select(sel?.type === 'table' ? sel.key : null)} />
          </Suspense>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {vm.legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-xs text-musgo">
                <span className="size-2 rounded-full" style={{ background: l.color }} />{l.label}
              </span>
            ))}
            {vm.unplaced > 0 && <span className="ml-auto text-xs text-apagado">{vm.unplaced} mesa(s) sin lugar en el plano</span>}
          </div>
        </div>
        {vm.selected ? <TableDetail t={vm.selected} onClose={() => vm.select(null)} /> : (
          <section className={`${CARD} flex flex-col gap-2`}>
            <h2 className="m-0 text-[15px] font-semibold">Mesas con cuenta</h2>
            <p className="m-0 text-[13px] text-musgo">Toca una mesa en el plano o en la lista para ver lo que llevan.</p>
            <OpenList vm={vm} />
          </section>
        )}
      </div>
    </>
  )
}

function OpenList({ vm }: { vm: ReturnType<typeof useLiveFloorViewModel> }) {
  if (!vm.loading && vm.openTables.length === 0) return <p className="m-0 py-3 text-sm text-apagado">Ninguna mesa ocupada ahora.</p>
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {vm.openTables.map((t) => (
        <li key={t.row.id}>
          <button type="button" onClick={() => vm.select(t.row.id)}
            className="flex min-h-12 w-full items-center gap-3 rounded-[10px] px-2 text-left transition-colors hover:bg-hoja-claro">
            <span className="size-2 flex-none rounded-full" style={{ background: t.status.color }} />
            <span className="w-10 font-semibold">{t.row.code}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-musgo">{t.lastOrder ? `${t.lastOrder} · ` : ''}{t.status.label}</span>
            <span className="text-sm font-semibold tabular-nums">{formatMoney(t.total)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
