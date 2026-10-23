import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 20, children, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}

export const BellIcon = (p: IconProps) => (
  <Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Icon>
)
export const ReceiptIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-3 2-3-2-3 2-3-2-3 2z" /><path d="M8 9h8M8 13h6" /></Icon>
)
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
)
export const PlusIcon = (p: IconProps) => <Icon strokeWidth={2.5} {...p}><path d="M12 5v14M5 12h14" /></Icon>
export const MinusIcon = (p: IconProps) => <Icon strokeWidth={2.5} {...p}><path d="M5 12h14" /></Icon>
export const BackIcon = (p: IconProps) => <Icon strokeWidth={2.2} {...p}><path d="M15 18l-6-6 6-6" /></Icon>
export const AlertIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></Icon>
)
export const CheckIcon = (p: IconProps) => <Icon strokeWidth={2.5} {...p}><path d="M5 12l5 5L20 7" /></Icon>
