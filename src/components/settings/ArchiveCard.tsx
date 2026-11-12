import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { countSignedInYear, exportYear, type ExportProgress } from '../../lib/exportConsents'
import type { ToastType } from '../ui/Toast'

interface ArchiveCardProps {
  doctorId: string
  accountCreatedAt: string
  /** Comptes à plusieurs profils : l'archive (tout le cabinet) se télécharge depuis le profil du titulaire. */
  allowed: boolean
  practitionerName: (practitionerId: string | null) => string
  showToast: (msg: string, type?: ToastType) => void
  initialYear?: number | null
}

/** Paramètres > Documents PDF : archive annuelle des documents signés (ZIP + index CSV). */
export function ArchiveCard({ doctorId, accountCreatedAt, allowed, practitionerName, showToast, initialYear }: ArchiveCardProps) {
  const current = new Date().getFullYear()
  const first = Math.min(current, new Date(accountCreatedAt).getFullYear() || current)
  const years = Array.from({ length: current - first + 1 }, (_, i) => current - i)
  const [year, setYear] = useState(initialYear && years.includes(initialYear) ? initialYear : years.length > 1 ? current - 1 : current)
  const [count, setCount] = useState<number | null>(null)
  const [progress, setProgress] = useState<ExportProgress | null>(null)

  useEffect(() => {
    let cancelled = false
    setCount(null)
    void countSignedInYear(doctorId, year).then((n) => !cancelled && setCount(n))
    return () => {
      cancelled = true
    }
  }, [doctorId, year])

  const run = async () => {
    setProgress({ done: 0, total: 0 })
    const { error, count: exported } = await exportYear(doctorId, year, practitionerName, setProgress)
    setProgress(null)
    if (error && exported === 0) showToast(error, 'warning')
    else if (error) showToast(`Archive ${year} téléchargée. ${error}`, 'warning')
    else showToast(`Archive ${year} téléchargée : ${exported} envoi${exported > 1 ? 's' : ''} signé${exported > 1 ? 's' : ''}`)
  }

  return (
    <div className="p-[clamp(1.5rem,4vw,36px)]" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
      <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
        Archive annuelle
      </h2>
      <p className="mb-6 mt-[6px] max-w-[640px] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
        Téléchargez en un fichier ZIP tous les documents signés d’une année, avec un index (tableur) : date, patient, acte, praticien. Conservez-le
        avec les archives de votre cabinet. Woui vous le rappelle chaque début d’année.
      </p>
      {allowed ? (
        <div className="flex flex-wrap items-center gap-4">
          <select
            aria-label="Année"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={progress !== null}
            className="rounded-[3px] px-3 py-[9px] text-[0.9375rem] outline-none"
            style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button variant="primary" onClick={run} disabled={progress !== null || count === 0}>
            {progress
              ? progress.total > 0
                ? `Préparation… ${progress.done}/${progress.total}`
                : 'Préparation…'
              : `Télécharger l’archive ${year}`}
          </Button>
          <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {count === null ? '' : count === 0 ? `Aucun document signé en ${year}` : `${count} envoi${count > 1 ? 's' : ''} signé${count > 1 ? 's' : ''}`}
          </span>
        </div>
      ) : (
        <p className="text-[0.875rem]" style={{ color: 'var(--text-muted)' }}>
          L’archive regroupe les documents de tout le cabinet : elle se télécharge depuis le profil du titulaire du compte.
        </p>
      )}
    </div>
  )
}
