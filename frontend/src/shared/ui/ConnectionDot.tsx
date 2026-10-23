/** "Conectado" / "Reconectando" pill (on the green staff header) for screens fed by Realtime with polling fallback. */
export function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-sm font-semibold ${connected ? 'text-niebla' : 'text-[#F3D9B8]'}`}
      role="status">
      <span className={`size-2 rounded-full ${connected ? 'bg-[#8FD0A0]' : 'animate-pulse bg-trigo'}`} />
      {connected ? 'Conectado' : 'Reconectando'}
    </span>
  )
}
