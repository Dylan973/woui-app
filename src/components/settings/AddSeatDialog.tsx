import { useState } from 'react'
import { Button } from '../ui/Button'
import { changeExtraSeats, type SeatResult } from '../../lib/billing'
import { EXTRA_SEAT_PRICE } from '../../lib/profiles'

const euros = (cents: number) => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

/**
 * Achat d'une place de praticien (offre Clinique). La place n'est ajoutée qu'une fois le paiement accepté
 * par Stripe ; sinon le cabinet est envoyé vers la facture Stripe à régler.
 */
export function AddSeatDialog({
  doctorId,
  onDone,
  onCancel,
}: {
  doctorId: string
  /** Place payée et ajoutée. */
  onDone: () => void | Promise<void>
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trial, setTrial] = useState<SeatResult | null>(null)

  const buy = async (endTrial = false) => {
    setBusy(true)
    setError(null)
    const { data, error: failure } = await changeExtraSeats('add', doctorId, endTrial)
    setBusy(false)
    if (failure || !data) {
      setError(failure ?? 'Le paiement n’a pas pu être effectué. Aucune place n’a été ajoutée.')
      return
    }
    if (data.needs_trial_end) {
      setTrial(data)
      return
    }
    if (data.pay_url) {
      // Validation bancaire (3D Secure) ou nouvelle carte : la facture Stripe s'ouvre ; la place arrive une fois payée.
      window.location.assign(data.pay_url)
      return
    }
    await onDone()
  }

  return (
    <div>
      {trial ? (
        <p className="mb-4 text-[0.9375rem] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
          Votre cabinet est en <b>essai gratuit</b>. Ajouter un praticien démarre l’abonnement dès maintenant : {euros(trial.plan_amount ?? 0)} (offre
          Clinique) + {euros(trial.seat_amount ?? 0)} (praticien{(trial.seat_amount ?? 0) > EXTRA_SEAT_PRICE * 100 ? 's' : ''} supplémentaire
          {(trial.seat_amount ?? 0) > EXTRA_SEAT_PRICE * 100 ? 's' : ''}) seront débités sur la carte du cabinet
          {trial.interval === 'yearly' ? ', pour l’année' : ', puis chaque mois'}.
        </p>
      ) : (
        <p className="mb-4 text-[0.9375rem] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
          Chaque praticien en plus coûte {EXTRA_SEAT_PRICE} € par mois. Le montant jusqu’à la fin de la période en cours est débité
          <b> tout de suite</b> sur la carte du cabinet ; la place est ajoutée dès que le paiement est accepté.
        </p>
      )}
      {error && (
        <p className="mb-3 text-[0.875rem]" style={{ color: 'var(--danger-text)' }}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Annuler
        </Button>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => buy(Boolean(trial))}>
          {busy ? 'Paiement…' : trial ? 'Démarrer l’abonnement et payer' : `Payer et ajouter la place`}
        </Button>
      </div>
    </div>
  )
}
