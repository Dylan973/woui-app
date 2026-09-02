import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

export function Input({ label, hint, onFocus, onBlur, ...props }: InputProps) {
  const [focus, setFocus] = useState(false)
  return (
    <label className="mb-5 flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <input
        {...props}
        onFocus={(e) => {
          setFocus(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocus(false)
          onBlur?.(e)
        }}
        className="w-full rounded-[3px] px-[14px] py-3 text-[1.0625rem] outline-none transition-colors"
        style={{
          background: 'var(--surface-card-alt)',
          border: `1px solid ${focus ? 'var(--accent)' : 'var(--border-subtle)'}`,
          boxShadow: focus ? '0 0 0 2px rgba(108,92,231,0.2)' : 'none',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)',
        }}
      />
      {hint && (
        <span className="text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}
    </label>
  )
}
