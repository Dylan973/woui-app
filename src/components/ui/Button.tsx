import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[0.86rem] px-[1.1rem] py-[0.62rem] transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-60'

const variants: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'bg-transparent border border-[var(--border-color)] text-[var(--text-muted)]',
  ghost: 'bg-transparent border border-transparent text-[var(--text-muted)] hover:bg-[var(--hover-bg)]',
  danger: 'bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.18)] text-[#ef4444]',
}

export function Button({ variant = 'primary', className = '', style, children, ...props }: ButtonProps) {
  const gradientStyle =
    variant === 'primary' ? { background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', border: 'none', ...style } : style

  return (
    <button className={`${base} ${variants[variant]} ${className}`} style={gradientStyle} {...props}>
      {children}
    </button>
  )
}
