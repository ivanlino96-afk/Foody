import { Link } from 'react-router'
import { BackIcon, SearchIcon } from '../../../shared/ui/icons'
import { Notice } from '../../../shared/ui/Notice'
import { useAvailabilityViewModel } from '../viewmodels/useAvailabilityViewModel'

/** "Disponibilidad de hoy": shared by kitchen (with a back link) and admin (embedded in its layout). */
export function AvailabilityView({ backTo }: { backTo?: string }) {
  const vm = useAvailabilityViewModel()
  return (
    <div className={`flex flex-col text-carbon ${backTo ? 'min-h-dvh bg-avena' : '-mx-4 -my-6 md:-mx-[30px]'}`}>
      <header className="flex flex-wrap items-center gap-4 border-b border-linea bg-white px-6 py-3.5">
        {backTo && (
          <Link to={backTo} aria-label="Volver a cocina" className="flex size-11 items-center justify-center rounded-xl bg-avena text-carbon">
            <BackIcon />
          </Link>
        )}
        <h1 className="m-0 text-[22px] font-extrabold tracking-tight">Disponibilidad de hoy</h1>
        <span className="text-sm text-musgo">Los cambios llegan a todos los celulares en segundos</span>
        <label className="ml-auto flex h-11 w-full items-center gap-2.5 rounded-xl bg-avena px-3.5 md:w-[300px]">
          <SearchIcon aria-hidden="true" className="text-musgo" />
          <span className="sr-only">Buscar</span>
          <input value={vm.query} onChange={(e) => vm.setQuery(e.target.value)} placeholder="Buscar ingrediente, platillo o extra"
            className="flex-1 border-0 bg-transparent text-base text-carbon outline-none" />
        </label>
      </header>
      <Notice text={vm.notice} />
      <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
        {vm.tabs.map((t) => (
          <button key={t.key} type="button" aria-pressed={t.active} onClick={() => vm.setTab(t.key)}
            className={`min-h-11 rounded-[10px] px-4 text-sm font-bold ${t.active ? 'bg-carbon text-white' : 'bg-white text-carbon'}`}>
            {t.label} · {t.count}
          </button>
        ))}
        <span className="ml-auto text-sm font-bold text-[#9F1239]">{vm.offCount} sin disponibilidad</span>
      </div>
      <main className="grid flex-1 content-start gap-2.5 px-6 pt-4 pb-6 md:grid-cols-2">
        {vm.rows.map((r) => (
          <div key={r.id} className={`flex items-center gap-3.5 rounded-[14px] bg-white px-4 py-3 ${r.isAvailable ? 'shadow-[0_1px_3px_rgba(27,30,27,0.06)]' : 'ring-[1.5px] ring-[#FECDD3]'}`}>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={`text-base font-bold ${r.isAvailable ? 'text-carbon' : 'text-musgo'}`}>{r.name}</span>
              {r.impact && <span className="text-[13px] text-musgo">{r.impact}</span>}
            </div>
            <span className={`text-[13px] font-bold ${r.isAvailable ? 'text-bosque-oscuro' : 'text-[#9F1239]'}`}>
              {r.isAvailable ? 'Disponible' : 'No disponible'}
            </span>
            <button type="button" role="switch" aria-checked={r.isAvailable} aria-label={`${r.name} disponible`}
              onClick={() => void vm.toggle(r)}
              className={`flex h-8 w-14 flex-none rounded-full p-[3px] ${r.isAvailable ? 'justify-end bg-bosque' : 'justify-start bg-[#CFC8BA]'}`}>
              <span className="size-[26px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
            </button>
          </div>
        ))}
        {!vm.loading && vm.rows.length === 0 && <p className="m-0 text-sm text-musgo">Nada coincide con la búsqueda.</p>}
      </main>
    </div>
  )
}
