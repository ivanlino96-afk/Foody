export function InvalidQrView() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bosque px-8 text-center text-white">
      <span className="text-4xl font-extrabold tracking-tight">foody<span className="text-[#D6A262]">.</span></span>
      <h1 className="m-0 text-xl font-extrabold">Este QR no es válido</h1>
      <p className="m-0 max-w-xs text-[15px] text-[#D5E2D8]">Puede que la mesa haya cambiado de código. Pide ayuda al personal para escanear el QR correcto.</p>
    </main>
  )
}

export function ErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="m-0 text-xl font-extrabold">No pudimos cargar el menú</h1>
      <p className="m-0 text-[15px] text-musgo">Revisa tu conexión e intenta de nuevo.</p>
      <button type="button" onClick={onRetry} className="min-h-11 rounded-xl bg-bosque px-5 font-bold text-white">Reintentar</button>
    </main>
  )
}
