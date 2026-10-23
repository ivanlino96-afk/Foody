import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { soundReady, unlockAudio } from '../../../shared/sound'
import { ConnectionDot } from '../../../shared/ui/ConnectionDot'
import { Notice } from '../../../shared/ui/Notice'
import { StaffHeader } from '../../../shared/ui/StaffHeader'
import { useClock } from '../../../shared/useClock'
import { useKitchenBoardViewModel, type Ticket } from '../viewmodels/useKitchenBoardViewModel'

const HEAD: Record<Ticket['status'], string> = {
  received: 'bg-[#E0E7EF] text-[#2B4A6B]',
  preparing: 'bg-[#F1E6D8] text-[#6F4A22]',
  ready: 'bg-[#E4ECE6] text-bosque-oscuro',
}

function TicketCard({ t, busy, onAction }: { t: Ticket; busy: boolean; onAction: () => void }) {
  return (
    <article aria-label={`Orden ${t.number} mesa ${t.table}`}
      className={`flex flex-col overflow-hidden rounded-[14px] bg-white ${t.late ? 'ring-2 ring-[#B91C1C]' : 'shadow-[0_1px_3px_rgba(27,30,27,0.08)]'}`}>
      <div className={`flex items-center gap-2.5 px-3.5 py-2.5 ${t.late ? 'bg-[#B91C1C] text-white' : HEAD[t.status]}`}>
        <span className="text-xl font-extrabold">{t.number}</span>
        <span className="text-[15px] font-bold">{t.table}</span>
        <span className="text-[13px]">· R{t.round}</span>
        {t.late && <span className="text-xs font-bold uppercase">Tarde</span>}
        <span className="ml-auto text-[15px] font-extrabold tabular-nums">{t.elapsed}</span>
      </div>
      <div className="flex flex-col gap-2 px-3.5 py-3">
        {t.items.map((it, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex gap-2.5">
              <span className="flex size-6 flex-none items-center justify-center rounded-md bg-avena text-[15px] font-extrabold">{it.qty}</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-bold">{it.name}</span>
                {it.mods.map((m) => (
                  <span key={m.text} className={`text-[13px] font-semibold ${m.kind === 'remove' ? 'text-[#B91C1C]' : 'text-bosque'}`}>{m.text}</span>
                ))}
              </div>
            </div>
            {it.note && (
              <div className="rounded-[10px] border-[1.5px] border-dashed border-[#B98552] px-2.5 py-1.5 text-[13px] font-bold text-[#6F4A22]">{it.note}</div>
            )}
          </div>
        ))}
        {t.action ? (
          <button type="button" disabled={busy} onClick={onAction}
            className={`min-h-11 rounded-[10px] text-sm font-bold text-white disabled:opacity-60 ${t.status === 'received' ? 'bg-carbon' : 'bg-bosque'}`}>
            {busy ? 'Guardando…' : t.action}
          </button>
        ) : (
          <span className="text-center text-[13px] text-musgo">Esperando al mesero</span>
        )}
      </div>
    </article>
  )
}

export function KitchenBoardView() {
  const vm = useKitchenBoardViewModel()
  const clock = useClock()
  const [soundOn, setSoundOn] = useState(soundReady)
  useEffect(() => {
    if (soundOn) return
    // Browsers only allow audio after a gesture: the first tap anywhere on the board enables the chime.
    const unlock = () => void unlockAudio().then(() => setSoundOn(soundReady()))
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [soundOn])
  return (
    <div className="flex min-h-dvh flex-col bg-avena text-carbon">
      <StaffHeader area="kitchen">
        <span className="text-sm text-musgo">
          {vm.activeCount} {vm.activeCount === 1 ? 'orden activa' : 'órdenes activas'}
          {vm.avgPrepMinutes !== null && ` · en cocina ${vm.avgPrepMinutes} min prom.`}
        </span>
        <span className="ml-auto flex items-center gap-4">
          <ConnectionDot connected={vm.connected} />
          <span className="text-xl font-extrabold tabular-nums">{clock}</span>
          <Link to="/cocina/disponibilidad" className="flex min-h-11 items-center rounded-xl bg-avena px-4 text-sm font-bold text-carbon no-underline">
            Disponibilidad
          </Link>
        </span>
      </StaffHeader>
      <Notice text={vm.notice ?? vm.loadError} onClose={vm.notice ? vm.dismissNotice : undefined} />
      {!soundOn && (
        // Floating, so removing it on the first tap never shifts the tickets under the finger.
        <p role="status" className="pointer-events-none fixed bottom-4 left-1/2 z-10 m-0 -translate-x-1/2 rounded-full bg-carbon px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          Toca la pantalla para activar el sonido de órdenes nuevas.
        </p>
      )}
      <div className="grid flex-1 grid-cols-1 gap-4 px-6 py-5 md:grid-cols-3">
        {vm.columns.map((col) => (
          <section key={col.status} aria-label={col.title} className="flex min-h-0 flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-lg font-extrabold">{col.title}</h2>
              <span className={`rounded-lg px-2 py-0.5 text-[13px] font-bold ${HEAD[col.status]}`}>{col.tickets.length}</span>
            </div>
            {col.tickets.map((t) => (
              <TicketCard key={t.id} t={t} busy={vm.busyId === t.id}
                onAction={() => void (t.status === 'received' ? vm.start(t.id) : vm.markReady(t.id))} />
            ))}
            {!vm.loading && col.tickets.length === 0 && <p className="m-0 text-sm text-musgo">Sin órdenes</p>}
          </section>
        ))}
      </div>
    </div>
  )
}
