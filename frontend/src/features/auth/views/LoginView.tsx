import { Button } from '../../../shared/ui/Button'
import { useLoginViewModel } from '../viewmodels/useLoginViewModel'

const ROLE: Record<string, string> = { admin: 'Administrador', kitchen: 'Cocina', waiter: 'Mesero' }
const INPUT = 'min-h-12 w-full rounded-xl border border-linea bg-white px-4 text-base text-carbon outline-none focus:border-bosque'

export function LoginView() {
  const vm = useLoginViewModel()
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bosque px-4 py-10">
      <form className="w-full max-w-sm rounded-[20px] bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
        onSubmit={(e) => { e.preventDefault(); void vm.submit() }}>
        <p className="m-0 text-3xl font-extrabold tracking-tight text-carbon">foody<span className="text-madera">.</span></p>
        <h1 className="mt-1 mb-6 text-base font-medium text-musgo">Acceso del personal</h1>
        {vm.current && (
          <div role="status" className="mb-6 flex flex-col gap-3 rounded-xl border border-linea p-4">
            <p className="m-0 text-sm text-carbon">
              Ya tienes una sesión abierta como <strong>{vm.current.full_name}</strong> ({ROLE[vm.current.role]}).
            </p>
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={vm.proceed}>Continuar</Button>
              <button type="button" onClick={vm.switchAccount}
                className="min-h-11 flex-1 rounded-xl border border-linea text-sm font-bold text-carbon hover:bg-arena">Usar otra cuenta</button>
            </div>
          </div>
        )}
        {!vm.current && <>
        {vm.notice && !vm.error && (
          <p role="status" className="mb-4 rounded-xl bg-arena px-4 py-3 text-sm text-carbon">{vm.notice}</p>
        )}
        <label className="mb-4 block text-sm font-semibold text-carbon">
          Correo
          <input className={`${INPUT} mt-1`} type="email" autoComplete="username" value={vm.email}
            onChange={(e) => vm.setEmail(e.target.value)} />
        </label>
        <label className="mb-6 block text-sm font-semibold text-carbon">
          Contraseña
          <input className={`${INPUT} mt-1`} type="password" autoComplete="current-password" value={vm.password}
            onChange={(e) => vm.setPassword(e.target.value)} />
        </label>
        {vm.error && <p role="alert" className="mb-4 text-sm font-semibold text-[#B42318]">{vm.error}</p>}
        <Button type="submit" className="w-full" disabled={!vm.canSubmit}>
          {vm.submitting ? 'Entrando…' : 'Entrar'}
        </Button>
        </>}
      </form>
    </main>
  )
}
