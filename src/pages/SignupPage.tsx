import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { LEGAL_URLS, PLANS, WOUI_LOGO_URL } from '../lib/constants'
import { startCheckout, TRIAL_DAYS } from '../lib/billing'
import type { BillingInterval, PlanId } from '../types'

const isPlanId = (v: string | null): v is PlanId => v === 'starter' || v === 'pro' || v === 'clinic'

/**
 * Inscription en libre-service : 7 jours d'essai gratuit, carte bancaire demandée (aucun prélèvement pendant l'essai).
 * La fiche praticien est créée automatiquement côté base (trigger on_auth_user_created) au statut « incomplete » ;
 * l'essai démarre quand la carte est enregistrée dans Stripe Checkout (écran ActivateTrial).
 * Le site vitrine peut lier directement /signup?plan=starter|pro|clinic&interval=monthly|yearly.
 */
export function SignupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialPlan = params.get('plan')
  const [plan, setPlan] = useState<PlanId>(isPlanId(initialPlan) ? initialPlan : 'pro')
  const [interval, setBillingInterval] = useState<BillingInterval>(params.get('interval') === 'yearly' ? 'yearly' : 'monthly')
  const [form, setForm] = useState({ firstName: '', lastName: '', rpps: '', email: '', password: '' })
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const rpps = form.rpps.replace(/\s/g, '')
    if (!/^[0-9]{11}$/.test(rpps)) {
      setError('Le numéro RPPS contient 11 chiffres. Il figure sur votre carte CPS et sur vos ordonnances.')
      return
    }
    if (form.password.length < 10) {
      setError('Le mot de passe doit contenir au moins 10 caractères.')
      return
    }
    if (!accepted) {
      setError("Merci d'accepter les conditions générales pour créer votre compte.")
      return
    }
    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { first_name: form.firstName.trim(), last_name: form.lastName.trim(), rpps, plan, interval },
      },
    })
    if (signUpError) {
      setLoading(false)
      setError(
        /registered|already/i.test(signUpError.message)
          ? 'Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez votre mot de passe.'
          : signUpError.message
      )
      return
    }
    if (data.session) {
      // Compte créé et connecté : on enchaîne directement sur l'enregistrement de la carte.
      const checkoutError = await startCheckout(plan, interval)
      if (checkoutError) navigate('/dashboard', { replace: true })
      return
    }
    setLoading(false)
    setSentTo(form.email.trim())
  }

  const card = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--surface-page)' }}>
      <div
        className="w-full max-w-[460px] p-[clamp(1.75rem,5vw,48px)]"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
      >
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-[3px] p-[7px]" style={{ background: 'var(--action-accent)' }}>
            <img src={WOUI_LOGO_URL} alt="Woui" className="h-full w-full object-contain" />
          </div>
          {children}
        </div>
      </div>
    </div>
  )

  if (sentTo) {
    return card(
      <>
        <h1 className="font-display text-[1.75rem]" style={{ color: 'var(--text-primary)' }}>
          Vérifiez votre boîte mail
        </h1>
        <p className="text-[0.9375rem] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
          Nous avons envoyé un lien de confirmation à <b>{sentTo}</b>. Cliquez dessus pour confirmer votre adresse, puis
          enregistrez votre carte pour démarrer vos {TRIAL_DAYS} jours d'essai gratuit.
        </p>
        <Link to="/login" className="text-[13px]" style={{ color: 'var(--text-accent)' }}>
          Retour à la connexion
        </Link>
      </>
    )
  }

  return card(
    <>
      <h1 className="font-display text-[1.75rem]" style={{ color: 'var(--text-primary)' }}>
        Essai gratuit {TRIAL_DAYS} jours
      </h1>
      <p className="text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
        Aucun prélèvement pendant l'essai. Carte demandée à l'étape suivante, résiliable à tout moment.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 w-full text-left">
        <div className="mb-3 flex items-center justify-center gap-1">
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
        <div className="mb-5 grid grid-cols-3 gap-2">
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

        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Prénom" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required autoComplete="given-name" />
          <Input label="Nom" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required autoComplete="family-name" />
        </div>
        <Input
          label="Numéro RPPS (11 chiffres)"
          value={form.rpps}
          onChange={(e) => set('rpps', e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
          maxLength={12}
          placeholder="10001234567"
          inputMode="numeric"
          required
          autoComplete="off"
        />
        <Input
          label="Email professionnel"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="dr@cabinet.fr"
          required
          autoComplete="email"
        />
        <Input
          label="Mot de passe (10 caractères min.)"
          type="password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          required
          autoComplete="new-password"
        />

        <label className="mb-4 flex items-start gap-3 text-[13px] leading-[1.5]" style={{ color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ width: 17, height: 17, marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }}
          />
          <span>
            J'accepte les{' '}
            <a href={LEGAL_URLS.cgu} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-accent)' }}>
              conditions générales
            </a>{' '}
            et la{' '}
            <a href={LEGAL_URLS.confidentialite} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-accent)' }}>
              politique de confidentialité
            </a>
            .
          </span>
        </label>

        {error && (
          <div
            className="mb-4 p-3 text-[0.875rem]"
            style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 3 }}
          >
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={loading} className="w-full justify-center py-[14px] text-[1rem]">
          {loading ? 'Création du compte…' : 'Démarrer mon essai gratuit'}
        </Button>
      </form>

      <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
        Déjà un compte ?{' '}
        <Link to="/login" style={{ color: 'var(--text-accent)' }}>
          Se connecter
        </Link>
      </p>
    </>
  )
}
