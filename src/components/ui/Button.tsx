import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'accent' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const sizes: Record<Size, string> = {
  sm: 'px-[14px] py-[6px] text-[0.8125rem]',
  md: 'px-5 py-[11px] text-[0.9375rem]',
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-[3px] font-semibold font-sans transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50'

function variantStyle(variant: Variant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return { background: 'var(--action-primary)', color: 'var(--action-primary-text)', border: 'none' }
    case 'accent':
      return { background: 'var(--action-accent)', color: 'var(--action-accent-text)', border: 'none' }
    case 'danger':
      return { background: 'rgba(184,35,42,0.08)', color: 'var(--garnet-600)', border: '1px solid rgba(184,35,42,0.22)' }
    case 'ghost':
    default:
      return { background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }
  }
}

export function Button({ variant = 'primary', size = 'md', className = '', style, children, ...props }: ButtonProps) {
  return (
    <button
      className={`${base} ${sizes[size]} ${className}`}
      style={{ ...variantStyle(variant), ...style }}
      {...props}
    >
      {children}
    </button>
  )
}
