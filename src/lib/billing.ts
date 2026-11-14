import { callFunction } from './functions'
import type { BillingInterval, Doctor, PlanId } from '../types'

const PAYMENT_DOWN = 'Le service de paiement est momentanément indisponible. Réessayez dans quelques instants.'

async function redirectFrom(fn: 'stripe-checkout' | 'stripe-portal', body: object, doctorId?: string): Promise<string | null> {
  const { data, error } = await callFunction<{ url?: string }>(fn, body, { cabinetOf: doctorId, fallback: PAYMENT_DOWN })
  if (error || !data?.url) return error ?? PAYMENT_DOWN
  window.location.assign(data.url)
  return null
}

/**
 * Ouvre Stripe Checkout pour le plan choisi. Renvoie un message d'erreur, ou null si redirigé.
 * doctorId : compte cabinet → la session « Gestion du cabinet » est jointe.
 */
export const startCheckout = (plan: PlanId, interval: BillingInterval, doctorId?: string) =>
  redirectFrom('stripe-checkout', { plan, interval }, doctorId)

/** Durée de l'essai gratuit (carte bancaire demandée, aucun prélèvement avant la fin). */
export const TRIAL_DAYS = 7

/** Ouvre le portail client Stripe (factures, carte, changement de plan, résiliation). */
export const openBillingPortal = (doctorId?: string) => redirectFrom('stripe-portal', {}, doctorId)

/** Offre Clinique : ajoute ou retire un praticien supplémentaire. */
export const changeExtraSeats = (action: 'add' | 'remove', doctorId: string) =>
  callFunction<{ extra_seats?: number }>('stripe-seats', { action }, { cabinetOf: doctorId })

/** Jours d'essai restants (0 si l'essai est terminé, null si le compte n'est pas en essai). */
export function trialDaysLeft(doctor: Doctor): number | null {
  if (doctor.plan_status !== 'trialing' || !doctor.plan_expires_at) return null
  const ms = new Date(doctor.plan_expires_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/** Le praticien a-t-il déjà un abonnement Stripe (payant ou en essai avec carte) ? */
export const hasSubscription = (doctor: Doctor) => Boolean(doctor.stripe_subscription_id) && doctor.plan_status !== 'cancelled'
