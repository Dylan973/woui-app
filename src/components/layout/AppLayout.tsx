import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { ActivateTrial } from './ActivateTrial'
import { SendModal } from '../dashboard/SendModal'
import { usePatients } from '../../hooks/usePatients'
import { Toast, type ToastType } from '../ui/Toast'
import { Preloader } from '../ui/Preloader'
import { ClinicWelcomeModal } from '../profiles/ClinicModals'
import { CabinetSetup } from '../profiles/CabinetSetup'
import { PinOfferModal } from '../profiles/PinOfferModal'
import { SignatureSetupModal } from '../profiles/SignatureSetupModal'
import { PinDialog } from '../profiles/PinDialog'
import { ArchiveReminderModal } from '../settings/ArchiveReminderModal'
import { countSignedInYear, exportReminderKey } from '../../lib/exportConsents'
import { useProfilePins } from '../../hooks/useProfilePins'
import { signAvatarUrls } from '../../lib/avatar'
import { supabase } from '../../lib/supabase'
import { useConsents } from '../../hooks/useConsents'
import { usePractitioners } from '../../hooks/usePractitioners'
import { PLANS } from '../../lib/constants'
import { countThisMonth } from '../../lib/usage'
import { hasSubscription, trialDaysLeft } from '../../lib/billing'
import {
  MAIN_PROFILE,
  buildProfiles,
  canSendQuotes,
  canUsePin,
  markSignaturePromptSeen,
  signaturePromptSeen,
  canUseProfiles,
  isCabinetAccount,
  practitionerPlaces,
  profileName,
  clinicWelcomeSeen,
  markClinicWelcomeSeen,
  readActiveProfile,
  writeActiveProfile,
  writeCabinetSession,
} from '../../lib/profiles'
import type { Patient, Doctor, Profile } from '../../types'

export interface DashboardOutletContext {
  doctor: Doctor
  consents: ReturnType<typeof useConsents>['consents']
  consentsLoading: boolean
  refetchConsents: () => Promise<void>
  resendConsent: ReturnType<typeof useConsents>['resendConsent']
  /** Ouvre « Nouvel envoi », éventuellement pour un patient déjà connu. */
  openSendModal: (patient?: Patient | null) => void
  /** Fiches patients du compte. */
  patients: Patient[]
  showToast: (msg: string, type?: ToastType) => void
  refetchDoctor: () => Promise<void>
  /** Titulaire du compte + profils praticiens actifs (offre Clinique). */
  profiles: Profile[]
  activeProfile: Profile
  /** false tant qu'un compte à plusieurs profils n'a pas choisi le sien. */
  profileChosen: boolean
  /** Offre Pro ou Clinique en cours : les profils praticiens sont utilisables. */
  profilesEnabled: boolean
  selectProfile: (profileId: string) => void
  practitionersApi: Pick<
    ReturnType<typeof usePractitioners>,
    'createPractitioner' | 'updatePractitioner' | 'archivePractitioner' | 'setPractitionerPhoto' | 'verifyRpps' | 'refetch'
  >
  /** Offre Clinique : compte du cabinet (le profil « main » est « Gestion du cabinet »). */
  isCabinet: boolean
  /** Compte cabinet : profils praticiens possibles en plus du titulaire (Pro : 1 ; Clinique : 4 + places payées en plus). */
  practitionerPlaces: number
  /** Après un changement de signature et de tampon : recharge le profil et affiche le message. */
  onSignatureSaved: (message: string) => Promise<void>
  /** Offre Clinique, profil du titulaire : il peut afficher les envois de tout le cabinet. */
  cabinetViewAvailable: boolean
  cabinetView: boolean
  setCabinetView: (on: boolean) => void
  /** Profil (titulaire ou praticien) au nom duquel un envoi a été fait. */
  profileOf: (practitionerId: string | null) => Profile
  /** Déconnexion du compte (retour à l'écran de connexion). */
  signOut: () => void
  /** Profil du titulaire du compte : seul habilité à gérer l'abonnement quand le cabinet a plusieurs profils. */
  canManageBilling: boolean
  /** Codes à 4 chiffres des profils (offres Pro et Clinique). */
  pinApi: ReturnType<typeof useProfilePins>
  /** Le code de profil est utilisable par ce compte. */
  pinEnabled: boolean
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
  const [sendPatient, setSendPatient] = useState<Patient | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null)

  const location = useLocation()
  const { consents: allConsents, loading: consentsLoading, sendConsent, resendConsent, refetch } = useConsents(doctor?.id ?? null)
  const { patients, refetch: refetchPatients } = usePatients(doctor?.id ?? null)
  const {
    practitioners,
    loading: practitionersLoading,
    refetch: refetchPractitioners,
    createPractitioner,
    updatePractitioner,
    archivePractitioner,
    setPractitionerPhoto,
    verifyRpps,
  } = usePractitioners(doctor?.id ?? null)
  // Configuration de l'offre Clinique en cours (reste affichée jusqu'à « Terminer »).
  const setupKey = `woui-cabinet-setup-${doctor?.id ?? ''}`
  const [, setSetupTick] = useState(0)
  const readSetupOpen = () => {
    try {
      return sessionStorage.getItem(setupKey) === '1'
    } catch {
      return false
    }
  }
  const [signatureDismissed, setSignatureDismissed] = useState(false)
  const pinApi = useProfilePins(doctor?.id ?? null)
  const [creatingPin, setCreatingPin] = useState(false)
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({})
  const photoPaths = [doctor?.photo_path, ...practitioners.map((p) => p.photo_path)].filter(Boolean).join('|')
  useEffect(() => {
    let cancelled = false
    void signAvatarUrls(photoPaths ? photoPaths.split('|') : []).then((urls) => !cancelled && setAvatarUrls(urls))
    return () => {
      cancelled = true
    }
  }, [photoPaths])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const [cabinetView, setCabinetView] = useState(false)
  const doctorId = doctor?.id ?? null
  // Rappel annuel : archive des documents signés l'année précédente (titulaire du compte).
  const [archiveReminder, setArchiveReminder] = useState<{ year: number; count: number } | null>(null)
  useEffect(() => {
    if (!doctorId) return
    const year = new Date().getFullYear() - 1
    const key = exportReminderKey(doctorId, year)
    try {
      const state = localStorage.getItem(key)
      if (state === 'done' || (state && Number(state) > Date.now())) return
    } catch {
      return
    }
    let cancelled = false
    void countSignedInYear(doctorId, year).then((count) => !cancelled && count > 0 && setArchiveReminder({ year, count }))
    return () => {
      cancelled = true
    }
  }, [doctorId])
  // Numéro RPPS saisi à l'inscription : vérification dans l'Annuaire Santé, une fois par session.
  const rppsPending = Boolean(doctor?.rpps) && (doctor?.rpps_status ?? 'unverified') === 'unverified'
  useEffect(() => {
    if (!doctorId || !rppsPending) return
    const key = `woui-rpps-check-${doctorId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      return
    }
    void supabase.functions.invoke('verify-rpps', { body: {} }).then(() => refetchDoctor())
  }, [doctorId, rppsPending, refetchDoctor])
  useEffect(() => {
    setActiveId(doctorId ? readActiveProfile(doctorId) : null)
  }, [doctorId])

  // Devis signé en direct : l'assistante est prévenue que le patient est prêt pour les soins.
  const quoteSeen = useRef<Map<string, string | null> | null>(null)
  useEffect(() => {
    const previous = quoteSeen.current
    quoteSeen.current = new Map(allConsents.map((c) => [c.id, c.quote_signed_at ?? null]))
    if (!previous) return
    const fresh = allConsents.find((c) => c.quote_signed_at && previous.has(c.id) && !previous.get(c.id))
    if (fresh) setToast({ msg: `${fresh.patient} a signé son devis : prêt pour planifier les soins`, type: 'success' })
  }, [allConsents])

  if (authLoading) {
    return (
      <Preloader />
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
  const profiles = buildProfiles(doctor, practitioners).map((p) => ({ ...p, photoUrl: p.photo_path ? (avatarUrls[p.photo_path] ?? null) : null }))
  const pinEnabled = canUsePin(doctor) && pinApi.available
  const multiProfile = profiles.length > 1
  const chosen = profiles.find((p) => p.id === (activeId ?? readActiveProfile(doctor.id))) ?? null
  const activeProfile = chosen ?? profiles[0]
  const onProfilesPage = location.pathname === '/profiles'

  // Un profil protégé par un code doit être déverrouillé, même s'il est seul (offre Pro).
  const needsChoice = multiProfile || (pinApi.pins[MAIN_PROFILE]?.hasPin ?? false)

  if ((profilesEnabled && practitionersLoading) || pinApi.loading) {
    return (
      <Preloader />
    )
  }
  // Offre Clinique : configuration du cabinet (compte cabinet, code de gestion, au moins un praticien).
  const isCabinet = isCabinetAccount(doctor)
  const needsSetup =
    doctor.plan === 'clinic' && profilesEnabled && (!isCabinet || !(pinApi.pins[MAIN_PROFILE]?.hasPin ?? false) || profiles.filter((p) => !p.isMain).length === 0)
  if (needsSetup || readSetupOpen()) {
    if (needsSetup) {
      try {
        sessionStorage.setItem(setupKey, '1')
      } catch {
        /* sans stockage, l'assistant se ferme au premier praticien */
      }
    }
    return (
      <CabinetSetup
        doctor={doctor}
        practitioners={profiles.filter((p) => !p.isMain)}
        pinApi={pinApi}
        practitionersApi={{ createPractitioner, verifyRpps, setPractitionerPhoto, refetch: refetchPractitioners }}
        refetchDoctor={refetchDoctor}
        onDone={() => {
          try {
            sessionStorage.removeItem(setupKey)
          } catch {
            /* rien à effacer */
          }
          setSetupTick((n) => n + 1)
          markClinicWelcomeSeen(doctor.id)
          navigate('/profiles')
        }}
        onSignOut={() => void onSignOut().then(() => navigate('/login'))}
      />
    )
  }
  if ((needsChoice || isCabinet) && !chosen && !onProfilesPage) return <Navigate to="/profiles" replace />

  // Un consentement dont le profil a été retiré revient au titulaire du compte.
  const activeIds = new Set(profiles.map((p) => p.id))
  const ownerOf = (practitionerId: string | null) => (practitionerId && activeIds.has(practitionerId) ? practitionerId : MAIN_PROFILE)
  const profileOf = (practitionerId: string | null) => profiles.find((p) => p.id === ownerOf(practitionerId)) ?? profiles[0]
  // Vue « Tout le cabinet » : réservée au profil du titulaire, pour qu'un profil protégé par un code
  // ne soit pas lisible depuis celui d'un autre praticien.
  const cabinetViewAvailable = multiProfile && activeProfile.isMain
  // Gestion du cabinet : toujours la vue de tout le cabinet.
  const showCabinet = cabinetViewAvailable && (cabinetView || isCabinet)
  const consents =
    multiProfile && !showCabinet ? allConsents.filter((c) => ownerOf(c.practitioner_id) === activeProfile.id) : allConsents

  const selectProfile = (profileId: string) => {
    // La session « Gestion du cabinet » ne suit pas vers le profil d'un praticien.
    if (profileId !== MAIN_PROFILE) writeCabinetSession(doctor.id, null)
    writeActiveProfile(doctor.id, profileId)
    setActiveId(profileId)
    navigate('/dashboard')
  }
  const showClinicWelcome =
    !isCabinet && profilesEnabled && !multiProfile && !onProfilesPage && !welcomeDismissed && !clinicWelcomeSeen(doctor.id)
  // Première ouverture d'un profil : on propose d'enregistrer sa signature et son tampon (toutes les offres).
  const showSignatureSetup =
    activeProfile.kind !== 'cabinet' &&
    !onProfilesPage &&
    !showClinicWelcome &&
    !signatureDismissed &&
    !activeProfile.signature_path &&
    !signaturePromptSeen(doctor.id, activeProfile.id)
  const closeSignatureSetup = () => {
    markSignaturePromptSeen(doctor.id, activeProfile.id)
    setSignatureDismissed(true)
  }
  const onSignatureSaved = async (message: string) => {
    await Promise.all([refetchDoctor(), refetchPractitioners()])
    closeSignatureSetup()
    setToast({ msg: message, type: 'success' })
  }
  // Première ouverture d'un profil : on propose une fois de le protéger par un code.
  const activePin = pinApi.pins[activeProfile.id]
  const showPinOffer = pinEnabled && activeProfile.kind !== 'cabinet' && !onProfilesPage && !showClinicWelcome && !showSignatureSetup && !creatingPin && !activePin?.hasPin && !activePin?.offered
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
    openSendModal: (patient?: Patient | null) => {
      setSendPatient(patient ?? null)
      setShowSend(true)
    },
    patients,
    showToast,
    refetchDoctor,
    profiles,
    activeProfile,
    profileChosen: chosen !== null || !needsChoice,
    profilesEnabled,
    selectProfile,
    practitionersApi: { createPractitioner, updatePractitioner, archivePractitioner, setPractitionerPhoto, verifyRpps, refetch: refetchPractitioners },
    isCabinet,
    practitionerPlaces: practitionerPlaces(doctor),
    pinApi,
    pinEnabled,
    onSignatureSaved,
    cabinetViewAvailable,
    cabinetView: showCabinet,
    setCabinetView,
    profileOf,
    signOut: () => void onSignOut().then(() => navigate('/login')),
    canManageBilling: activeProfile.isMain,
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
        canSend={activeProfile.kind !== 'cabinet'}
        patients={patients}
        onOpenSendModal={() => {
          setSendPatient(null)
          setShowSend(true)
        }} onSignOut={() => onSignOut().then(() => navigate('/login'))} />

      <main style={{ padding: '40px 34px 90px', maxWidth: 1520, margin: '0 auto' }} className="!px-[clamp(1rem,4vw,34px)]">
        <Outlet context={outletContext} />
      </main>

      {showSend && (
        <SendModal
          onClose={() => setShowSend(false)}
          onSend={async (form, senderId) => {
            const sender = senderId ?? activeProfile.id
            const result = await sendConsent(form, sender === MAIN_PROFILE ? null : sender)
            if (!result.error) {
              showToast(`Lien envoyé à ${form.patient}`)
              void refetchPatients()
            }
            return result
          }}
          planId={doctor.plan}
          quotesEnabled={canSendQuotes(doctor)}
          doctorId={doctor.id}
          senders={cabinetViewAvailable && !isCabinet ? profiles : null}
          patients={patients}
          initialPatient={sendPatient}
          used={countThisMonth(allConsents)}
          limit={plan.limits.consents}
        />
      )}

      {archiveReminder && activeProfile.isMain && !showClinicWelcome && !showSignatureSetup && !showPinOffer && !creatingPin && (
        <ArchiveReminderModal
          year={archiveReminder.year}
          count={archiveReminder.count}
          onLater={() => {
            try {
              localStorage.setItem(exportReminderKey(doctor.id, archiveReminder.year), String(Date.now() + 7 * 24 * 3600 * 1000))
            } catch {
              /* rappel à la prochaine ouverture */
            }
            setArchiveReminder(null)
          }}
          onDownload={() => {
            setArchiveReminder(null)
            navigate(`/settings?tab=documents&archive=${archiveReminder.year}`)
          }}
        />
      )}
      {showSignatureSetup && (
        <SignatureSetupModal doctorId={doctor.id} profile={activeProfile} onSaved={onSignatureSaved} onLater={closeSignatureSetup} />
      )}
      {showPinOffer && (
        <PinOfferModal
          profileLabel={profileName(activeProfile)}
          onCreate={() => {
            void pinApi.markOffered(activeProfile.id)
            setCreatingPin(true)
          }}
          onDecline={() => void pinApi.markOffered(activeProfile.id)}
        />
      )}
      {creatingPin && (
        <PinDialog
          steps={[
            { key: 'new', title: 'Choisissez votre code' },
            { key: 'confirm', title: 'Confirmez votre code', hint: 'Saisissez-le une seconde fois' },
          ]}
          onClose={() => setCreatingPin(false)}
          onComplete={async (values) => {
            const message = await pinApi.setPin(activeProfile.id, values.new ?? '')
            if (!message) {
              setCreatingPin(false)
              showToast('Code créé. Il sera demandé à la prochaine ouverture du profil.')
            }
            return message
          }}
        />
      )}

      {showClinicWelcome && (
        <ClinicWelcomeModal plan={doctor.plan === 'pro' ? 'pro' : 'clinic'} onCreate={() => closeClinicWelcome(true)} onLater={() => closeClinicWelcome(false)} />
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
