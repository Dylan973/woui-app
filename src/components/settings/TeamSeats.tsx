import { useState } from 'react'
import { AddSeatDialog } from './AddSeatDialog'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { changeExtraSeats } from '../../lib/billing'
import { EXTRA_SEAT_PRICE, practitionerPlaces } from '../../lib/profiles'
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

/** Offre Clinique : boutons d'achat et de retrait des places de praticien en plus (4 comprises). */
export function TeamSeats({ doctor, practitionerCount, canManage, refetchDoctor, showToast }: TeamSeatsProps) {
  const [busy, setBusy] = useState<'add' | 'remove' | null>(null)
  const [buying, setBuying] = useState(false)
  const extra = Math.max(doctor.extra_seats ?? 0, 0)
  const places = practitionerPlaces(doctor)
  const freePlaces = places - practitionerCount

  const change = async (action: 'remove') => {
    setBusy(action)
    const { error } = await changeExtraSeats(action, doctor.id)
    if (!error) await refetchDoctor()
    setBusy(null)
    showToast(
      error ?? 'Place retirée de l’abonnement',
      error ? 'warning' : 'success'
    )
  }

  // Boutons seuls : ils se placent à côté de « Gérer les profils ». Le compteur x / total est affiché au-dessus (TeamList).
  if (!canManage) return null
  return (
    <>
      <Button variant="primary" onClick={() => setBuying(true)} disabled={busy !== null}>
        {`Ajouter une place (+${EXTRA_SEAT_PRICE} € / mois)`}
      </Button>
      {extra > 0 && (
        <Button
          variant="ghost"
          onClick={() => change('remove')}
          disabled={busy !== null || freePlaces <= 0}
          title={freePlaces <= 0 ? 'Archivez d’abord un profil pour libérer une place.' : undefined}
        >
          {busy === 'remove' ? 'Retrait…' : 'Retirer une place libre'}
        </Button>
      )}
      {buying && (
        <Modal onClose={() => setBuying(false)} maxWidth={500}>
          <h2 className="font-display mb-3 text-[22px]" style={{ color: 'var(--text-primary)' }}>
            Ajouter un praticien
          </h2>
          <AddSeatDialog
            doctorId={doctor.id}
            onCancel={() => setBuying(false)}
            onDone={async () => {
              await refetchDoctor()
              setBuying(false)
              showToast(`Paiement accepté, place ajoutée (+${EXTRA_SEAT_PRICE} € / mois)`)
            }}
          />
        </Modal>
      )}
    </>
  )
}
