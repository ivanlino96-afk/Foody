import type { ButtonHTMLAttributes, ComponentType, InputHTMLAttributes, ReactNode, SVGProps } from 'react'

export const INPUT = 'min-h-11 w-full rounded-[10px] border border-transparent bg-hoja-claro px-3 text-base text-carbon outline-none transition-colors placeholder:text-apagado focus:border-bosque focus:bg-white'

/** Pill actions for admin screens: solid forest for the main one, pale green for the rest. */
export const PRIMARY = 'inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-full bg-bosque px-5 text-sm font-semibold text-white transition-colors hover:bg-bosque-oscuro disabled:bg-linea disabled:text-musgo'
export const SECONDARY = 'inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-full bg-hoja-claro px-5 text-sm font-semibold text-carbon transition-colors hover:bg-hoja disabled:text-apagado disabled:hover:bg-hoja-claro'

/** Small labelled icon button for row actions (edit, delete). */
export function IconAction({ label, icon: Icon, danger, ...rest }:
  { label: string; icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>; danger?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={`flex size-11 flex-none items-center justify-center rounded-full text-musgo transition-colors ${
        danger ? 'hover:bg-[#FDF0EE] hover:text-[#B42318]' : 'hover:bg-hoja-claro hover:text-carbon'}`}>
      <Icon size={18} strokeWidth={1.8} />
    </button>
  )
}

/** Labelled input with its error line underneath. */
export function Field({ label, error, children, ...input }:
  { label: string; error?: string; children?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      {children ?? <input className={INPUT} aria-invalid={!!error} {...input} />}
      {error && <span className="text-xs font-semibold text-[#B42318]">{error}</span>}
    </label>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className="flex size-11 flex-none items-center justify-center">
      <span className={`flex h-6 w-10 rounded-full p-[3px] transition-colors ${checked ? 'justify-end bg-bosque' : 'justify-start bg-[#D3D9D4]'}`}>
        <span className="size-[18px] rounded-full bg-white shadow-[0_1px_1px_rgba(0,0,0,0.12)]" />
      </span>
    </button>
  )
}
