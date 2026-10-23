import { Link } from 'react-router'
import { formatMoney } from '../../../domain/money'
import { Badge } from '../../../shared/ui/Badge'
import { BackIcon, CheckIcon } from '../../../shared/ui/icons'
import { useDiner } from '../DinerContext'
import { useAccountViewModel } from '../viewmodels/useAccountViewModel'

function ThankYou({ tableCode }: { tableCode: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bosque px-8 text-center text-white">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-hoja text-bosque"><CheckIcon size={28} /></span>
      <h1 className="m-0 text-2xl font-extrabold">¡Gracias por tu visita!</h1>
      <p className="m-0 max-w-xs text-[15px] text-[#D5E2D8]">La cuenta de la mesa {tableCode} quedó pagada. Te esperamos pronto.</p>
    </main>
  )
}

export function AccountView() {
  const { token } = useDiner()
  const vm = useAccountViewModel()
  if (vm.closed) return <ThankYou tableCode={vm.tableCode} />

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-avena">
      <header className="flex items-center gap-3 bg-white px-5 py-4 shadow-[0_1px_0_#E3DED3]">
        <Link to={`/mesa/${token}`} aria-label="Volver al menú" className="flex h-11 w-11 items-center justify-center rounded-xl bg-arena text-carbon"><BackIcon /></Link>
        <div className="flex flex-col">
          <h1 className="m-0 text-xl font-extrabold tracking-[-0.02em]">Tu cuenta</h1>
          <span className="text-[13px] text-musgo">{vm.tableCode && `Mesa ${vm.tableCode}`}</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-4">
        {vm.error && <div role="alert" className="rounded-xl bg-[#FFF1F2] px-3.5 py-3 text-sm font-semibold text-[#9F1239]">{vm.error}</div>}
        <section className="rounded-2xl bg-white px-4 py-1.5 shadow-[0_1px_3px_rgba(27,30,27,0.06)]">
          {vm.rounds.length === 0 && (
            <p className="py-6 text-center text-[15px] text-musgo">{vm.loading ? 'Cargando…' : 'Aún no hay rondas en esta mesa.'}</p>
          )}
          {vm.rounds.map((r) => (
            <div key={r.id} className="flex flex-col gap-1.5 border-b border-arena py-3">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-extrabold">Ronda {r.number}</span>
                <Badge tone={r.tone}>{r.statusLabel}</Badge>
                <span className={`ml-auto text-[15px] font-bold ${r.status === 'cancelled' ? 'text-apagado line-through' : ''}`}>{formatMoney(r.totalCents)}</span>
              </div>
              {r.lines.map((l, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[13px] font-semibold">{l.text}</span>
                  {l.detail && <span className="text-xs text-musgo">{l.detail}</span>}
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-between py-3 text-[15px] font-bold"><span>Subtotal</span><span>{formatMoney(vm.subtotalCents)}</span></div>
        </section>

        {(vm.paidCents > 0 || vm.billRequested) && (
          <section className="flex flex-col gap-1.5 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(27,30,27,0.06)]">
            {vm.paidCents > 0 && <div className="flex justify-between text-sm text-musgo"><span>Pagado</span><span>{formatMoney(vm.paidCents)}</span></div>}
            <div className="flex justify-between text-xl font-extrabold"><span>Por pagar</span><span>{formatMoney(vm.balanceCents)}</span></div>
          </section>
        )}
      </main>

      <footer className="sticky bottom-0 flex flex-none flex-col gap-2.5 border-t border-linea bg-white px-4 pb-[max(22px,env(safe-area-inset-bottom))] pt-3.5">
        {vm.billRequested ? (
          <p role="status" className="m-0 rounded-[14px] bg-hoja-claro p-4 text-center text-[15px] font-bold text-bosque">
            Pediste la cuenta. El mesero viene en camino.
          </p>
        ) : (
          <button type="button" onClick={() => void vm.requestBill()} disabled={!vm.canRequestBill}
            className="rounded-[14px] border-0 bg-bosque p-4 text-base font-bold text-white disabled:bg-linea disabled:text-musgo">
            {vm.busy === 'request_bill' ? 'Avisando…' : 'Pedir la cuenta'}
          </button>
        )}
        <span className="text-center text-[13px] text-musgo">Paga con el mesero en efectivo o tarjeta.</span>
        <button type="button" onClick={() => void vm.callWaiter()} disabled={vm.waiterCalled}
          className="min-h-11 rounded-[14px] border-0 bg-arena p-3 text-[15px] font-bold text-carbon disabled:opacity-70">
          {vm.waiterCalled ? 'Avisamos al mesero' : 'Llamar al mesero'}
        </button>
      </footer>
    </div>
  )
}
