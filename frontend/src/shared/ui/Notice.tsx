/** Dismissible inline warning (conflicts, failed saves). */
export function Notice({ text, onClose }: { text: string | null; onClose?: () => void }) {
  if (!text) return null
  return (
    <div role="alert" className="mx-6 mt-4 flex items-center gap-3 rounded-xl bg-[#FFF4E5] px-4 py-3 text-sm font-semibold text-[#6F4A22]">
      <span className="flex-1">{text}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg px-3 hover:bg-white/60">Cerrar</button>
      )}
    </div>
  )
}
