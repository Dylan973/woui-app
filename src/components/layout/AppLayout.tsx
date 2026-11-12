import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { ActivateTrial } from './ActivateTrial'
import { SendModal } from '../dashboard/SendModal'
import { Toast, type ToastType } from '../ui/Toast'
import { Spinner } from '../ui/Spinner'
import { ClinicWelcomeModal } from '../profiles/ClinicModals'
import { useConsents } from '../../hooks/useConsents'
import { usePractitioners } from '../../hooks/usePractitioners'
import { PLANS } from '../../lib/constants'
import { countThisMonth } from '../../lib/usage'
import { hasSubscription, trialDaysLeft } from '../../lib/billing'
import {
  MAIN_PROFILE,
  buildProfiles,
  canUseProfiles,
  clinicWelcomeSeen,
  markClinicWelcomeSeen,
  readActiveProfile,
  writeActiveProfile,
} from '../../lib/profiles'
import type { Doctor, Profile } from '../../types'

export interface DashboardOutletContext {
  doctor: Doctor
  consents: ReturnType<typeof useConsents>['consents']
  consentsLoading: boolean
  refetchConsents: () => Promise<void>
  resendConsent: ReturnType<typeof useConsents>['resendConsent']
  openSendModal: () => void
  showToast: (msg: string, type?: ToastType) => void
  refetchDoctor: () => Promise<void>
  /** Titulaire du compte + profils praticiens actifs (offre Clinique). */
  profiles: Profile[]
  activeProfile: Profile
  /** false tant qu'un compte à plusieurs profils n'a pas choisi le sien. */
  profileChosen: boolean
  /** Offre Clinique en cours : les profils praticiens sont utilisables. */
  profilesEnabled: boolean
  selectProfile: (profileId: string) => void
  practitionersApi: Pick<ReturnType<typeof usePractitioners>, 'createPractitioner' | 'updatePractitioner' | 'archivePractitioner'>
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

  const location = useLocation()
  const { consents: allConsents, loading: consentsLoading, sendConsent, resendConsent, refetch } = useConsents(doctor?.id ?? null)
  const { practitioners, loading: practitionersLoading, createPractitioner, updatePractitioner, archivePractitioner } = usePractitioners(
    doctor?.id ?? null
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const doctorId = doctor?.id ?? null
  useEffect(() => {
    setActiveId(doctorId ? readActiveProfile(doctorId) : null)
  }, [doctorId])

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

  // Profils praticiens (offre Clinique) : chaque praticien choisit le sien et ne voit que ses envois.
  const profilesEnabled = canUseProfiles(doctor)
  const profiles = buildProfiles(doctor, practitioners)
  const multiProfile = profiles.length > 1
  const chosen = profiles.find((p) => p.id === (activeId ?? readActiveProfile(doctor.id))) ?? null
  const activeProfile = chosen ?? profiles[0]
  const onProfilesPage = location.pathname === '/profiles'

  if (profilesEnabled && practitionersLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--surface-page)' }}>
        <Spinner />
      </div>
    )
  }
  if (multiProfile && !chosen && !onProfilesPage) return <Navigate to="/profiles" replace />

  // Un consentement dont le profil a été retiré revient au titulaire du compte.
  const activeIds = new Set(profiles.map((p) => p.id))
  const ownerOf = (practitionerId: string | null) => (practitionerId && activeIds.has(practitionerId) ? practitionerId : MAIN_PROFILE)
  const consents = multiProfile ? allConsents.filter((c) => ownerOf(c.practitioner_id) === activeProfile.id) : allConsents

  const selectProfile = (profileId: string) => {
    writeActiveProfile(doctor.id, profileId)
    setActiveId(profileId)
    navigate('/dashboard')
  }
  const showClinicWelcome =
    profilesEnabled && !multiProfile && !onProfilesPage && !welcomeDismissed && !clinicWelcomeSeen(doctor.id)
  const closeClinicWelcome = (goToProfiles: boolean) => {
    markClinicWelcomeSeen(doctor.id)
    setWelcomeDismissed(true)
    if (goToProfiles) navigate('/profiles?gerer=1')
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
    refetchDoctor,
    profiles,
    activeProfile,
    profileChosen: chosen !== null || !multiProfile,
    profilesEnabled,
    selectProfile,
    practitionersApi: { createPractitioner, updatePractitioner, archivePractitioner },
  }

  // Écran de sélection des profils : plein écran, sans l'en-tête du tableau de bord.
  if (onProfilesPage) {
    return (
      <div style={{ color: 'var(--text-primary)' }}>
        <Outlet context={outletContext} />
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </div>
    )
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
      <Header
        doctor={doctor}
        consents={consents}
        activeProfile={activeProfile}
        profilesEnabled={profilesEnabled}
        multiProfile={multiProfile}
        onOpenSendModal={() => setShowSend(true)} onSignOut={() => onSignOut().then(() => navigate('/login'))} />

      <main style={{ padding: '40px 34px 90px', maxWidth: 1520, margin: '0 auto' }} className="!px-[clamp(1rem,4vw,34px)]">
        <Outlet context={outletContext} />
      </main>

      {showSend && (
        <SendModal
          onClose={() => setShowSend(false)}
          onSend={async (form) => {
            const result = await sendConsent(form, activeProfile.isMain ? null : activeProfile.id)
            if (!result.error) showToast(`Lien envoyé à ${form.patient}`)
            return result
          }}
          planId={doctor.plan}
          used={countThisMonth(allConsents)}
          limit={plan.limits.consents}
        />
      )}

      {showClinicWelcome && <ClinicWelcomeModal onCreate={() => closeClinicWelcome(true)} onLater={() => closeClinicWelcome(false)} />}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}

/** Redirige vers /login si non authentifié — utilisé au niveau de la route parente. */
export function RequireAuthRedirect({ isAuthed }: { isAuthed: boolean }) {
  if (!isAuthed) return <Navigate to="/login" replace />
  return <Outlet />
}
