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

/** Affiché une fois quand un compte passe à l'offre Pro (2 profils) ou Clinique. */
export function ClinicWelcomeModal({ onCreate, onLater, plan = 'clinic' }: { onCreate: () => void; onLater: () => void; plan?: 'pro' | 'clinic' }) {
  return (
    <Modal onClose={onLater} maxWidth={500}>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-accent)' }}>
        {plan === 'pro' ? 'Offre Pro : 2 profils praticiens' : 'Offre Clinique activée'}
      </div>
      <h2 className="font-display mt-3 text-[26px] leading-[1.2]" style={{ color: 'var(--text-primary)' }}>
        {plan === 'pro' ? 'Vous pouvez ajouter un second praticien' : 'Vous pouvez maintenant créer un profil par praticien'}
      </h2>
      <BenefitList />
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onLater}>
          Plus tard
        </Button>
        <Button variant="primary" size="sm" onClick={onCreate}>
          {plan === 'pro' ? 'Ajouter un praticien' : 'Créer les profils'}
        </Button>
      </div>
    </Modal>
  )
}

/**
 * Affiché quand l'offre ne permet pas d'ajouter un profil : Starter (1 profil) → Pro (2) ;
 * Pro (2 profils) → Clinique (4 praticiens).
 */
export function ClinicUpsellModal({ onSeePlans, onClose, plan = 'starter' }: { onSeePlans: () => void; onClose: () => void; plan?: 'starter' | 'pro' | 'clinic' }) {
  const toPro = plan === 'starter'
  return (
    <Modal onClose={onClose} maxWidth={500}>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-accent)' }}>
        {toPro ? 'L’offre Starter comprend 1 profil praticien' : 'L’offre Pro comprend 2 profils praticiens'}
      </div>
      <h2 className="font-display mt-3 text-[26px] leading-[1.2]" style={{ color: 'var(--text-primary)' }}>
        {toPro ? 'Un second praticien ? Passez à l’offre Pro' : 'Plus de 2 praticiens ? Passez à l’offre Clinique'}
      </h2>
      <p className="mt-3 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
        Starter : 1 profil · Pro : 2 profils · Clinique : 4 praticiens compris, puis 40 € par mois par praticien supplémentaire.
      </p>
      <BenefitList />
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fermer
        </Button>
        <Button variant="primary" size="sm" onClick={onSeePlans}>
          {toPro ? 'Voir l’offre Pro' : 'Voir l’offre Clinique'}
        </Button>
      </div>
    </Modal>
  )
}
