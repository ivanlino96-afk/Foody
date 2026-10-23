import { Link, useNavigate } from 'react-router'
import { formatMoney } from '../../../domain/money'
import { Badge } from '../../../shared/ui/Badge'
import { AlertIcon, BackIcon, MinusIcon, PlusIcon } from '../../../shared/ui/icons'
import { useDiner } from '../DinerContext'
import { useCartViewModel } from '../viewmodels/useCartViewModel'

export function CartView() {
  const vm = useCartViewModel()
  const { token, table } = useDiner()
  const navigate = useNavigate()
  const menuHref = `/mesa/${token}`

  const onSend = async () => {
    if (await vm.send()) navigate(`/mesa/${token}/cuenta`)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-avena">
      <header className="flex items-center gap-3 bg-white px-5 py-4 shadow-[0_1px_0_#E3DED3]">
        <Link to={menuHref} aria-label="Volver al menú" className="flex h-11 w-11 items-center justify-center rounded-xl bg-arena text-carbon"><BackIcon /></Link>
        <div className="flex flex-col">
          <h1 className="m-0 text-xl font-extrabold tracking-[-0.02em]">Tu pedido</h1>
          <span className="text-[13px] text-musgo">{table ? `Mesa ${table.code} · ronda ${vm.roundNumber}` : ''}</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-4">
        {vm.error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-[#FFF1F2] px-3.5 py-3 text-[#9F1239]">
            <AlertIcon className="mt-px flex-none" />
            <span className="text-sm font-semibold leading-snug">{vm.error}</span>
          </div>
        )}
        {vm.priceChangedTo !== null && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-[#F7EFE3] px-3.5 py-3 text-[#6F4A22]">
            <AlertIcon className="mt-px flex-none" />
            <span className="text-sm font-semibold leading-snug">
              Un precio cambió. El total de esta ronda ahora es {formatMoney(vm.priceChangedTo)}. Confirma para enviarla.
            </span>
          </div>
        )}

        <section className="rounded-2xl bg-white px-4 py-1 shadow-[0_1px_3px_rgba(27,30,27,0.06)]">
          {vm.lines.length === 0 && <p className="py-6 text-center text-[15px] text-musgo">Aún no agregas platillos.</p>}
          {vm.lines.map((l) => (
            <div key={l.key} className="flex gap-3 border-b border-arena py-3.5">
              <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg text-sm font-extrabold ${l.unavailable ? 'bg-arena text-apagado' : 'bg-hoja-claro text-bosque'}`}>{l.quantity}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className={`text-[15px] font-bold ${l.unavailable ? 'text-apagado' : ''}`}>{l.name}</span>
                {l.mods.map((m) => <span key={m} className="text-[13px] text-musgo">{m}</span>)}
                <div className="mt-1 flex items-center gap-2">
                  {l.unavailable ? (
                    <>
                      <Badge tone="danger">No disponible</Badge>
                      <button type="button" onClick={() => vm.remove(l.key)}
                        className="rounded-lg border border-[#FECDD3] bg-white px-2.5 py-1.5 text-[13px] font-bold text-[#9F1239]">Quitar</button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label={`Uno menos de ${l.name}`} onClick={() => vm.changeQty(l.key, l.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-arena text-carbon"><MinusIcon size={14} /></button>
                      <button type="button" aria-label={`Uno más de ${l.name}`} onClick={() => vm.changeQty(l.key, l.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-arena text-carbon"><PlusIcon size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
              <span className={`text-[15px] font-bold ${l.unavailable ? 'text-apagado' : ''}`}>{formatMoney(l.totalCents)}</span>
            </div>
          ))}
          <Link to={menuHref} className="flex items-center gap-2 py-3.5 text-sm font-bold text-bosque no-underline">
            <PlusIcon size={18} />Agregar más platillos
          </Link>
        </section>

        <section className="flex flex-col gap-2 rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(27,30,27,0.06)]">
          <div className="flex justify-between text-sm text-musgo"><span>Esta ronda</span><span className="font-bold text-carbon">{formatMoney(vm.roundCents)}</span></div>
          {vm.previousRoundsCents > 0 && (
            <div className="flex justify-between text-sm text-musgo"><span>Rondas anteriores</span><span>{formatMoney(vm.previousRoundsCents)}</span></div>
          )}
          <div className="flex justify-between border-t border-arena pt-2 text-base font-extrabold"><span>Cuenta de la mesa</span><span>{formatMoney(vm.tableCents)}</span></div>
          <span className="text-xs text-musgo">El restaurante confirma el total al enviar.</span>
        </section>
      </main>

      <footer className="sticky bottom-0 flex flex-none flex-col gap-2 border-t border-linea bg-white px-4 pb-[22px] pt-3.5">
        <button type="button" disabled={!vm.canSend} onClick={onSend}
          className="flex justify-between rounded-[14px] border-0 bg-bosque p-4 text-base font-bold text-white disabled:bg-linea disabled:text-musgo">
          <span>{vm.sending ? 'Enviando…' : vm.priceChangedTo !== null ? 'Confirmar y enviar' : 'Enviar a cocina'}</span>
          <span>{formatMoney(vm.priceChangedTo ?? vm.roundCents)}</span>
        </button>
        {vm.blockReason && vm.lines.length > 0 && <span className="text-center text-[13px] text-musgo">{vm.blockReason}</span>}
      </footer>
    </div>
  )
}
