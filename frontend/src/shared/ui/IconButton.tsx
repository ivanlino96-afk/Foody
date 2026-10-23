import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function IconButton({ label, children, className = '', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-xl bg-arena text-carbon transition active:scale-95 disabled:opacity-60 ${className}`}
      {...rest}>
      {children}
    </button>
  )
}
