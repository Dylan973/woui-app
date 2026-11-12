import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Consent } from '../../types'

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export function matchesPatient(c: Pick<Consent, 'patient' | 'email' | 'procedure'>, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  return [c.patient, c.email, c.procedure].some((v) => normalize(v ?? '').includes(q))
}

const STATUS_LABEL: Record<string, string> = { sent: 'Envoyé', opened: 'Ouvert', viewed: 'Visionné', signed: 'Signé' }

/** Recherche d'un patient (nom, e-mail ou acte) ; ⌘K ou Ctrl+K place le curseur dans le champ. */
export function PatientSearch({ consents }: { consents: Consent[] }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => setValue(searchParams.get('q') ?? ''), [searchParams])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [])

  const results = useMemo(() => {
    if (!value.trim()) return []
    return consents.filter((c) => matchesPatient(c, value)).slice(0, 6)
  }, [consents, value])

  const apply = (q: string) => {
    setOpen(false)
    inputRef.current?.blur()
    navigate(q.trim() ? `/dashboard?q=${encodeURIComponent(q.trim())}` : '/dashboard')
  }

  return (
    <div ref={boxRef} className="relative hidden md:block">
      <label
        className="flex items-center gap-[9px] rounded-[3px] px-[14px] py-2 text-[13px]"
        style={{ border: `1px solid ${open ? 'var(--accent)' : 'var(--border-subtle)'}`, color: 'var(--text-muted)', width: 230 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          id="patient-search"
          type="search"
          value={value}
          placeholder="Rechercher un patient"
          aria-label="Rechercher un patient"
          autoComplete="off"
          size={1}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setValue(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              apply(results[active] && open ? results[active].patient : value)
            } else if (e.key === 'Escape') {
              setOpen(false)
              inputRef.current?.blur()
            }
          }}
          className="w-full min-w-0 bg-transparent outline-none"
          style={{ color: 'var(--text-primary)', border: 0 }}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue('')
              apply('')
            }}
            aria-label="Effacer la recherche"
            className="cursor-pointer text-[15px] leading-none"
            style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
          >
            ×
          </button>
        ) : (
          <span className="font-mono ml-auto text-[11px] opacity-70">⌘K</span>
        )}
      </label>

      {open && value.trim() && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-[60] p-1"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 4, boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }}
          role="listbox"
        >
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Aucun patient trouvé
            </div>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => apply(c.patient)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[3px] px-3 py-[9px] text-left"
                style={{ background: i === active ? 'var(--surface-card-alt)' : 'transparent', border: 0 }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {c.patient}
                  </span>
                  <span className="block truncate text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    {c.kind === 'quote' ? (c.quote_name ?? 'Devis') : c.procedure}
                  </span>
                </span>
                <span className="flex-none text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
