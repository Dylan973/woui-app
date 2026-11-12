import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

/** Proposé une seule fois, à la première ouverture d'un profil (offres Pro et Clinique). */
export function PinOfferModal({ profileLabel, onCreate, onDecline }: { profileLabel: string; onCreate: () => void; onDecline: () => void }) {
  return (
    <Modal onClose={onDecline} maxWidth={460}>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-accent)' }}>
        Facultatif
      </div>
      <h2 className="font-display mt-3 text-[24px] leading-[1.2]" style={{ color: 'var(--text-primary)' }}>
        Protéger ce profil avec un code à 4 chiffres ?
      </h2>
      <p className="my-4 text-[0.9375rem] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
        Le code sera demandé à chaque ouverture du profil « {profileLabel} ». Pratique sur un poste partagé au cabinet. Vous pourrez le créer ou le
        modifier plus tard dans Paramètres &gt; Sécurité.
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onDecline}>
          Non merci
        </Button>
        <Button variant="primary" size="sm" onClick={onCreate}>
          Créer un code
        </Button>
      </div>
    </Modal>
  )
}
