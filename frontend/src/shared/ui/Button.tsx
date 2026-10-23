import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary: 'bg-bosque text-white shadow-[0_8px_24px_rgba(47,74,58,0.3)] disabled:bg-linea disabled:text-musgo disabled:shadow-none',
  soft: 'bg-arena text-carbon disabled:opacity-60',
} as const

export function Button({ variant = 'primary', className = '', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button type="button"
      className={`min-h-12 rounded-[14px] px-4 py-4 text-base font-bold transition active:scale-[0.99] ${VARIANTS[variant]} ${className}`}
      {...rest} />
  )
}
