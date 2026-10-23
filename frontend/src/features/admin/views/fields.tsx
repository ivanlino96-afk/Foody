import type { InputHTMLAttributes, ReactNode } from 'react'

export const INPUT = 'min-h-11 w-full rounded-[10px] border border-linea bg-white px-3 text-base text-carbon outline-none focus:border-bosque'

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
      className={`flex h-8 w-14 flex-none rounded-full p-[3px] ${checked ? 'justify-end bg-bosque' : 'justify-start bg-[#CFC8BA]'}`}>
      <span className="size-[26px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
    </button>
  )
}
