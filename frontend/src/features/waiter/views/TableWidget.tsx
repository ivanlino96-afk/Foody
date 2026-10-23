import { formatMoney } from '../../../domain/money'
import { BellIcon, ReceiptIcon } from '../../../shared/ui/icons'
import { KindIcon } from '../../floor/KindIcon'
import type { TableCard } from '../viewmodels/useTablesMapViewModel'

const SEGMENTS = [
  ['served', '#2F4A3A'],
  ['ready', '#5E8C6A'],
  ['preparing', '#B98552'],
  ['received', '#D9CFBE'],
] as const

function Clock() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  )
}

function elapsed(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/** One table on the waiter screen: status rail, timer, people, order progress, money and pending calls. */
export function TableWidget({ t, onSelect }: { t: TableCard; onSelect(id: string): void }) {
  const total = t.progress.served + t.progress.ready + t.progress.preparing + t.progress.received
  const urgent = t.status === 'bill_requested'
  const late = t.open && t.minutes >= 90
  return (
    <button type="button" onClick={() => onSelect(t.id)} aria-label={`Mesa ${t.code}, ${t.label}`}
      className={`group relative flex min-h-[176px] flex-col gap-2.5 overflow-hidden rounded-2xl bg-white py-3.5 pr-3.5 pl-5 text-left text-carbon transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(27,30,27,0.12)] ${
        urgent ? 'ring-2 ring-[#E11D48]' : 'border border-linea'} `}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: t.color }} />
      <span className="flex w-full items-start gap-2">
        <span className="flex flex-col">
          <span className="flex items-center gap-1.5">
            <span className="text-[26px] leading-none font-extrabold tracking-tight">{t.code}</span>
            <span className="text-musgo" title={t.kindLabel}><KindIcon kind={t.kind} size={18} /></span>
          </span>
          <span className="mt-1 text-xs font-semibold text-musgo">{[t.meta, t.people].filter(Boolean).join(' · ')}</span>
        </span>
        {t.open && (
          <span className={`ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${late ? 'bg-[#FFE4E6] text-[#9F1239]' : 'bg-arena text-[#44483F]'}`}>
            <Clock />{elapsed(t.minutes)}
          </span>
        )}
      </span>

      <span className="flex items-center gap-1.5">
        <span className="rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: `${t.color}22`, color: t.fg }}>{t.label}</span>
        {t.pending_calls > 0 && (
          <span className="flex items-center gap-1 rounded-md bg-[#E0E7EF] px-1.5 py-0.5 text-xs font-bold text-[#2B4A6B]">
            <BellIcon size={12} />Llamó
          </span>
        )}
        {urgent && (
          <span className="flex items-center gap-1 rounded-md bg-[#FFE4E6] px-1.5 py-0.5 text-xs font-bold text-[#9F1239]">
            <ReceiptIcon size={12} />Cuenta
          </span>
        )}
      </span>

      {t.open && total > 0 ? (
        <span className="flex flex-col gap-1">
          <span className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-arena" aria-hidden="true">
            {SEGMENTS.map(([k, color]) => t.progress[k] > 0 && (
              <span key={k} className="h-full" style={{ background: color, flex: t.progress[k] }} />
            ))}
          </span>
          <span className="text-xs font-semibold text-[#44483F]">{t.progressLine}</span>
        </span>
      ) : (
        <span className="text-[13px] text-musgo">{t.open ? t.detail : t.kindLabel}</span>
      )}

      <span className="mt-auto flex items-end gap-2 border-t border-linea pt-2">
        {t.open ? (
          <>
            <span className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-wide text-musgo uppercase">Consumo</span>
              <span className="text-[15px] font-extrabold">{formatMoney(t.consumed_cents)}</span>
            </span>
            {t.balance_cents !== t.consumed_cents && (
              <span className="ml-auto flex flex-col items-end">
                <span className="text-[11px] font-semibold tracking-wide text-musgo uppercase">Saldo</span>
                <span className="text-[15px] font-extrabold" style={{ color: t.balance_cents > 0 ? t.fg : undefined }}>{formatMoney(t.balance_cents)}</span>
              </span>
            )}
          </>
        ) : (
          <span className="text-[13px] font-semibold text-musgo group-hover:text-bosque">
            {t.status === 'free' ? 'Toca para abrir' : `${t.detail} · toca para liberar`}
          </span>
        )}
      </span>
    </button>
  )
}
