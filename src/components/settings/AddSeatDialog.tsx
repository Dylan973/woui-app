import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { changeExtraSeats, previewExtraSeat, type SeatPreview } from '../../lib/billing'
import { EXTRA_SEAT_PRICE } from '../../lib/profiles'

const euros = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 })

const shortDate = (unix: number) => new Date(unix * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

/**
 * Achat d'une place de praticien (offre Clinique). Les montants exacts, calculés par Stripe, sont affichés
 * avant de valider. Abonnement à jour : prorata sur la prochaine facture ; sinon paiement immédiat.
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
  const [preview, setPreview] = useState<SeatPreview | null>(null)

  useEffect(() => {
    let cancelled = false
    void previewExtraSeat(doctorId).then(({ data, error: failure }) => {
      if (cancelled) return
      if (failure || !data) setError(failure ?? 'Le montant n’a pas pu être calculé. Réessayez dans un instant.')
      else setPreview(data)
    })
    return () => {
      cancelled = true
    }
  }, [doctorId])

  const buy = async () => {
    if (!preview) return
    setBusy(true)
    setError(null)
    const { data, error: failure } = await changeExtraSeats('add', doctorId, preview.proration_date)
    setBusy(false)
    if (failure || !data) {
      setError(failure ?? 'Le paiement n’a pas pu être effectué. Aucune place n’a été ajoutée.')
      return
    }
    if (data.pay_url) {
      // Validation bancaire (3D Secure) ou nouvelle carte : la facture Stripe s'ouvre ; la place arrive une fois payée.
      window.location.assign(data.pay_url)
      return
    }
    await onDone()
  }

  const per = preview?.interval === 'yearly' ? 'an' : 'mois'
  const nextDate = preview?.next_date ? shortDate(preview.next_date) : null
  const rows: [string, string, string?][] = !preview
    ? []
    : preview.mode === 'trial'
      ? [
          ['Aujourd’hui', euros(0), 'Pendant l’essai gratuit, la place est ajoutée sans frais.'],
          [nextDate ? `Premier prélèvement, le ${nextDate}` : 'Premier prélèvement', euros(preview.next_amount), 'Abonnement et praticiens en plus, en un seul prélèvement.'],
          ['Ensuite', `${euros(preview.recurring)} / ${per}`],
        ]
      : preview.mode === 'next_invoice'
        ? [
            ['Aujourd’hui', euros(0), 'Rien n’est débité maintenant : la place est ajoutée tout de suite.'],
            [
              nextDate ? `Prochaine facture, le ${nextDate}` : 'Prochaine facture',
              euros(preview.next_amount),
              `Dont ${euros(preview.prorata)} pour la place jusqu’à cette date (${EXTRA_SEAT_PRICE} € / ${per} au prorata des jours restants).`,
            ],
            ['Ensuite', `${euros(preview.recurring)} / ${per}`, 'Abonnement et praticiens en plus, en un seul prélèvement.'],
          ]
        : [
            ['Débité aujourd’hui', euros(preview.due_now), `${EXTRA_SEAT_PRICE} € / ${per} au prorata des jours restants${nextDate ? `, jusqu’au ${nextDate}` : ''}.`],
            [nextDate ? `À partir du ${nextDate}` : 'Ensuite', `${euros(preview.recurring)} / ${per}`, 'Abonnement et praticiens en plus, en un seul prélèvement.'],
          ]

  return (
    <div>
      {preview === null && !error ? (
        <p className="mb-4 text-[0.9375rem]" style={{ color: 'var(--text-muted)' }}>
          Calcul du montant…
        </p>
      ) : (
        preview && (
          <dl className="m-0 mb-4 flex flex-col">
            {rows.map(([label, value, hint]) => (
              <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <dt className="text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                  {hint && (
                    <span className="mt-[2px] block max-w-[340px] text-[12.5px] leading-[1.45]" style={{ color: 'var(--text-muted)' }}>
                      {hint}
                    </span>
                  )}
                </dt>
                <dd className="m-0 text-[1.0625rem] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )
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
        <Button variant="primary" size="sm" disabled={busy || !preview} onClick={buy}>
          {busy ? 'Ajout…' : preview && preview.mode === 'now' ? `Payer ${euros(preview.due_now)} et ajouter la place` : 'Ajouter la place'}
        </Button>
      </div>
    </div>
  )
}
