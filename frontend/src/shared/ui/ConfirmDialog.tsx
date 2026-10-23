import { Button } from './Button'

/** In-page confirmation (never window.confirm): title, one line of consequence, cancel / confirm. */
export function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }:
  { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-carbon/40 px-4" role="presentation" onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <h2 className="m-0 text-lg font-extrabold">{title}</h2>
        <p className="mt-2 mb-5 text-sm text-musgo">{body}</p>
        <div className="flex gap-2">
          <Button variant="soft" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button className="flex-1 !bg-[#B42318]" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
