import { lazy, Suspense, useEffect, useState } from 'react'
import { AREA_KINDS, TABLE_KINDS, type AreaKind, type TableKind } from '../../../domain/floor'
import { Notice } from '../../../shared/ui/Notice'
import { MinusIcon, PlusIcon } from '../../../shared/ui/icons'
import { KindIcon } from '../../floor/KindIcon'
import { AdminTitle, CARD } from '../AdminLayout'
import { useFloorEditorViewModel, type FloorEditorViewModel } from '../viewmodels/useFloorEditorViewModel'
import { INPUT } from './fields'

const FloorScene = lazy(() => import('../../floor/FloorScene').then((m) => ({ default: m.FloorScene })))

const TABLE_ORDER: TableKind[] = ['table', 'round', 'bar', 'high', 'booth']
const AREA_ORDER: AreaKind[] = ['salon', 'jardin', 'roof', 'terraza', 'barra', 'privado', 'otro']
const AREA_DOT: Record<AreaKind, string> = {
  salon: '#CFC8BA', jardin: '#8FB79A', roof: '#C9A27A', terraza: '#D9C3A0', barra: '#77736A', privado: '#A79BB8', otro: '#B8B2A6',
}
const CHIP = 'flex min-h-10 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-semibold'
const SEG = (on: boolean) => `min-h-9 rounded-lg px-3 text-[13px] font-bold ${on ? 'bg-white text-carbon shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-musgo'}`

/** Number input in meters that commits on blur or Enter, so half-typed values do not move the model. */
function MeterInput({ label, value, min, onCommit }: { label: string; value: number; min: number; onCommit(v: number): void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    const n = Number(text.replace(',', '.'))
    if (Number.isFinite(n) && n >= min && n <= 100) onCommit(Math.round(n * 4) / 4)
    else setText(String(value))
  }
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <span className="relative">
        <input className={`${INPUT} pr-8`} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)}
          onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit() }} />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-musgo">m</span>
      </span>
    </label>
  )
}

function TableInspector({ vm }: { vm: FloorEditorViewModel }) {
  const t = vm.selectedTable!
  const problem = vm.problems.find((p) => p.key === t.key)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-hoja-claro text-bosque"><KindIcon kind={t.kind} size={24} /></span>
        <div className="flex flex-col">
          <span className="text-lg leading-tight font-extrabold">{TABLE_KINDS[t.kind].label} {t.code}</span>
          <span className="text-[13px] text-musgo">
            {vm.selectedTableArea ? vm.selectedTableArea.name : 'Fuera de un área'}{t.id ? '' : ' · nueva, su QR se crea al guardar'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Número
          <input className={INPUT} value={t.code} maxLength={20} aria-invalid={!!problem}
            onChange={(e) => vm.updateTable(t.key, { code: e.target.value.toUpperCase() })} />
        </label>
        <div className="flex flex-col gap-1 text-sm font-semibold">
          Capacidad
          <div className="flex min-h-11 items-center rounded-[10px] border border-linea bg-white">
            <button type="button" aria-label="Menos lugares" className="flex size-11 items-center justify-center disabled:opacity-40"
              disabled={t.capacity <= 1} onClick={() => vm.updateTable(t.key, { capacity: t.capacity - 1 })}><MinusIcon size={16} /></button>
            <span className="flex-1 text-center text-base font-extrabold" aria-live="polite">{t.capacity}</span>
            <button type="button" aria-label="Más lugares" className="flex size-11 items-center justify-center disabled:opacity-40"
              disabled={t.capacity >= 50} onClick={() => vm.updateTable(t.key, { capacity: t.capacity + 1 })}><PlusIcon size={16} /></button>
          </div>
        </div>
      </div>
      {problem && <span className="-mt-2 text-xs font-semibold text-[#B42318]">{problem.message}</span>}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Nombre (opcional)
        <input className={INPUT} value={t.label ?? ''} maxLength={80} placeholder="Ej. Ventana, Junto a la barra"
          onChange={(e) => vm.updateTable(t.key, { label: e.target.value || null })} />
      </label>
      <div className="flex flex-col gap-1.5 text-sm font-semibold">
        Tipo
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Tipo de mesa">
          {TABLE_ORDER.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={t.kind === k} title={TABLE_KINDS[k].label}
              onClick={() => vm.updateTable(t.key, { kind: k })}
              className={`flex flex-col items-center gap-1 rounded-[10px] border px-1 py-2 text-[11px] font-bold ${
                t.kind === k ? 'border-bosque bg-hoja-claro text-bosque' : 'border-linea bg-white text-[#44483F]'}`}>
              <KindIcon kind={k} size={22} />
              {TABLE_KINDS[k].label.replace('Mesa redonda', 'Redonda')}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${CHIP} bg-arena`} onClick={vm.rotateSelected}>Girar 90° · {t.rotation}°</button>
        <button type="button" className={`${CHIP} bg-arena`} onClick={vm.duplicateSelected}>Duplicar</button>
        <button type="button" className={`${CHIP} ml-auto text-[#B42318] hover:bg-[#FFE4E6]`} onClick={vm.removeSelected}>Eliminar</button>
      </div>
    </div>
  )
}

function AreaInspector({ vm }: { vm: FloorEditorViewModel }) {
  const a = vm.selectedArea!
  const stats = vm.summary.byArea.find((s) => s.area.key === a.key)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="size-10 rounded-xl" style={{ background: AREA_DOT[a.kind] }} />
        <div className="flex flex-col">
          <span className="text-lg leading-tight font-extrabold">{a.name || 'Área sin nombre'}</span>
          <span className="text-[13px] text-musgo">{stats?.tables ?? 0} {stats?.tables === 1 ? 'mesa' : 'mesas'} · {stats?.seats ?? 0} lugares</span>
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Nombre
        <input className={INPUT} value={a.name} maxLength={40} onChange={(e) => vm.updateArea(a.key, { name: e.target.value })} />
      </label>
      <div className="flex flex-col gap-1.5 text-sm font-semibold">
        Tipo de área
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de área">
          {AREA_ORDER.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={a.kind === k} onClick={() => vm.updateArea(a.key, { kind: k })}
              className={`${CHIP} border ${a.kind === k ? 'border-bosque bg-hoja-claro text-bosque' : 'border-linea bg-white'}`}>
              <span className="size-2.5 rounded-full" style={{ background: AREA_DOT[k] }} />{AREA_KINDS[k].label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MeterInput label="Ancho" value={a.width} min={1} onCommit={(width) => vm.updateArea(a.key, { width })} />
        <MeterInput label="Largo" value={a.depth} min={1} onCommit={(depth) => vm.updateArea(a.key, { depth })} />
      </div>
      <p className="m-0 text-[13px] text-musgo">Arrastra el piso para moverla con sus mesas; la esfera de la esquina cambia su tamaño.</p>
      <button type="button" className={`${CHIP} self-start text-[#B42318] hover:bg-[#FFE4E6]`} onClick={vm.removeSelected}>
        Eliminar área (las mesas se quedan)
      </button>
    </div>
  )
}

function Summary({ vm }: { vm: FloorEditorViewModel }) {
  const s = vm.summary
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {[['Áreas', vm.areas.length], ['Mesas', s.tables], ['Lugares', s.seats]].map(([label, n]) => (
          <div key={label} className="flex flex-col rounded-xl bg-arena px-3 py-2.5">
            <span className="text-[22px] leading-tight font-extrabold">{n}</span>
            <span className="text-xs font-semibold text-musgo">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col">
        {s.byArea.map(({ area, tables, seats }) => (
          <button key={area.key} type="button" onClick={() => vm.select({ type: 'area', key: area.key })}
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-left text-sm hover:bg-arena">
            <span className="size-2.5 rounded-full" style={{ background: AREA_DOT[area.kind] }} />
            <span className="font-bold">{area.name}</span>
            <span className="ml-auto text-musgo">{tables} {tables === 1 ? 'mesa' : 'mesas'} · {seats} lug.</span>
          </button>
        ))}
        {vm.areas.length === 0 && <p className="m-0 text-sm text-musgo">Empieza por dibujar un área (salón, jardín, roof…).</p>}
      </div>
      {s.outside > 0 && <p className="m-0 text-[13px] font-semibold text-[#6F4A22]">{s.outside} mesa(s) fuera de un área.</p>}
      {s.unplaced.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-extrabold">Sin ubicar</span>
          <div className="flex flex-wrap gap-1.5">
            {s.unplaced.map((t) => (
              <button key={t.key} type="button" className={`${CHIP} bg-[#F1E6D8] text-[#6F4A22]`} onClick={() => vm.placeTable(t.key)}>
                <KindIcon kind={t.kind} size={16} />{t.code} · Colocar
              </button>
            ))}
          </div>
        </div>
      )}
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-musgo">
        <li>Toca una mesa o un área para editarla y arrástrala para moverla.</li>
        <li>Atajos: R gira, Supr borra, Esc suelta, Ctrl+Z deshace.</li>
      </ul>
    </div>
  )
}

export function FloorEditorView() {
  const vm = useFloorEditorViewModel()
  const [areaMenu, setAreaMenu] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); vm.undo() }
      else if (e.key === 'r' || e.key === 'R') vm.rotateSelected()
      else if (e.key === 'Delete' || e.key === 'Backspace') vm.removeSelected()
      else if (e.key === 'Escape') vm.select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [vm])

  useEffect(() => {
    if (!vm.dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [vm.dirty])

  return (
    <>
      <AdminTitle title="Plano del local">
        <div className="flex rounded-[10px] bg-arena p-1" role="group" aria-label="Vista">
          <button type="button" className={SEG(vm.view === '3d')} aria-pressed={vm.view === '3d'} onClick={() => vm.setView('3d')}>Maqueta 3D</button>
          <button type="button" className={SEG(vm.view === 'top')} aria-pressed={vm.view === 'top'} onClick={() => vm.setView('top')}>Desde arriba</button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {vm.savedNote && !vm.dirty && <span className="text-[13px] font-semibold text-bosque">{vm.savedNote}</span>}
          {vm.dirty && <span className="text-[13px] font-semibold text-[#6F4A22]">Cambios sin guardar</span>}
          <button type="button" className="min-h-11 rounded-[10px] px-3 text-sm font-semibold hover:bg-white disabled:opacity-40"
            disabled={!vm.canUndo} onClick={vm.undo}>Deshacer</button>
          <button type="button" className="min-h-11 rounded-[10px] px-3 text-sm font-semibold hover:bg-white disabled:opacity-40"
            disabled={!vm.dirty} onClick={vm.discard}>Descartar</button>
          <button type="button" className="min-h-11 rounded-[12px] bg-bosque px-4 text-sm font-bold text-white disabled:bg-linea disabled:text-musgo"
            disabled={!vm.dirty || vm.saving} onClick={() => void vm.save()}>{vm.saving ? 'Guardando…' : 'Guardar plano'}</button>
        </div>
      </AdminTitle>
      <Notice text={vm.notice} onClose={vm.dismissNotice} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative">
          <Suspense fallback={<div className="h-[min(74vh,760px)] min-h-[440px] animate-pulse rounded-[18px] bg-arena" />}>
            <FloorScene className="h-[min(74vh,760px)] min-h-[440px]" editable areas={vm.areas} tables={vm.tables} view={vm.view}
              selected={vm.selection} onSelect={vm.select} onMoveTable={vm.moveTable} onMoveArea={vm.moveArea}
              onResizeArea={vm.resizeArea} />
          </Suspense>
          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start gap-2">
            <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-[14px] bg-white/95 p-1.5 shadow-[0_6px_24px_rgba(27,30,27,0.12)] backdrop-blur">
              <span className="px-2 text-xs font-extrabold tracking-wide text-musgo uppercase">Agregar</span>
              {TABLE_ORDER.map((k) => (
                <button key={k} type="button" className={`${CHIP} hover:bg-hoja-claro`} onClick={() => vm.addTable(k)} title={TABLE_KINDS[k].label}
                  aria-label={`Agregar ${TABLE_KINDS[k].label.toLowerCase()}`}>
                  <KindIcon kind={k} size={18} /><span className="hidden min-[1400px]:inline">{TABLE_KINDS[k].label.replace('Mesa redonda', 'Redonda')}</span>
                </button>
              ))}
              <span className="mx-1 h-6 w-px bg-linea" />
              <div className="relative">
                <button type="button" className={`${CHIP} bg-bosque text-white`} aria-expanded={areaMenu} onClick={() => setAreaMenu((v) => !v)}>
                  <PlusIcon size={16} />Área
                </button>
                {areaMenu && (
                  <div className="absolute top-12 left-0 z-10 flex w-44 flex-col rounded-xl bg-white p-1.5 shadow-[0_12px_32px_rgba(27,30,27,0.18)]">
                    {AREA_ORDER.map((k) => (
                      <button key={k} type="button" className="flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-left text-sm font-semibold hover:bg-arena"
                        onClick={() => { vm.addArea(k); setAreaMenu(false) }}>
                        <span className="size-2.5 rounded-full" style={{ background: AREA_DOT[k] }} />{AREA_KINDS[k].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#44483F] shadow-sm">
            {vm.summary.tables} mesas · {vm.summary.seats} lugares
          </span>
        </div>
        <aside className={`${CARD} self-start`} aria-label="Propiedades">
          {vm.loading ? <p className="m-0 text-sm text-musgo">Cargando plano…</p>
            : vm.selectedTable ? <TableInspector vm={vm} />
              : vm.selectedArea ? <AreaInspector vm={vm} />
                : <Summary vm={vm} />}
        </aside>
      </div>
    </>
  )
}
