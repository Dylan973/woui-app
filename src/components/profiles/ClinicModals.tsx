import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

const BENEFITS = [
  'Un profil par praticien : nom, spécialité et couleur',
  'Chaque praticien retrouve uniquement ses propres envois',
  'Emails et consentements signés au nom du bon praticien',
  'Un seul abonnement et une seule facture pour le cabinet',
]

function BenefitList() {
  return (
    <ul className="my-5 flex flex-col gap-[10px] p-0" style={{ listStyle: 'none' }}>
      {BENEFITS.map((benefit) => (
        <li key={benefit} className="flex items-start gap-3 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
          <span
            className="mt-[3px] flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[11px]"
            style={{ background: 'var(--mint-soft)', color: 'var(--status-signed-text)' }}
            aria-hidden="true"
          >
            ✓
          </span>
          {benefit}
        </li>
      ))}
    </ul>
  )
}

/** Affiché une fois quand un compte passe à l'offre Clinique. */
export function ClinicWelcomeModal({ onCreate, onLater }: { onCreate: () => void; onLater: () => void }) {
  return (
    <Modal onClose={onLater} maxWidth={500}>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-accent)' }}>
        Offre Clinique activée
      </div>
      <h2 className="font-display mt-3 text-[26px] leading-[1.2]" style={{ color: 'var(--text-primary)' }}>
        Vous pouvez maintenant créer un profil par praticien
      </h2>
      <BenefitList />
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onLater}>
          Plus tard
        </Button>
        <Button variant="primary" size="sm" onClick={onCreate}>
          Créer les profils
        </Button>
      </div>
    </Modal>
  )
}

/** Affiché quand un compte Starter ou Pro clique sur l'ajout de profil (grisé). */
export function ClinicUpsellModal({ onSeePlans, onClose }: { onSeePlans: () => void; onClose: () => void }) {
  return (
    <Modal onClose={onClose} maxWidth={500}>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-accent)' }}>
        Disponible avec l'abonnement Clinique
      </div>
      <h2 className="font-display mt-3 text-[26px] leading-[1.2]" style={{ color: 'var(--text-primary)' }}>
        Plusieurs praticiens dans le même cabinet ?
      </h2>
      <BenefitList />
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fermer
        </Button>
        <Button variant="primary" size="sm" onClick={onSeePlans}>
          Voir l'offre Clinique
        </Button>
      </div>
    </Modal>
  )
}
