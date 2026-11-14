import { useState } from 'react'
import { Button } from '../ui/Button'
import { changeExtraSeats } from '../../lib/billing'
import { EXTRA_SEAT_PRICE, INCLUDED_PRACTITIONERS, practitionerPlaces } from '../../lib/profiles'
import type { Doctor } from '../../types'
import type { ToastType } from '../ui/Toast'

interface TeamSeatsProps {
  doctor: Doctor
  practitionerCount: number
  /** Gestion du cabinet ouverte : peut modifier l'abonnement. */
  canManage: boolean
  refetchDoctor: () => Promise<void>
  showToast: (msg: string, type?: ToastType) => void
}

/** Offre Clinique : 3 praticiens compris, places supplémentaires payantes. */
export function TeamSeats({ doctor, practitionerCount, canManage, refetchDoctor, showToast }: TeamSeatsProps) {
  const [busy, setBusy] = useState<'add' | 'remove' | null>(null)
  const extra = Math.max(doctor.extra_seats ?? 0, 0)
  const places = practitionerPlaces(doctor)
  const freePlaces = places - practitionerCount

  const change = async (action: 'add' | 'remove') => {
    setBusy(action)
    const { error } = await changeExtraSeats(action, doctor.id)
    if (!error) await refetchDoctor()
    setBusy(null)
    showToast(
      error ?? (action === 'add' ? `Place ajoutée (+${EXTRA_SEAT_PRICE} € / mois)` : 'Place retirée de l’abonnement'),
      error ? 'warning' : 'success'
    )
  }

  return (
    <div className="mt-8 max-w-[700px] pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <h3 className="font-display text-[18px]" style={{ color: 'var(--text-primary)' }}>
        Places de praticiens
      </h3>
      <p className="mb-4 mt-[6px] text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
        {INCLUDED_PRACTITIONERS} praticiens compris dans l’offre Clinique
        {extra > 0 ? `, plus ${extra} place${extra > 1 ? 's' : ''} supplémentaire${extra > 1 ? 's' : ''} à ${EXTRA_SEAT_PRICE} € par mois chacune` : ''}.{' '}
        {freePlaces > 0 ? `${freePlaces} place${freePlaces > 1 ? 's' : ''} libre${freePlaces > 1 ? 's' : ''}.` : 'Toutes les places sont occupées.'}
      </p>
      {canManage ? (
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => change('add')} disabled={busy !== null}>
            {busy === 'add' ? 'Ajout…' : `Ajouter une place (+${EXTRA_SEAT_PRICE} € / mois)`}
          </Button>
          {extra > 0 && (
            <Button variant="ghost" onClick={() => change('remove')} disabled={busy !== null || freePlaces <= 0}>
              {busy === 'remove' ? 'Retrait…' : 'Retirer une place libre'}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Les places se gèrent depuis « Gestion du cabinet ».
        </p>
      )}
    </div>
  )
}
