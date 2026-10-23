import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import type { FloorTable } from '../../../domain/floor'
import { ConnectionDot } from '../../../shared/ui/ConnectionDot'
import { Notice } from '../../../shared/ui/Notice'
import { StaffHeader } from '../../../shared/ui/StaffHeader'
import type { TableOverlay } from '../../floor/FloorScene'
import { useFloorAreas } from '../viewmodels/useFloorAreas'
import { useServiceCallsViewModel, type AlertKind } from '../viewmodels/useServiceCallsViewModel'
import { useTablesMapViewModel, type TableCard } from '../viewmodels/useTablesMapViewModel'
import { useWaiterFeed } from '../viewmodels/useWaiterFeed'
import { PaymentDialog } from './PaymentDialog'
import { TableSheet } from './TableSheet'
import { TableWidget } from './TableWidget'

const FloorScene = lazy(() => import('../../floor/FloorScene').then((m) => ({ default: m.FloorScene })))

const CHIP: Record<AlertKind, string> = {
  Lista: 'bg-[#E4ECE6] text-bosque-oscuro',
  Llamada: 'bg-[#E0E7EF] text-[#2B4A6B]',
  Cuenta: 'bg-[#FFE4E6] text-[#9F1239]',
}
const ALERT_BTN: Record<AlertKind, string> = { Lista: 'bg-bosque text-white', Llamada: 'bg-arena text-carbon', Cuenta: 'bg-carbon text-white' }
const SEG = (on: boolean) => `min-h-10 rounded-lg px-3.5 text-sm font-bold ${on ? 'bg-white text-carbon shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-musgo'}`

type Mode = 'cards' | 'plan'
const MODE_KEY = 'foody.waiter.mode'

function savedMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'plan' ? 'plan' : 'cards'
  } catch {
    return 'cards'
  }
}

function toFloorTable(t: TableCard): FloorTable {
  return { id: t.id, key: t.id, code: t.code, label: t.label, capacity: t.capacity ?? 4, kind: t.kind ?? 'table',
    pos_x: t.pos_x, pos_y: t.pos_y, rotation: t.rotation ?? 0 }
}

export function WaiterView() {
  const feed = useWaiterFeed()
  const map = useTablesMapViewModel(feed)
  const areas = useFloorAreas()
  const [chargingId, setChargingId] = useState<string | null>(null)
  const onCharge = useCallback((id: string) => setChargingId(id), [])
  const calls = useServiceCallsViewModel(feed, onCharge)
  const charging = map.tables.find((t) => t.id === chargingId) ?? null
  const [mode, setModeState] = useState<Mode>(savedMode)
  const [areaFilter, setAreaFilter] = useState<string | null>(null)
  const setMode = (m: Mode) => {
    setModeState(m)
    try { localStorage.setItem(MODE_KEY, m) } catch { /* private mode: the choice lasts this visit */ }
  }

  // Tables grouped by the admin's areas, in plan order; tables without an area go last under their zone name.
  const groups = useMemo(() => {
    const list = areas.map((a) => ({ key: a.key, name: a.name, tables: map.tables.filter((t) => t.area_id === a.id) }))
    const rest = map.tables.filter((t) => !t.area_id || !areas.some((a) => a.id === t.area_id))
    if (rest.length) list.push({ key: 'rest', name: areas.length ? 'Otras mesas' : 'Mesas', tables: rest })
    return list.filter((g) => g.tables.length > 0)
  }, [areas, map.tables])
  const shown = groups.filter((g) => !areaFilter || g.key === areaFilter)

  const planTables = useMemo(() => map.tables.filter((t) => t.pos_x !== null && t.pos_y !== null).map(toFloorTable), [map.tables])
  const overlays = useMemo(() => Object.fromEntries(map.tables.map((t): [string, TableOverlay] => [t.id, {
    color: t.status === 'free' ? '#FBFAF7' : t.color, badge: t.badge?.text, badgeColor: t.badge?.color,
  }])), [map.tables])
  const unplaced = map.tables.length - planTables.length
  const s = map.stats

  return (
    <div className="flex min-h-dvh flex-col bg-avena text-carbon">
      <StaffHeader area="waiter">
        <span className="ml-auto flex items-center gap-4">
          <ConnectionDot connected={feed.connected} />
          <span className="text-sm text-niebla">{map.occupiedLine}</span>
        </span>
      </StaffHeader>
      <Notice text={map.notice ?? calls.notice ?? feed.error}
        onClose={map.notice || calls.notice ? () => { map.dismissNotice(); calls.dismissNotice() } : undefined} />
      <div className="flex flex-1 flex-col gap-5 px-6 py-5 lg:flex-row">
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Resumen del servicio">
            {[
              ['Mesas ocupadas', `${s.occupied}/${s.total}`, s.total ? Math.round((s.occupied / s.total) * 100) : 0],
              ['Comensales', String(s.guests), s.seats ? Math.round((s.guests / s.seats) * 100) : 0],
              ['Listas para servir', String(s.ready), null],
              ['Cuentas pedidas', String(s.bills), null],
            ].map(([label, value, pct]) => (
              <div key={label as string} className="flex flex-col gap-1 rounded-2xl bg-white px-4 py-3 border border-linea">
                <span className="text-xs font-semibold text-musgo">{label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold tracking-tight">{value}</span>
                  {pct !== null && <span className="text-xs font-bold text-bosque">{pct}%</span>}
                </span>
                {pct !== null && (
                  <span className="h-1 overflow-hidden rounded-full bg-arena"><span className="block h-full rounded-full bg-bosque" style={{ width: `${pct}%` }} /></span>
                )}
              </div>
            ))}
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-[10px] bg-arena p-1" role="group" aria-label="Vista de mesas">
              <button type="button" className={SEG(mode === 'cards')} aria-pressed={mode === 'cards'} onClick={() => setMode('cards')}>Tarjetas</button>
              <button type="button" className={SEG(mode === 'plan')} aria-pressed={mode === 'plan'} onClick={() => setMode('plan')}>Plano 3D</button>
            </div>
            {mode === 'cards' && groups.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {[{ key: null, name: 'Todas' }, ...groups].map((g) => (
                  <button key={g.key ?? 'all'} type="button" onClick={() => setAreaFilter(g.key)} aria-pressed={areaFilter === g.key}
                    className={`min-h-10 rounded-full px-3.5 text-[13px] font-bold ${areaFilter === g.key ? 'border border-bosque bg-bosque text-white' : 'border border-linea bg-white text-[#44483F]'}`}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}
            <div className="ml-auto flex flex-wrap gap-3">
              {map.legend.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#44483F]">
                  <span className="size-2.5 rounded-[3px]" style={{ background: l.color }} />{l.label}
                </span>
              ))}
            </div>
          </div>

          {mode === 'plan' ? (
            <div className="flex flex-col gap-2">
              <Suspense fallback={<div className="h-[min(68vh,700px)] min-h-[420px] animate-pulse rounded-[18px] bg-arena" />}>
                <FloorScene className="h-[min(68vh,700px)] min-h-[420px]" view="3d" areas={areas} tables={planTables}
                  overlays={overlays} selected={map.selected ? { type: 'table', key: map.selected.id } : null}
                  onSelect={(sel) => map.select(sel?.type === 'table' ? sel.key : null)} />
              </Suspense>
              {unplaced > 0 && (
                <p className="m-0 text-[13px] text-musgo">{unplaced} mesa(s) aún no están en el plano; búscalas en Tarjetas.</p>
              )}
            </div>
          ) : (
            shown.map((g) => {
              const busy = g.tables.filter((t) => t.open).length
              return (
                <section key={g.key} className="flex flex-col gap-2.5" aria-label={g.name}>
                  {groups.length > 1 && (
                    <h2 className="m-0 flex items-baseline gap-2 text-base font-extrabold">
                      {g.name}<span className="text-[13px] font-semibold text-musgo">{busy}/{g.tables.length} ocupadas</span>
                    </h2>
                  )}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {g.tables.map((t) => <TableWidget key={t.id} t={t} onSelect={map.select} />)}
                  </div>
                </section>
              )
            })
          )}
          {!map.loading && map.tables.length === 0 && <p className="text-sm text-musgo">No hay mesas dadas de alta.</p>}
        </main>
        <aside className="flex w-full flex-none flex-col gap-3 lg:w-[340px]" aria-label="Avisos">
          <h2 className="m-0 text-lg font-extrabold">Avisos · {calls.alerts.length}</h2>
          {calls.alerts.length === 0 && !feed.loading && !feed.error && <p className="m-0 text-sm text-musgo">Todo en orden.</p>}
          {calls.alerts.map((a) => (
            <div key={a.key} className="flex flex-col gap-2.5 rounded-[14px] bg-white p-3.5 border border-linea">
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${CHIP[a.kind]}`}>{a.kind}</span>
                <span className="text-[15px] font-extrabold">{a.table}</span>
                <span className="ml-auto text-xs text-musgo">{a.ago}</span>
              </div>
              <span className="text-sm text-[#44483F]">{a.body}</span>
              <button type="button" onClick={() => void a.run()} disabled={calls.busyKey === a.key}
                className={`min-h-11 rounded-[10px] text-sm font-bold disabled:opacity-60 ${ALERT_BTN[a.kind]}`}>
                {calls.busyKey === a.key ? 'Guardando…' : a.action}
              </button>
            </div>
          ))}
        </aside>
      </div>
      {map.selected && (
        <TableSheet table={map.selected} busy={map.busy} onClose={() => map.select(null)}
          onOpen={(g) => void map.open(g)} onReopen={() => void map.reopen()} onRelease={() => void map.release()}
          onRequestBill={() => void map.requestBill()} onCharge={() => setChargingId(map.selected!.id)}
          onServe={(id) => void map.serve(id)} onCancel={(id, r) => void map.cancel(id, r)} />
      )}
      {charging && (
        <PaymentDialog key={charging.id} table={charging} onClose={() => setChargingId(null)}
          onRefused={() => void feed.refresh().catch(() => undefined)}
          onDone={() => { setChargingId(null); void feed.refresh().catch(() => undefined) }} />
      )}
    </div>
  )
}
