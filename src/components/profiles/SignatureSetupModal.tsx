import { Modal } from '../ui/Modal'
import { PractitionerSignature } from './PractitionerSignature'
import type { Profile } from '../../types'

interface SignatureSetupModalProps {
  doctorId: string
  profile: Profile
  onSaved: (message: string) => Promise<void>
  onLater: () => void
}

/** Proposé à la première ouverture d'un profil, quelle que soit l'offre. */
export function SignatureSetupModal({ doctorId, profile, onSaved, onLater }: SignatureSetupModalProps) {
  return (
    <Modal onClose={onLater} maxWidth={540}>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-accent)' }}>
        Signature et tampon
      </div>
      <h2 className="font-display mt-3 text-[24px] leading-[1.2]" style={{ color: 'var(--text-primary)' }}>
        Importez votre signature et votre tampon
      </h2>
      <p className="my-4 text-[0.9375rem] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
        Ils figureront à côté de la signature du patient sur chaque document signé. Vous pourrez les remplacer dans Paramètres &gt; Documents
        PDF.
      </p>
      <PractitionerSignature doctorId={doctorId} profile={profile} onSaved={onSaved} compact />
      <div className="mt-5 text-right">
        <button type="button" onClick={onLater} className="cursor-pointer text-[13px]" style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}>
          Plus tard
        </button>
      </div>
    </Modal>
  )
}
