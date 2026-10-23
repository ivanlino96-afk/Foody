/** "Conectado" / "Reconectando" pill for screens fed by Realtime with polling fallback. */
export function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-sm font-semibold ${connected ? 'text-bosque-oscuro' : 'text-[#6F4A22]'}`}
      role="status">
      <span className={`size-2 rounded-full ${connected ? 'bg-[#5E8C6A]' : 'animate-pulse bg-[#B98552]'}`} />
      {connected ? 'Conectado' : 'Reconectando'}
    </span>
  )
}
