import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { DocumentsTab } from '../components/settings/DocumentsTab'
import { PinDialog, type PinStepKey } from '../components/profiles/PinDialog'
import { profileName } from '../lib/profiles'
import { supabase } from '../lib/supabase'
import { PLANS, PLAN_LIMITS_LABEL } from '../lib/constants'
import { hasSubscription, openBillingPortal, startCheckout, trialDaysLeft } from '../lib/billing'
import type { BillingInterval, PlanId } from '../types'
import { countThisMonth } from '../lib/usage'
import type { DashboardOutletContext } from '../components/layout/AppLayout'
import { CabinetIdentity } from '../components/settings/CabinetIdentity'
import { ArchiveCard } from '../components/settings/ArchiveCard'
import { CabinetInfoCard, PractitionerInfoCard } from '../components/settings/CabinetProfileCards'
import { TeamSeats } from '../components/settings/TeamSeats'

type TabId = 'profile' | 'team' | 'documents' | 'plan' | 'notifications' | 'security'

const TABS: { id: TabId; label: string; soon?: boolean }[] = [
  { id: 'profile', label: 'Profil' },
  { id: 'team', label: 'Équipe' },
  { id: 'documents', label: 'Documents PDF' },
  { id: 'plan', label: 'Abonnement' },
  { id: 'notifications', label: 'Notifications', soon: true },
  { id: 'security', label: 'Sécurité' },
]

function isTabId(value: string | null): value is TabId {
  return TABS.some((t) => t.id === value)
}

function SoonTag() {
  return (
    <span
      className="font-mono text-[9px] uppercase tracking-[0.1em]"
      style={{ color: 'var(--text-muted)' }}
    >
      Bientôt
    </span>
  )
}

function Eyebrow({ children }: { children: string }) {
  return (
    <div
      className="flex items-center gap-[10px] text-[0.8125rem] font-semibold uppercase"
      style={{ color: 'var(--text-accent)', letterSpacing: 'var(--tracking-eyebrow)' }}
    >
      <span className="h-px w-[18px]" style={{ background: 'currentColor' }} />
      {children}
    </div>
  )
}

export function SettingsPage() {
  const { doctor, consents, showToast, refetchDoctor, profiles, profilesEnabled } = useOutletContext<DashboardOutletContext>()
  const { activeProfile, pinApi, pinEnabled, onSignatureSaved, profileOf, canManageBilling, isCabinet, practitionersApi, practitionerPlaces } =
    useOutletContext<DashboardOutletContext>()
  const cabinetSpace = isCabinet && activeProfile.isMain
  const navigate = useNavigate()
  const [rpps, setRpps] = useState(doctor.rpps ?? '')
  const [rppsBusy, setRppsBusy] = useState(false)
  const rppsStatus = doctor.rpps ? (doctor.rpps_status ?? 'unverified') : null
  const verifyRpps = async () => {
    const value = rpps.replace(/\s/g, '')
    if (!/^[0-9]{11}$/.test(value)) {
      showToast('Le numéro RPPS contient 11 chiffres.', 'warning')
      return
    }
    setRppsBusy(true)
    const { data, error } = await supabase.functions.invoke('verify-rpps', { body: { rpps: value } })
    setRppsBusy(false)
    if (error) {
      showToast('Le numéro n’a pas pu être enregistré. Réessayez.', 'warning')
      return
    }
    await refetchDoctor()
    const status = (data as { status?: string } | null)?.status
    showToast(
      status === 'verified'
        ? 'Numéro RPPS vérifié'
        : status === 'not_found'
          ? 'Ce numéro est introuvable dans l’Annuaire Santé.'
          : status === 'mismatch'
            ? 'Le numéro existe, mais le nom ne correspond pas à celui du compte.'
            : 'Numéro enregistré. La vérification sera faite prochainement.',
      status === 'verified' || status === 'unverified' ? 'success' : 'warning'
    )
  }
  const [pinMode, setPinMode] = useState<'create' | 'change' | 'remove' | null>(null)
  const hasPin = pinApi.pins[activeProfile.id]?.hasPin ?? false
  // L'onglet vit dans l'URL : « Voir les plans » (modale de limite atteinte) ouvre
  // directement /settings?tab=plan, et le lien reste partageable.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: TabId = isTabId(tabParam) ? tabParam : 'profile'
  const setTab = (next: TabId) => setSearchParams(next === 'profile' ? {} : { tab: next }, { replace: true })
  const [form, setForm] = useState({
    first_name: doctor.first_name ?? '',
    last_name: doctor.last_name ?? '',
    specialty: doctor.specialty ?? '',
    phone: doctor.phone ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [interval, setBillingInterval] = useState<BillingInterval>(doctor.billing_interval ?? 'monthly')
  const [billingBusy, setBillingBusy] = useState<string | null>(null)

  // Retour de Stripe Checkout : message de confirmation (le webhook met le plan à jour).
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      showToast('Paiement validé, merci ! Votre abonnement est actif.')
      setSearchParams({ tab: 'plan' }, { replace: true })
    }
  }, [searchParams, setSearchParams, showToast])

  const choosePlan = async (planId: PlanId) => {
    setBillingBusy(planId)
    const error = await startCheckout(planId, interval, doctor.id)
    if (error) {
      setBillingBusy(null)
      showToast(error, 'warning')
    }
  }

  const manageBilling = async () => {
    setBillingBusy('portal')
    const error = await openBillingPortal(doctor.id)
    if (error) {
      setBillingBusy(null)
      showToast(error, 'warning')
    }
  }

  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('doctors')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', doctor.id)
    if (!error) await refetchDoctor()
    setSaving(false)
    showToast(error ? `Erreur : ${error.message}` : 'Profil enregistré', error ? 'warning' : 'success')
  }

  const plan = PLANS.find((p) => p.id === doctor.plan) ?? PLANS[0]
  const limit = plan.limits.consents
  const usedThisMonth = countThisMonth(consents)
  const pct = Math.min(100, Math.round((usedThisMonth / (limit >= 999999 ? 100 : limit)) * 100))

  const subscribed = hasSubscription(doctor)
  const trialLeft = trialDaysLeft(doctor)
  const trialEndLabel = doctor.plan_expires_at
    ? new Date(doctor.plan_expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    : null
  const statusLabel =
    doctor.plan_status === 'trialing'
      ? 'Essai gratuit'
      : doctor.plan_status === 'cancelled'
        ? 'Abonnement résilié'
        : doctor.plan_status === 'past_due'
          ? 'Paiement en échec'
          : 'Plan actuel'

  const soonTitle = { notifications: 'Notifications' }[tab as string]

  const pinSteps: Record<'create' | 'change' | 'remove', { key: PinStepKey; title: string; hint?: string }[]> = {
    create: [
      { key: 'new', title: 'Choisissez votre code' },
      { key: 'confirm', title: 'Confirmez votre code', hint: 'Saisissez-le une seconde fois' },
    ],
    change: [
      { key: 'current', title: 'Votre code actuel' },
      { key: 'new', title: 'Votre nouveau code' },
      { key: 'confirm', title: 'Confirmez le nouveau code', hint: 'Saisissez-le une seconde fois' },
    ],
    remove: [{ key: 'current', title: 'Votre code actuel', hint: 'Saisissez-le pour le supprimer' }],
  }

  return (
    <section className="max-w-[1100px]" style={{ animation: 'nb-rise 0.5s var(--ease-standard) both' }}>
      <Eyebrow>Compte</Eyebrow>
      <h1 className="font-display my-4 text-[clamp(1.6rem,3.5vw,40px)]" style={{ color: 'var(--text-primary)' }}>
        Paramètres
      </h1>

      <div className="mb-9 flex flex-wrap gap-1">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex flex-shrink-0 items-center gap-[9px] px-4 py-[10px] text-[0.9375rem]"
              style={{
                background: active ? 'var(--surface-card-alt)' : 'none',
                border: 'none',
                borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                borderRadius: 3,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {t.label}
              {t.soon && <SoonTag />}
            </button>
          )
        })}
      </div>

      {tab === 'profile' && isCabinet && activeProfile.isMain && (
        <CabinetInfoCard doctor={doctor} refetchDoctor={refetchDoctor} showToast={showToast} onSeePlans={() => setTab('plan')} />
      )}
      {tab === 'profile' && isCabinet && !activeProfile.isMain && (
        <PractitionerInfoCard key={activeProfile.id} doctor={doctor} profile={activeProfile} practitionersApi={practitionersApi} showToast={showToast} />
      )}
      {tab === 'profile' && !isCabinet && (
        <div
          className="p-[clamp(1.5rem,4vw,36px)]"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4, animation: 'nb-rise 0.35s var(--ease-standard) both' }}
        >
          <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
            Informations du praticien
          </h2>
          <p className="mb-[30px] mt-[6px] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            Ces informations apparaissent sur chaque consentement envoyé.
          </p>
          <div className="grid max-w-[700px] gap-x-[26px] md:grid-cols-2">
            <Input label="Prénom" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="Bernard" />
            <Input label="Nom" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Lefèvre" />
            <Input
              label="Spécialité"
              value={form.specialty}
              onChange={(e) => set('specialty', e.target.value)}
              placeholder="Chirurgien-dentiste"
            />
            <Input label="Téléphone" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+33 5 58 00 00 00" />
          </div>
          <div className="mt-[10px] flex items-center gap-5">
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Sauvegarder'}
            </Button>
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              {doctor.email} — non modifiable
            </span>
          </div>

          <div className="mt-9 max-w-[700px] pt-7" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-[18px]" style={{ color: 'var(--text-primary)' }}>
                Numéro RPPS
              </h3>
              {rppsStatus && (
                <span
                  className="font-mono rounded-[3px] px-2 py-[3px] text-[10px] uppercase tracking-[0.1em]"
                  style={{
                    background: rppsStatus === 'verified' ? 'var(--mint-soft)' : rppsStatus === 'unverified' ? 'var(--surface-card-alt)' : 'var(--danger-bg)',
                    color: rppsStatus === 'verified' ? 'var(--status-signed-text)' : rppsStatus === 'unverified' ? 'var(--text-muted)' : 'var(--danger-text)',
                  }}
                >
                  {{ verified: 'Vérifié', unverified: 'En attente de vérification', mismatch: 'Nom à contrôler', not_found: 'Introuvable' }[rppsStatus]}
                </span>
              )}
            </div>
            <p className="mb-4 mt-[6px] text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
              {rppsStatus === 'not_found'
                ? 'Ce numéro n’existe pas dans l’Annuaire Santé : les envois aux patients sont bloqués tant qu’il n’est pas corrigé.'
                : rppsStatus === 'mismatch'
                  ? `Dans l’Annuaire Santé, ce numéro est au nom de « ${doctor.rpps_identity ?? '—'} ». Vérifiez le numéro ou le nom du compte.`
                  : 'Votre identifiant national de professionnel de santé (11 chiffres). Il sert à vérifier votre compte et n’apparaît pas sur les documents des patients.'}
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-[220px] [&>label]:mb-0">
                <Input
                  label="Numéro RPPS"
                  value={rpps}
                  onChange={(e) => setRpps(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                  maxLength={12}
                  placeholder="10001234567"
                  inputMode="numeric"
                />
              </div>
              <Button variant="ghost" onClick={verifyRpps} disabled={rppsBusy}>
                {rppsBusy ? 'Vérification…' : doctor.rpps ? 'Vérifier à nouveau' : 'Enregistrer'}
              </Button>
            </div>
          </div>
          <CabinetIdentity doctor={doctor} refetchDoctor={refetchDoctor} showToast={showToast} onSeePlans={() => setTab('plan')} />
        </div>
      )}

      {tab === 'team' && (
        <div
          className="p-[clamp(1.5rem,4vw,36px)]"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4, animation: 'nb-rise 0.35s var(--ease-standard) both' }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
              Profils praticiens
            </h2>
            {!profilesEnabled && (
              <span
                className="font-mono rounded-[3px] px-2 py-[3px] text-[10px] uppercase tracking-[0.1em]"
                style={{ background: 'var(--surface-card-alt)', color: 'var(--text-accent)' }}
              >
                Abonnement Clinique
              </span>
            )}
          </div>
          <p className="mb-6 mt-[6px] max-w-[620px] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            {isCabinet
              ? `${profiles.length - 1} praticien${profiles.length - 1 > 1 ? 's' : ''} sur ${practitionerPlaces} possibles. Chaque praticien ouvre son profil à l'ouverture de Woui et retrouve ses propres envois.`
              : profilesEnabled
              ? `Votre cabinet compte ${profiles.length} profil${profiles.length > 1 ? 's' : ''}. Chaque praticien choisit le sien à l'ouverture de Woui et retrouve ses propres consentements.`
              : 'Avec l’abonnement Clinique, chaque praticien du cabinet a son profil : son nom sur les emails et les consentements signés, et ses propres envois.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => navigate(profilesEnabled ? '/profiles?gerer=1' : '/profiles')}>
              {profilesEnabled ? 'Gérer les profils' : 'Voir les profils'}
            </Button>
            {!profilesEnabled && (
              <Button variant="ghost" onClick={() => setTab('plan')}>
                Voir l'offre Clinique
              </Button>
            )}
          </div>
          {isCabinet && (
            <TeamSeats doctor={doctor} practitionerCount={profiles.length - 1} canManage={cabinetSpace} refetchDoctor={refetchDoctor} showToast={showToast} />
          )}
        </div>
      )}

      {tab === 'plan' && (
        <div style={{ animation: 'nb-rise 0.35s var(--ease-standard) both' }}>
          {!canManageBilling && (
            <div
              className="mb-[22px] flex items-start gap-3 px-5 py-4 text-[0.9375rem]"
              style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="mt-[3px] flex-none">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <span>
                {isCabinet
                  ? 'L’abonnement du cabinet se gère depuis « Gestion du cabinet », avec son code. Changez de profil pour modifier l’offre ou le paiement.'
                  : `L’abonnement du cabinet est géré par le titulaire du compte, ${profileName(profiles[0])}. Ouvrez son profil pour changer d’offre ou modifier le paiement.`}
              </span>
            </div>
          )}
          <div
            className="mb-[22px] p-[28px_32px]"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                  {statusLabel}
                </div>
                <div className="font-display mt-2 text-[26px]" style={{ color: 'var(--text-primary)' }}>
                  {plan.name}
                  {subscribed && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {' '}— {doctor.billing_interval === 'yearly' ? `${plan.yearlyPrice} € / an` : `${plan.price} € / mois`}
                    </span>
                  )}
                </div>
                {trialLeft !== null && (
                  <div className="mt-2 text-[0.9375rem]" style={{ color: trialLeft <= 3 ? 'var(--text-accent)' : 'var(--text-secondary)' }}>
                    {subscribed
                      ? `Essai gratuit : ${trialLeft} jour${trialLeft > 1 ? 's' : ''} restant${trialLeft > 1 ? 's' : ''}. Premier prélèvement le ${trialEndLabel}, sauf résiliation avant cette date.`
                      : trialLeft > 0
                        ? `Essai gratuit : ${trialLeft} jour${trialLeft > 1 ? 's' : ''} restant${trialLeft > 1 ? 's' : ''}.`
                        : 'Votre essai gratuit est terminé. Choisissez un plan pour continuer à envoyer des consentements.'}
                  </div>
                )}
                {doctor.plan_status === 'past_due' && (
                  <div className="mt-2 text-[0.9375rem]" style={{ color: 'var(--danger-text)' }}>
                    Le dernier paiement a échoué. Mettez à jour votre carte pour éviter l'interruption du service.
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-display text-[26px]" style={{ color: 'var(--text-primary)' }}>
                  {usedThisMonth} <span className="text-[17px]" style={{ color: 'var(--text-muted)' }}>/ {PLAN_LIMITS_LABEL(limit)}</span>
                </div>
                <div className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  consentements ce mois
                </div>
              </div>
            </div>
            <div className="mt-5 h-[3px]" style={{ background: 'var(--border-subtle)' }}>
              <div
                className="h-full origin-left"
                style={{ width: `${pct}%`, background: 'var(--action-accent)', animation: 'nb-grow 1s var(--ease-standard) 0.2s both' }}
              />
            </div>
            {doctor.stripe_customer_id && canManageBilling && (
              <div className="mt-5">
                <Button variant="ghost" onClick={manageBilling} disabled={billingBusy !== null}>
                  {billingBusy === 'portal' ? 'Ouverture…' : 'Factures, carte et résiliation'}
                </Button>
              </div>
            )}
          </div>

          {!subscribed && canManageBilling && (
            <div className="mb-5 flex items-center justify-center gap-1">
              {(['monthly', 'yearly'] as const).map((value) => (
                <button
                  key={value}
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
          )}

          <div className="grid gap-[22px] sm:grid-cols-3">
            {PLANS.map((p) => {
              const isCurrent = p.id === doctor.plan && (subscribed || trialLeft !== null)
              return (
                <div
                  key={p.id}
                  className="relative flex flex-col gap-[18px] p-[28px]"
                  style={{
                    background: 'var(--surface-card)',
                    border: `1px solid ${isCurrent ? 'var(--action-accent)' : 'var(--border-subtle)'}`,
                    borderRadius: 4,
                  }}
                >
                  {isCurrent && (
                    <span
                      className="font-mono absolute right-0 top-0 px-[10px] py-[5px] text-[10px] uppercase tracking-[0.12em]"
                      style={{ background: 'var(--action-accent)', color: 'var(--action-accent-text)' }}
                    >
                      {subscribed ? 'Actuel' : 'Essai'}
                    </span>
                  )}
                  <div>
                    <div
                      className="font-mono text-[11px] uppercase tracking-[0.1em]"
                      style={{ color: isCurrent ? 'var(--text-accent)' : 'var(--text-muted)' }}
                    >
                      {p.name}
                    </div>
                    <div className="font-display mt-[10px] text-[38px]" style={{ color: 'var(--text-primary)' }}>
                      {interval === 'yearly' && !subscribed ? `${p.yearlyPrice} €` : `${p.price} €`}
                    </div>
                    <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      {interval === 'yearly' && !subscribed ? `par an, soit ${Math.round(p.yearlyPrice / 12)} € / mois` : 'par mois'}
                    </div>
                  </div>
                  <div
                    className="flex flex-col gap-2 pt-[18px] text-[0.9375rem]"
                    style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                  >
                    {p.features.slice(0, 5).map((f) => (
                      <span key={f}>{f}</span>
                    ))}
                  </div>
                  <div className="mt-auto">
                    {!canManageBilling ? (
                      <button
                        disabled
                        className="w-full cursor-not-allowed rounded-[3px] py-[10px] text-[0.8125rem]"
                        style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                      >
                        {isCurrent ? 'Plan actuel' : 'Réservé au titulaire'}
                      </button>
                    ) : subscribed && isCurrent ? (
                      <button
                        disabled
                        className="w-full cursor-not-allowed rounded-[3px] py-[10px] text-[0.8125rem]"
                        style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                      >
                        Plan actuel
                      </button>
                    ) : (
                      <Button
                        variant="primary"
                        className="w-full justify-center"
                        disabled={billingBusy !== null}
                        onClick={() => (subscribed ? manageBilling() : choosePlan(p.id))}
                      >
                        {billingBusy === p.id ? 'Redirection…' : subscribed ? 'Changer de plan' : `Choisir ${p.name}`}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-5 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Paiement sécurisé par Stripe. Sans engagement, résiliable à tout moment depuis cet écran.
            {trialLeft !== null && trialLeft > 2 && ' Aucun prélèvement avant la fin de votre essai.'}
          </p>
        </div>
      )}

      {tab === 'documents' && (
        <div className="flex flex-col gap-[22px]">
          <DocumentsTab
            doctorId={doctor.id}
            activeProfile={activeProfile}
            onSignatureSaved={onSignatureSaved}
            showToast={showToast}
            withSignature={!cabinetSpace}
          />
          <ArchiveCard
            doctorId={doctor.id}
            accountCreatedAt={doctor.created_at}
            allowed={activeProfile.isMain}
            practitionerName={(id) => profileName(profileOf(id))}
            showToast={showToast}
            initialYear={Number(searchParams.get('archive')) || null}
          />
        </div>
      )}

      {tab === 'security' && (
        <div
          className="p-[clamp(1.5rem,4vw,36px)]"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4, animation: 'nb-rise 0.35s var(--ease-standard) both' }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
              {cabinetSpace ? 'Code de Gestion du cabinet' : 'Code du profil'}
            </h2>
            <span
              className="font-mono rounded-[3px] px-2 py-[3px] text-[10px] uppercase tracking-[0.1em]"
              style={{
                background: hasPin ? 'var(--mint-soft)' : 'var(--surface-card-alt)',
                color: hasPin ? 'var(--status-signed-text)' : 'var(--text-muted)',
              }}
            >
              {hasPin ? 'Activé' : pinEnabled ? 'Non activé' : 'Abonnements Pro et Clinique'}
            </span>
          </div>
          <p className="mb-6 mt-[6px] max-w-[620px] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            {cabinetSpace
              ? 'Obligatoire. Il protège l’abonnement, les factures, l’équipe et l’activité de tout le cabinet. Vous pouvez le changer, pas le supprimer.'
              : pinEnabled || hasPin
              ? `Un code à 4 chiffres, demandé à chaque ouverture du profil « ${profileName(activeProfile)} ». Facultatif, utile sur un poste partagé au cabinet.`
              : 'Protégez l’ouverture de votre profil par un code à 4 chiffres. Disponible avec les abonnements Pro et Clinique.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {hasPin ? (
              <>
                <Button variant="primary" onClick={() => setPinMode('change')}>
                  Modifier le code
                </Button>
                {!cabinetSpace && (
                  <Button variant="ghost" onClick={() => setPinMode('remove')}>
                    Supprimer le code
                  </Button>
                )}
              </>
            ) : pinEnabled ? (
              <Button variant="primary" onClick={() => setPinMode('create')}>
                Créer un code
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setTab('plan')}>
                Voir les offres
              </Button>
            )}
          </div>
          {hasPin && (
            <p className="mt-5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Code oublié ? Depuis l'écran de sélection des profils, cliquez sur votre profil puis sur « Code oublié ? » pour recevoir un e-mail.
            </p>
          )}
        </div>
      )}

      {pinMode && (
        <PinDialog
          steps={pinSteps[pinMode]}
          onClose={() => setPinMode(null)}
          onComplete={async (values) => {
            const message =
              pinMode === 'remove'
                ? await pinApi.removePin(activeProfile.id, values.current ?? '')
                : await pinApi.setPin(activeProfile.id, values.new ?? '', values.current)
            if (!message) {
              showToast(pinMode === 'remove' ? 'Code supprimé' : pinMode === 'change' ? 'Code modifié' : 'Code créé')
              setPinMode(null)
            }
            return message
          }}
        />
      )}

      {soonTitle && (
        <div
          className="p-[64px_40px] text-center"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4, animation: 'nb-rise 0.35s var(--ease-standard) both' }}
        >
          <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-accent)' }}>
            Bientôt
          </div>
          <h2 className="font-display my-[14px] text-[24px]" style={{ color: 'var(--text-primary)' }}>
            {soonTitle}
          </h2>
          <p className="text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            Cette section arrive dans une prochaine version de Woui.
          </p>
        </div>
      )}

      <p className="mt-12 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
        Woui · version {__APP_VERSION__}
      </p>
    </section>
  )
}
