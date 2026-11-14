import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatBirthDate, matchesName } from '../../hooks/usePatients'
import type { Consent, Patient } from '../../types'

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

/**
 * Recherche d'un patient. Au clic, des filtres apparaissent : nom, prénom et date de naissance.
 * Un résultat ouvre la fiche du patient (tous ses envois). ⌘K ou Ctrl+K place le curseur dans le champ.
 */
export function PatientSearch({ consents, patients }: { consents: Consent[]; patients: Patient[] }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [birth, setBirth] = useState('')
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

  const filtering = value.trim() !== '' || lastName.trim() !== '' || firstName.trim() !== '' || birth !== ''
  const sends = useMemo(() => {
    const count = new Map<string, number>()
    for (const c of consents) if (c.patient_id) count.set(c.patient_id, (count.get(c.patient_id) ?? 0) + 1)
    return count
  }, [consents])
  const results = useMemo(() => {
    if (!filtering) return []
    const q = normalize(value)
    return patients
      .filter(
        (p) =>
          (!q || matchesName(p.full_name, value) || normalize(p.email ?? '').includes(q)) &&
          (!lastName.trim() || matchesName(p.full_name, lastName)) &&
          (!firstName.trim() || matchesName(p.full_name, firstName)) &&
          (!birth || p.birth_date === birth)
      )
      .slice(0, 8)
  }, [patients, value, lastName, firstName, birth, filtering])

  const openPatient = (p: Patient) => {
    setOpen(false)
    inputRef.current?.blur()
    navigate(`/patients/${p.id}`)
  }

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
              if (results[active] && open) openPatient(results[active])
              else apply(value)
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

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[60] w-[380px] p-3"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 4, boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }}
        >
          <div className="font-mono mb-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
            Filtrer les patients
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Nom', lastName, setLastName],
              ['Prénom', firstName, setFirstName],
            ].map(([label, v, setV]) => (
              <input
                key={label as string}
                value={v as string}
                onChange={(e) => (setV as (s: string) => void)(e.target.value)}
                placeholder={label as string}
                aria-label={label as string}
                className="min-w-0 rounded-[3px] px-[10px] py-2 text-[13px] outline-none"
                style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            ))}
            <label className="col-span-2 flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Date de naissance
              <input
                type="date"
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
                aria-label="Date de naissance"
                className="min-w-0 flex-1 rounded-[3px] px-[10px] py-[7px] text-[13px] outline-none"
                style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
              {(lastName || firstName || birth) && (
                <button
                  type="button"
                  onClick={() => {
                    setLastName('')
                    setFirstName('')
                    setBirth('')
                  }}
                  className="cursor-pointer text-[12px] underline"
                  style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}
                >
                  Effacer
                </button>
              )}
            </label>
          </div>

          {filtering && (
            <div className="mt-3 max-h-[320px] overflow-y-auto" role="listbox" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
              {results.length === 0 ? (
                <div className="px-2 py-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  Aucun patient trouvé
                </div>
              ) : (
                results.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => openPatient(p)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[3px] px-2 py-[9px] text-left"
                    style={{ background: i === active ? 'var(--surface-card-alt)' : 'transparent', border: 0 }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {p.full_name}
                      </span>
                      <span className="block truncate text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        {p.birth_date ? `Né(e) le ${formatBirthDate(p.birth_date)}` : 'Date de naissance non renseignée'}
                      </span>
                    </span>
                    <span className="flex-none text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {sends.get(p.id) ?? 0} envoi{(sends.get(p.id) ?? 0) > 1 ? 's' : ''}
                    </span>
                  </button>
                ))
              )}
              {value.trim() && (
                <button
                  type="button"
                  onClick={() => apply(value)}
                  className="mt-1 w-full cursor-pointer rounded-[3px] px-2 py-2 text-left text-[12.5px]"
                  style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}
                >
                  Afficher les envois correspondant à « {value.trim()} » →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
