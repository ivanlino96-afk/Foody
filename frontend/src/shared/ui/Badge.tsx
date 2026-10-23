import type { ReactNode } from 'react'

const TONES = {
  neutral: 'bg-arena text-[#44483F]',
  dark: 'bg-[#44483F] text-white',
  warm: 'bg-[#F1E6D8] text-[#6F4A22]',
  green: 'bg-hoja-claro text-bosque',
  danger: 'bg-[#FFE4E6] text-[#9F1239]',
  hot: 'bg-[#FEE2E2] text-[#991B1B]',
} as const

export type BadgeTone = keyof typeof TONES

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-[3px] text-xs font-bold ${TONES[tone]}`}>{children}</span>
}
