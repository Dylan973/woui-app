import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

/** Rappel de début d'année : télécharger l'archive des documents signés l'année précédente. */
export function ArchiveReminderModal({ year, count, onDownload, onLater }: { year: number; count: number; onDownload: () => void; onLater: () => void }) {
  return (
    <Modal onClose={onLater} maxWidth={500}>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-accent)' }}>
        Archive {year}
      </div>
      <h2 className="font-display mt-3 text-[26px] leading-[1.2]" style={{ color: 'var(--text-primary)' }}>
        Téléchargez les documents signés en {year}
      </h2>
      <p className="my-5 text-[0.9375rem] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
        {count} envoi{count > 1 ? 's' : ''} signé{count > 1 ? 's' : ''} l’an dernier. Un fichier ZIP regroupe tous les PDF et un index (date, patient,
        acte, praticien), à conserver avec les archives de votre cabinet.
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onLater}>
          Me le rappeler plus tard
        </Button>
        <Button variant="primary" size="sm" onClick={onDownload}>
          Télécharger l’archive
        </Button>
      </div>
    </Modal>
  )
}
