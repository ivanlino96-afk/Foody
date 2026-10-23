import { useState } from 'react'
import { formatMoney } from '../../../domain/money'
import { Button } from '../../../shared/ui/Button'
import type { TableCard } from '../viewmodels/useTablesMapViewModel'

const ORDER_STATUS: Record<string, string> = { received: 'Recibida', preparing: 'Preparando', ready: 'Lista' }

interface Props {
  table: TableCard
  busy: boolean
  onClose(): void
  onOpen(guests?: number): void
  onReopen(): void
  onRelease(): void
  onRequestBill(): void
  onCharge(): void
  onServe(orderId: string): void
  onCancel(orderId: string, reason: string): void
}

/** Side sheet for one table: the actions its status allows plus its active orders. */
export function TableSheet(p: Props) {
  const { table } = p
  const [guests, setGuests] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const open = ['occupied', 'awaiting_order', 'served', 'bill_requested'].includes(table.status)

  return (
    <aside aria-label={`Mesa ${table.code}`}
      className="fixed inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col gap-4 overflow-y-auto bg-white p-6 shadow-[-12px_0_40px_rgba(0,0,0,0.15)]">
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-[3px]" style={{ background: table.color }} />
        <h2 className="m-0 text-2xl font-extrabold">{table.code}</h2>
        <span className="text-sm font-bold" style={{ color: table.fg }}>{table.label}</span>
        <button type="button" onClick={p.onClose} className="ml-auto min-h-11 rounded-xl px-3 text-sm font-semibold hover:bg-arena">Cerrar</button>
      </div>
      {open && <p className="m-0 text-sm text-musgo">Saldo {formatMoney(table.balance_cents)}</p>}

      {table.status === 'free' && (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); p.onOpen(Number(guests) || undefined) }}>
          <label className="text-sm font-semibold">
            Personas (opcional)
            <input inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value.replace(/\D/g, ''))}
              className="mt-1 min-h-12 w-full rounded-xl border border-linea px-4 text-base" />
          </label>
          <Button type="submit" disabled={p.busy}>Abrir mesa</Button>
        </form>
      )}
      {table.status === 'closed' && (
        <div className="flex flex-col gap-2">
          <Button onClick={p.onReopen} disabled={p.busy}>Reabrir mesa</Button>
          <Button variant="soft" onClick={p.onRelease} disabled={p.busy}>Liberar ahora</Button>
        </div>
      )}
      {open && (
        <div className="flex flex-col gap-2">
          <Button onClick={p.onCharge} disabled={p.busy || table.balance_cents === 0}>Registrar cobro</Button>
          {table.status !== 'bill_requested' && (
            <Button variant="soft" onClick={p.onRequestBill} disabled={p.busy}>Pedir la cuenta</Button>
          )}
        </div>
      )}

      {table.orders.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-extrabold">Órdenes activas</h3>
          {table.orders.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 rounded-xl bg-avena p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-extrabold">#{String(o.daily_number).padStart(3, '0')}</span>
                <span>R{o.round_number}</span>
                <span className="ml-auto font-semibold">{ORDER_STATUS[o.status] ?? o.status}</span>
              </div>
              <p className="m-0 text-sm text-musgo">{o.lines.map((l) => `${l.quantity} ${l.item_name}`).join(', ')}</p>
              {o.status === 'ready' && <Button onClick={() => p.onServe(o.id)} disabled={p.busy}>Marcar servida</Button>}
              {cancelling === o.id ? (
                <form className="flex flex-col gap-2" onSubmit={(e) => {
                  e.preventDefault()
                  if (!reason.trim()) return
                  p.onCancel(o.id, reason.trim())
                  setCancelling(null)
                  setReason('')
                }}>
                  <label className="text-sm font-semibold">
                    Motivo de la cancelación
                    <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)}
                      className="mt-1 min-h-12 w-full rounded-xl border border-linea bg-white px-4 text-base" />
                  </label>
                  <div className="flex gap-2">
                    <Button variant="soft" className="flex-1" onClick={() => setCancelling(null)}>Volver</Button>
                    <Button type="submit" className="flex-1" disabled={!reason.trim() || p.busy}>Cancelar orden</Button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setCancelling(o.id)}
                  className="min-h-11 self-start rounded-lg px-2 text-sm font-semibold text-[#B42318]">Cancelar orden</button>
              )}
            </div>
          ))}
        </section>
      )}
    </aside>
  )
}
