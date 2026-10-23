import { Link } from 'react-router'
import { Badge } from '../../../shared/ui/Badge'
import { BellIcon, ReceiptIcon } from '../../../shared/ui/icons'
import { IconButton } from '../../../shared/ui/IconButton'
import { useDiner } from '../DinerContext'
import { useAccountViewModel } from '../viewmodels/useAccountViewModel'

/** The latest round that is not served yet, with a link to the account (B-Menu). */
export function RoundBanner() {
  const { token } = useDiner()
  const vm = useAccountViewModel()
  const live = [...vm.rounds].reverse().find((r) => r.status !== 'served' && r.status !== 'cancelled')
  if (!live) return null
  return (
    <div className="mx-5 mt-3.5 flex items-center gap-3 rounded-xl bg-[#F7EFE3] px-3.5 py-2.5">
      <Badge tone={live.tone}>{live.statusLabel}</Badge>
      <span className="flex-1 text-sm font-semibold">Ronda {live.number}</span>
      <Link to={`/mesa/${token}/cuenta`} className="min-h-11 content-center text-sm font-bold text-bosque no-underline">Ver</Link>
    </div>
  )
}

export function MenuHeaderActions() {
  const vm = useAccountViewModel()
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <IconButton label={vm.waiterCalled ? 'Ya avisamos al mesero' : 'Llamar al mesero'} onClick={() => void vm.callWaiter()}
          aria-pressed={vm.waiterCalled} className={vm.waiterCalled ? '!bg-hoja-claro !text-bosque' : ''}>
          <BellIcon />
        </IconButton>
        <IconButton label={vm.billRequested ? 'Cuenta pedida' : 'Pedir la cuenta'} onClick={() => void vm.requestBill()}
          disabled={!vm.canRequestBill && !vm.billRequested} aria-pressed={vm.billRequested}
          className={vm.billRequested ? '!bg-hoja-claro !text-bosque' : ''}>
          <ReceiptIcon />
        </IconButton>
      </div>
      {(vm.waiterCalled || vm.error) && (
        <span role="status" className={`text-xs font-semibold ${vm.error ? 'text-[#9F1239]' : 'text-bosque'}`}>
          {vm.error ?? 'Avisamos al mesero'}
        </span>
      )}
    </div>
  )
}
