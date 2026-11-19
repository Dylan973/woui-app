import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ArchiveCard } from '../settings/ArchiveCard'
import { PLANS } from '../../lib/constants'
import { startCheckout } from '../../lib/billing'
import { isCabinetAccount, readCabinetSession } from '../../lib/profiles'
import type { Doctor } from '../../types'
import type { ToastType } from '../ui/Toast'

interface SubscriptionEndedProps {
  doctor: Doctor
  refetchDoctor: () => Promise<void>
  onSignOut: () => void
  /** Compte cabinet : code de « Gestion du cabinet », exigé pour reprendre l'abonnement. */
  openCabinetSession: (pin: string) => Promise<string | null>
  practitionerName: (practitionerId: string | null) => string
  showToast: (msg: string, type?: ToastType) => void
}

const card = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--card-ring)',
}

/**
 * Abonnement résilié ou arrivé à terme : Woui est verrouillé (aucun envoi, pas de tableau de bord).
 * Le cabinet peut reprendre l'abonnement, ou télécharger ses documents signés, qu'il doit conserver.
 */
export function SubscriptionEnded({ doctor, refetchDoctor, onSignOut, openCabinetSession, practitionerName, showToast }: SubscriptionEndedProps) {
  const [searchParams] = useSearchParams()
  const returning = searchParams.get('checkout') === 'success'
  const cabinet = isCabinetAccount(doctor)
  const [unlocked, setUnlocked] = useState(() => !cabinet || Boolean(readCabinetSession(doctor.id)))
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const plan = PLANS.find((p) => p.id === doctor.plan) ?? PLANS[1]
  const interval = doctor.billing_interval ?? 'monthly'

  // Retour de Stripe : le webhook réactive le compte en quelques secondes.
  useEffect(() => {
    if (!returning) return
    const timer = window.setInterval(() => void refetchDoctor(), 2000)
    const stop = window.setTimeout(() => window.clearInterval(timer), 40000)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(stop)
    }
  }, [returning, refetchDoctor])

  const unlock = async () => {
    setBusy(true)
    setError(null)
    const err = await openCabinetSession(pin)
    setBusy(false)
    if (err) setError(err)
    else setUnlocked(true)
  }

  const resume = async () => {
    setBusy(true)
    setError(null)
    const err = await startCheckout(plan.id, interval, doctor.id)
    if (err) {
      setBusy(false)
      setError(err)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-5 py-[clamp(2rem,8vh,80px)]">
      <div className="w-full max-w-[620px] p-[clamp(1.75rem,5vw,44px)]" style={card}>
        <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--danger-text)' }}>
          Abonnement résilié
        </div>
        <h1 className="font-display mt-3 text-[clamp(1.6rem,4vw,32px)] leading-[1.2]" style={{ color: 'var(--text-primary)' }}>
          Vous avez résilié votre abonnement
        </h1>
        <p className="mt-3 text-[1rem] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
          Réglez votre abonnement pour retrouver vos accès. Vos patients, vos envois et vos documents signés sont conservés : vous les retrouvez tels quels dès la
          reprise.
        </p>

        {returning ? (
          <p className="mt-6 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            Paiement reçu, réouverture de votre compte… Avec un prélèvement SEPA, la confirmation de la banque peut prendre quelques jours ouvrés.
          </p>
        ) : unlocked ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={resume} disabled={busy}>
              {busy ? 'Redirection…' : `Reprendre l’offre ${plan.name}`}
            </Button>
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              {interval === 'yearly' ? `${plan.yearlyPrice} € par an` : `${plan.price} € par mois`}, carte ou prélèvement SEPA
            </span>
          </div>
        ) : (
          <div className="mt-6">
            <p className="mb-3 text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
              L’abonnement du cabinet se reprend avec le code de Gestion du cabinet.
            </p>
            <div className="flex flex-wrap items-start gap-3">
              <div className="w-[180px]">
                <Input
                  label="Code de gestion"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </div>
              <Button variant="primary" onClick={unlock} disabled={busy || pin.length !== 4} className="mt-[26px]">
                {busy ? 'Vérification…' : 'Continuer'}
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p className="mt-3 text-[0.875rem]" style={{ color: 'var(--danger-text)' }}>
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 w-full max-w-[620px] p-[clamp(1.5rem,4vw,36px)]" style={card}>
        <h2 className="font-display mb-2 text-[20px]" style={{ color: 'var(--text-primary)' }}>
          Vos documents signés
        </h2>
        <p className="mb-5 text-[0.875rem] leading-[1.55]" style={{ color: 'var(--text-secondary)' }}>
          Les consentements et devis signés font partie du dossier de vos patients : téléchargez-les pour les conserver, même sans abonnement.
        </p>
        <ArchiveCard
          doctorId={doctor.id}
          accountCreatedAt={doctor.created_at}
          scope={null}
          scopeLabel={null}
          practitionerName={practitionerName}
          showToast={showToast}
        />
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="mt-6 cursor-pointer text-[13px]"
        style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
      >
        Se déconnecter
      </button>
    </div>
  )
}
