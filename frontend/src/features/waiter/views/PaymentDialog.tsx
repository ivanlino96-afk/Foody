import { formatMoney } from '../../../domain/money'
import type { PaymentResult } from '../../../domain/staffTypes'
import { Button } from '../../../shared/ui/Button'
import type { TableCard } from '../viewmodels/useTablesMapViewModel'
import { usePaymentViewModel } from '../viewmodels/usePaymentViewModel'

const INPUT = 'min-h-12 w-full rounded-xl border border-linea bg-white px-4 text-base text-carbon outline-none focus:border-bosque'

export function PaymentDialog({ table, onClose, onDone, onRefused }:
  { table: TableCard; onClose: () => void; onDone: (r: PaymentResult) => void; onRefused?: () => void }) {
  const vm = usePaymentViewModel(table, onDone, onRefused)
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-carbon/40 px-4" role="presentation" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label={`Registrar cobro ${table.code}`}
        className="w-full max-w-md rounded-[20px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
        onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void vm.submit() }}>
        <h2 className="m-0 text-xl font-extrabold">Registrar cobro · {table.code}</h2>
        <p className="mt-1 mb-5 text-sm text-musgo">Saldo {formatMoney(vm.balanceCents)}</p>
        <fieldset className="mb-4 flex gap-2 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold">Método</legend>
          {([['cash', 'Efectivo'], ['card_terminal', 'Terminal']] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={vm.method === value} onClick={() => vm.setMethod(value)}
              className={`min-h-11 flex-1 rounded-xl text-sm font-bold ${vm.method === value ? 'bg-carbon text-white' : 'bg-arena text-carbon'}`}>
              {label}
            </button>
          ))}
        </fieldset>
        <label className="mb-4 block text-sm font-semibold">
          Monto
          <input className={`${INPUT} mt-1`} inputMode="decimal" value={vm.amountText} onChange={(e) => vm.setAmountText(e.target.value)} />
        </label>
        <label className="mb-2 block text-sm font-semibold">
          Propina
          <input className={`${INPUT} mt-1`} inputMode="decimal" placeholder="0" value={vm.tipText}
            onChange={(e) => vm.setTipText(e.target.value)} />
        </label>
        <div className="mb-5 flex gap-2">
          {vm.tipPresets.map((t) => (
            <button key={t.label} type="button" onClick={() => vm.applyTip(t.cents)}
              className="min-h-11 flex-1 rounded-xl bg-arena text-sm font-semibold">{t.label} · {formatMoney(t.cents)}</button>
          ))}
        </div>
        {vm.error && <p role="alert" className="mb-4 text-sm font-semibold text-[#B42318]">{vm.error}</p>}
        <div className="flex gap-2">
          <Button variant="soft" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={vm.submitting}>{vm.submitting ? 'Guardando…' : 'Registrar'}</Button>
        </div>
      </form>
    </div>
  )
}
