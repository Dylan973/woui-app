import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  /** Champ obligatoire : astérisque visible après le libellé. */
  mandatory?: boolean
}

export function Input({ label, hint, mandatory = false, onFocus, onBlur, ...props }: InputProps) {
  const [focus, setFocus] = useState(false)
  // Mot de passe : bouton « afficher / masquer ».
  const isPassword = props.type === 'password'
  const [shown, setShown] = useState(false)
  return (
    <label className="mb-5 flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
        {label}
        {mandatory && (
          <span aria-hidden="true" className="ml-1 text-[12px] font-bold" style={{ color: 'var(--danger-text)' }}>
            *
          </span>
        )}
      </span>
      <span className="relative block">
      <input
        {...props}
        type={isPassword && shown ? 'text' : props.type}
        onFocus={(e) => {
          setFocus(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocus(false)
          onBlur?.(e)
        }}
        className={`w-full rounded-[var(--radius-control)] py-3 pl-[14px] text-[1.0625rem] outline-none transition-colors ${isPassword ? 'pr-[48px]' : 'pr-[14px]'}`}
        style={{
          background: 'var(--surface-card-alt)',
          border: `1px solid ${focus ? 'var(--accent)' : 'var(--border-subtle)'}`,
          boxShadow: focus ? '0 0 0 2px rgba(108,92,231,0.2)' : 'none',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)',
        }}
      />
      {isPassword && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            setShown((v) => !v)
          }}
          aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={shown}
          title={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          className="absolute right-[6px] top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[8px]"
          style={{ background: 'none', border: 0, color: 'var(--text-secondary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {shown && <path d="M3 3l18 18" />}
          </svg>
        </button>
      )}
      </span>
      {hint && (
        <span className="text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}
    </label>
  )
}
