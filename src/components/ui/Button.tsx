import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const sizes: Record<Size, string> = {
  sm: 'px-[14px] py-[6px] text-[0.8125rem]',
  md: 'px-5 py-[10px] text-[0.9375rem]',
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-[3px] font-semibold font-sans transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45'

const variants: Record<Variant, string> = {
  primary:
    'text-[var(--action-primary-text)] bg-[var(--action-primary)] border border-transparent hover:bg-[var(--action-primary-hover)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--surface-card-alt)]',
  danger: 'bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger-border)]',
}

export function Button({ variant = 'primary', size = 'md', className = '', style, children, ...props }: ButtonProps) {
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} style={style} {...props}>
      {children}
    </button>
  )
}
