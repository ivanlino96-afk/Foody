import { useCallback, useState } from 'react'
import { ConnectionDot } from '../../../shared/ui/ConnectionDot'
import { Notice } from '../../../shared/ui/Notice'
import { StaffHeader } from '../../../shared/ui/StaffHeader'
import { useServiceCallsViewModel, type AlertKind } from '../viewmodels/useServiceCallsViewModel'
import { useTablesMapViewModel } from '../viewmodels/useTablesMapViewModel'
import { useWaiterFeed } from '../viewmodels/useWaiterFeed'
import { PaymentDialog } from './PaymentDialog'
import { TableSheet } from './TableSheet'

const CHIP: Record<AlertKind, string> = {
  Lista: 'bg-[#E4ECE6] text-bosque-oscuro',
  Llamada: 'bg-[#E0E7EF] text-[#2B4A6B]',
  Cuenta: 'bg-[#FFE4E6] text-[#9F1239]',
}
const ALERT_BTN: Record<AlertKind, string> = { Lista: 'bg-bosque text-white', Llamada: 'bg-avena text-carbon', Cuenta: 'bg-carbon text-white' }

export function WaiterView() {
  const feed = useWaiterFeed()
  const map = useTablesMapViewModel(feed)
  const [chargingId, setChargingId] = useState<string | null>(null)
  const onCharge = useCallback((id: string) => setChargingId(id), [])
  const calls = useServiceCallsViewModel(feed, onCharge)
  const charging = map.tables.find((t) => t.id === chargingId) ?? null

  return (
    <div className="flex min-h-dvh flex-col bg-avena text-carbon">
      <StaffHeader area="waiter">
        <span className="ml-auto flex items-center gap-4">
          <ConnectionDot connected={feed.connected} />
          <span className="text-sm text-musgo">{map.occupiedLine}</span>
        </span>
      </StaffHeader>
      <Notice text={map.notice ?? calls.notice} onClose={() => { map.dismissNotice(); calls.dismissNotice() }} />
      <div className="flex flex-1 flex-col gap-5 px-6 py-5 lg:flex-row">
        <main className="flex flex-1 flex-col gap-3.5">
          <div className="flex flex-wrap gap-3.5">
            {map.legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#44483F]">
                <span className="size-2.5 rounded-[3px]" style={{ background: l.color }} />{l.label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {map.tables.map((t) => (
              <button key={t.id} type="button" onClick={() => map.select(t.id)} aria-label={`Mesa ${t.code}, ${t.label}`}
                className={`flex h-[138px] flex-col gap-1.5 rounded-[14px] bg-white p-3.5 text-left text-carbon ${t.status === 'bill_requested' ? 'ring-2 ring-[#E11D48]' : 'shadow-[0_1px_3px_rgba(27,30,27,0.08)]'}`}>
                <span className="flex w-full items-center gap-2">
                  <span className="size-2.5 rounded-[3px]" style={{ background: t.color }} />
                  <span className="text-2xl font-extrabold tracking-tight">{t.code}</span>
                  <span className="ml-auto text-[13px] text-musgo">{t.meta}</span>
                </span>
                <span className="text-sm font-bold" style={{ color: t.fg }}>{t.label}</span>
                <span className="mt-auto text-[13px] text-musgo">{t.detail}</span>
              </button>
            ))}
          </div>
          {!map.loading && map.tables.length === 0 && <p className="text-sm text-musgo">No hay mesas dadas de alta.</p>}
        </main>
        <aside className="flex w-full flex-none flex-col gap-3 lg:w-[340px]" aria-label="Avisos">
          <h2 className="m-0 text-lg font-extrabold">Avisos · {calls.alerts.length}</h2>
          {calls.alerts.length === 0 && <p className="m-0 text-sm text-musgo">Todo en orden.</p>}
          {calls.alerts.map((a) => (
            <div key={a.key} className="flex flex-col gap-2.5 rounded-[14px] bg-white p-3.5 shadow-[0_1px_3px_rgba(27,30,27,0.08)]">
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${CHIP[a.kind]}`}>{a.kind}</span>
                <span className="text-[15px] font-extrabold">{a.table}</span>
                <span className="ml-auto text-xs text-musgo">{a.ago}</span>
              </div>
              <span className="text-sm text-[#44483F]">{a.body}</span>
              <button type="button" onClick={() => void a.run()}
                className={`min-h-11 rounded-[10px] text-sm font-bold ${ALERT_BTN[a.kind]}`}>{a.action}</button>
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
          onDone={() => { setChargingId(null); void feed.refresh().catch(() => undefined) }} />
      )}
    </div>
  )
}
