import { useState } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { ActivateTrial } from './ActivateTrial'
import { SendModal } from '../dashboard/SendModal'
import { Toast, type ToastType } from '../ui/Toast'
import { Spinner } from '../ui/Spinner'
import { useConsents } from '../../hooks/useConsents'
import { PLANS } from '../../lib/constants'
import { countThisMonth } from '../../lib/usage'
import { hasSubscription, trialDaysLeft } from '../../lib/billing'
import type { Doctor } from '../../types'

export interface DashboardOutletContext {
  doctor: Doctor
  consents: ReturnType<typeof useConsents>['consents']
  consentsLoading: boolean
  refetchConsents: () => Promise<void>
  resendConsent: ReturnType<typeof useConsents>['resendConsent']
  openSendModal: () => void
  showToast: (msg: string, type?: ToastType) => void
}

interface AppLayoutProps {
  doctor: Doctor | null
  authLoading: boolean
  onSignOut: () => Promise<void>
  refetchDoctor: () => Promise<void>
}

export function AppLayout({ doctor, authLoading, onSignOut, refetchDoctor }: AppLayoutProps) {
  const navigate = useNavigate()
  const [showSend, setShowSend] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null)

  const { consents, loading: consentsLoading, sendConsent, resendConsent, refetch } = useConsents(doctor?.id ?? null)

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--surface-page)' }}>
        <Spinner />
      </div>
    )
  }

  if (!doctor) {
    // Authentifié côté Supabase Auth mais aucune fiche `doctors` associée.
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
        style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
      >
        <div className="text-5xl">🩺</div>
        <h1 className="font-display text-xl">Profil praticien introuvable</h1>
        <p className="max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
          Votre compte est authentifié mais aucune fiche praticien n'est associée. Contactez le support Woui.
        </p>
        <button
          onClick={() => onSignOut().then(() => navigate('/login'))}
          className="cursor-pointer rounded-[3px] px-4 py-2 text-sm"
          style={{ background: 'var(--action-accent)', color: 'var(--action-accent-text)', border: 'none' }}
        >
          Se déconnecter
        </button>
      </div>
    )
  }

  // Carte pas encore enregistrée : l'essai gratuit n'a pas démarré.
  if (doctor.plan_status === 'incomplete') {
    return <ActivateTrial doctor={doctor} refetchDoctor={refetchDoctor} onSignOut={() => onSignOut().then(() => navigate('/login'))} />
  }

  const plan = PLANS.find((p) => p.id === doctor.plan) ?? PLANS[0]
  const showToast = (msg: string, type: ToastType = 'success') => setToast({ msg, type })
  const subscribed = hasSubscription(doctor)
  const trialLeft = trialDaysLeft(doctor)
  const billingAlert =
    trialLeft !== null
      ? trialLeft > 0
        ? `Essai gratuit : ${trialLeft} jour${trialLeft > 1 ? 's' : ''} restant${trialLeft > 1 ? 's' : ''}.${
            subscribed && doctor.plan_expires_at
              ? ` Premier prélèvement le ${new Date(doctor.plan_expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.`
              : ''
          }`
        : 'Votre essai gratuit est terminé.'
      : doctor.plan_status === 'past_due'
        ? 'Le dernier paiement a échoué.'
        : doctor.plan_status === 'cancelled'
          ? 'Votre abonnement est résilié.'
          : null

  const outletContext: DashboardOutletContext = {
    doctor,
    consents,
    consentsLoading,
    refetchConsents: refetch,
    resendConsent,
    openSendModal: () => setShowSend(true),
    showToast,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', color: 'var(--text-primary)' }}>
      {billingAlert && (
        <div
          className="flex flex-wrap items-center justify-center gap-3 px-4 py-2 text-center text-[13px]"
          style={{ background: 'var(--surface-card-alt)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <span>{billingAlert}</span>
          <button
            onClick={() => navigate('/settings?tab=plan')}
            className="cursor-pointer font-semibold"
            style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}
          >
            {trialLeft !== null ? (subscribed ? 'Gérer mon abonnement →' : 'Choisir mon plan →') : 'Régler maintenant →'}
          </button>
        </div>
      )}
      <Header doctor={doctor} consents={consents} onOpenSendModal={() => setShowSend(true)} onSignOut={() => onSignOut().then(() => navigate('/login'))} />

      <main style={{ padding: '40px 34px 90px', maxWidth: 1520, margin: '0 auto' }} className="!px-[clamp(1rem,4vw,34px)]">
        <Outlet context={outletContext} />
      </main>

      {showSend && (
        <SendModal
          onClose={() => setShowSend(false)}
          onSend={async (form) => {
            const result = await sendConsent(form)
            if (!result.error) showToast(`Lien envoyé à ${form.patient}`)
            return result
          }}
          planId={doctor.plan}
          used={countThisMonth(consents)}
          limit={plan.limits.consents}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}

/** Redirige vers /login si non authentifié — utilisé au niveau de la route parente. */
export function RequireAuthRedirect({ isAuthed }: { isAuthed: boolean }) {
  if (!isAuthed) return <Navigate to="/login" replace />
  return <Outlet />
}
