import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

export function Input({ label, hint, onFocus, onBlur, ...props }: InputProps) {
  const [focus, setFocus] = useState(false)
  return (
    <div className="mb-[1.1rem]">
      <label className="mb-[0.35rem] block text-[0.75rem] uppercase tracking-[0.8px] text-[var(--text-muted)]">
        {label}
      </label>
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
        className="w-full rounded-[10px] bg-[var(--bg-input)] px-4 py-[0.7rem] text-[0.88rem] text-[var(--text-main)] outline-none transition-colors"
        style={{ border: `1px solid ${focus ? 'var(--accent)' : 'var(--border-color)'}` }}
      />
      {hint && <div className="mt-[0.3rem] text-[0.72rem] text-[var(--text-dark)]">{hint}</div>}
    </div>
  )
}
