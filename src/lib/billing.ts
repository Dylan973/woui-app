import { supabase } from './supabase'
import type { BillingInterval, Doctor, PlanId } from '../types'

async function redirectFrom(fn: 'stripe-checkout' | 'stripe-portal', body: object): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error || !data?.url) {
    const detail = (data as { error?: string } | null)?.error
    return detail ?? "Le service de paiement est momentanément indisponible. Réessayez dans quelques instants."
  }
  window.location.assign(data.url as string)
  return null
}

/** Ouvre Stripe Checkout pour le plan choisi. Renvoie un message d'erreur, ou null si redirigé. */
export const startCheckout = (plan: PlanId, interval: BillingInterval) => redirectFrom('stripe-checkout', { plan, interval })

/** Ouvre le portail client Stripe (factures, carte, changement de plan, résiliation). */
export const openBillingPortal = () => redirectFrom('stripe-portal', {})

/** Jours d'essai restants (0 si l'essai est terminé, null si le compte n'est pas en essai). */
export function trialDaysLeft(doctor: Doctor): number | null {
  if (doctor.plan_status !== 'trialing' || !doctor.plan_expires_at) return null
  const ms = new Date(doctor.plan_expires_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/** Le praticien a-t-il déjà un abonnement Stripe (payant ou en essai avec carte) ? */
export const hasSubscription = (doctor: Doctor) => Boolean(doctor.stripe_subscription_id) && doctor.plan_status !== 'cancelled'
