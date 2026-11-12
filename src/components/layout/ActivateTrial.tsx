import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { PLANS, WOUI_LOGO_URL } from '../../lib/constants'
import { startCheckout, TRIAL_DAYS } from '../../lib/billing'
import type { BillingInterval, Doctor, PlanId } from '../../types'

interface ActivateTrialProps {
  doctor: Doctor
  refetchDoctor: () => Promise<void>
  onSignOut: () => void
}

/**
 * Écran affiché tant que le praticien n'a pas enregistré sa carte (plan_status = 'incomplete').
 * L'essai de 7 jours démarre dans Stripe Checkout ; aucun prélèvement avant la fin de l'essai.
 * Au retour de Stripe (?checkout=success), on attend que le webhook active le compte.
 */
export function ActivateTrial({ doctor, refetchDoctor, onSignOut }: ActivateTrialProps) {
  const [searchParams] = useSearchParams()
  const returning = searchParams.get('checkout') === 'success'
  const [plan, setPlan] = useState<PlanId>(doctor.plan)
  const [interval, setBillingInterval] = useState<BillingInterval>(doctor.billing_interval ?? 'monthly')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitedTooLong, setWaitedTooLong] = useState(false)

  // Retour de Stripe : le webhook met quelques secondes à activer l'essai.
  useEffect(() => {
    if (!returning) return
    const timer = window.setInterval(() => void refetchDoctor(), 2000)
    const giveUp = window.setTimeout(() => {
      window.clearInterval(timer)
      setWaitedTooLong(true)
    }, 40000)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(giveUp)
    }
  }, [returning, refetchDoctor])

  const selected = PLANS.find((p) => p.id === plan) ?? PLANS[0]
  const amount = interval === 'yearly' ? `${selected.yearlyPrice} € / an` : `${selected.price} € / mois`
  const firstCharge = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

  const activate = async () => {
    setBusy(true)
    setError(null)
    const err = await startCheckout(plan, interval)
    if (err) {
      setBusy(false)
      setError(err)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--surface-page)' }}>
      <div
        className="w-full max-w-[560px] p-[clamp(1.75rem,5vw,48px)]"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
      >
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-[3px] p-[7px]" style={{ background: 'var(--action-accent)' }}>
            <img src={WOUI_LOGO_URL} alt="Woui" className="h-full w-full object-contain" />
          </div>

          {returning && !waitedTooLong ? (
            <>
              <h1 className="font-display text-[1.75rem]" style={{ color: 'var(--text-primary)' }}>
                Activation de votre essai…
              </h1>
              <p className="text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
                Votre carte est enregistrée. Encore quelques secondes et votre espace est prêt.
              </p>
              <Spinner />
            </>
          ) : (
            <>
              <h1 className="font-display text-[1.75rem]" style={{ color: 'var(--text-primary)' }}>
                Dernière étape : activez vos {TRIAL_DAYS} jours gratuits
              </h1>
              <p className="text-[0.9375rem] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
                {waitedTooLong
                  ? "L'activation prend plus de temps que prévu. Actualisez la page dans un instant, ou contactez le support si cela persiste."
                  : `Enregistrez votre carte pour démarrer l'essai. Aucun prélèvement aujourd'hui ; résiliable à tout moment avant le ${firstCharge}.`}
              </p>
            </>
          )}
        </div>

        {!(returning && !waitedTooLong) && (
          <>
            <div className="mb-4 flex items-center justify-center gap-1">
              {(['monthly', 'yearly'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBillingInterval(value)}
                  className="font-mono cursor-pointer rounded-[3px] px-[14px] py-[6px] text-[12px]"
                  style={{
                    background: interval === value ? 'var(--action-primary)' : 'transparent',
                    color: interval === value ? 'var(--action-primary-text)' : 'var(--text-muted)',
                    border: interval === value ? 'none' : '1px solid var(--border-subtle)',
                  }}
                >
                  {value === 'monthly' ? 'Mensuel' : 'Annuel −20 %'}
                </button>
              ))}
            </div>

            <div className="mb-6 grid grid-cols-3 gap-2">
              {PLANS.map((p) => {
                const active = plan === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    className="flex flex-col items-center gap-1 rounded-[3px] px-2 py-3"
                    style={{
                      background: active ? 'var(--surface-card-alt)' : 'transparent',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="text-[0.8125rem] font-semibold">{p.name}</span>
                    <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      {interval === 'yearly' ? `${p.yearlyPrice} € / an` : `${p.price} € / mois`}
                    </span>
                  </button>
                )
              })}
            </div>

            <div
              className="mb-6 flex flex-col gap-2 p-4 text-[0.875rem]"
              style={{ background: 'var(--surface-card-alt)', borderRadius: 3, color: 'var(--text-secondary)' }}
            >
              <div className="flex justify-between">
                <span>Aujourd'hui</span>
                <b style={{ color: 'var(--text-primary)' }}>0 €</b>
              </div>
              <div className="flex justify-between">
                <span>À partir du {firstCharge}</span>
                <b style={{ color: 'var(--text-primary)' }}>{amount}</b>
              </div>
            </div>

            {error && (
              <p className="mb-4 text-center text-[13px]" style={{ color: 'var(--danger-text)' }}>
                {error}
              </p>
            )}

            <Button variant="primary" className="w-full justify-center" onClick={activate} disabled={busy}>
              {busy ? 'Redirection vers le paiement sécurisé…' : `Démarrer mon essai gratuit — ${selected.name}`}
            </Button>
            <p className="mt-4 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Paiement sécurisé par Stripe. Rappel par email avant la fin de l'essai. Sans engagement.
            </p>
          </>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={onSignOut}
            className="cursor-pointer text-[13px]"
            style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}
