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

/** Ouvre directement la résiliation Stripe : l'abonnement s'arrête à la fin de la période déjà payée. */
export const openCancelSubscription = (doctorId?: string) => redirectFrom('stripe-portal', { flow: 'cancel' }, doctorId)

/** Réponse de stripe-seats. */
export interface SeatResult {
  /** Place accordée (paiement accepté) ou retirée. */
  extra_seats?: number
  paid?: boolean
  /** Paiement à valider ou à régler sur la facture Stripe ; la place est accordée une fois payée. */
  pay_url?: string
  /** Mode de facturation retenu pour la place. */
  mode?: 'trial' | 'next_invoice' | 'now'
}

/** Offre Clinique : ajoute (après paiement) ou retire un praticien supplémentaire. */
export const changeExtraSeats = (action: 'add' | 'remove', doctorId: string, prorationDate?: number) =>
  callFunction<SeatResult>('stripe-seats', { action, proration_date: prorationDate }, { cabinetOf: doctorId, fallback: PAYMENT_DOWN })

/** Montants calculés par Stripe avant l'ajout d'une place (centimes). */
export interface SeatPreview {
  /** trial : ajout gratuit jusqu'à la 1re facture ; next_invoice : prorata sur la prochaine facture ; now : payé tout de suite. */
  mode: 'trial' | 'next_invoice' | 'now'
  due_now: number
  /** Prorata de la place jusqu'à la fin de la période en cours. */
  prorata: number
  /** Montant de la prochaine facture (prorata compris en mode next_invoice). */
  next_amount: number
  next_date: number | null
  /** Montant de chaque échéance suivante, place comprise. */
  recurring: number
  interval: BillingInterval
  period_end: number | null
  /** Date de calcul à renvoyer à l'ajout, pour facturer exactement le montant affiché. */
  proration_date: number
}

export const previewExtraSeat = (doctorId: string) =>
  callFunction<SeatPreview>('stripe-seats', { action: 'preview' }, { cabinetOf: doctorId, fallback: PAYMENT_DOWN })

/** Jours d'essai restants (0 si l'essai est terminé, null si le compte n'est pas en essai). */
export function trialDaysLeft(doctor: Doctor): number | null {
  if (doctor.plan_status !== 'trialing' || !doctor.plan_expires_at) return null
  const ms = new Date(doctor.plan_expires_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/** Le praticien a-t-il déjà un abonnement Stripe (payant ou en essai avec carte) ? */
export const hasSubscription = (doctor: Doctor) => Boolean(doctor.stripe_subscription_id) && doctor.plan_status !== 'cancelled'
