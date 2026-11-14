// Webhook Stripe : synchronise l'abonnement dans la table doctors.
// Déploiement sans vérification JWT (Stripe signe lui-même ses requêtes) :
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secret requis : STRIPE_WEBHOOK_SECRET (whsec_...)
import Stripe from 'npm:stripe@17.7.0'
import { admin, isSeatLookupKey, parseLookupKey, stripe } from '../_shared/stripe.ts'

// Secret du webhook : variable d'environnement, sinon celui enregistré par stripe-setup.
let webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
async function loadWebhookSecret() {
  if (webhookSecret) return webhookSecret
  const { data } = await admin.from('app_secrets').select('value').eq('key', 'stripe_webhook_secret').maybeSingle()
  webhookSecret = data?.value ?? ''
  return webhookSecret
}
const cryptoProvider = Stripe.createSubtleCryptoProvider()

function mapStatus(status: Stripe.Subscription.Status): 'active' | 'trialing' | 'past_due' | 'cancelled' | 'incomplete' {
  switch (status) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'incomplete':
      return 'incomplete'
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled'
    default:
      return 'past_due' // past_due, unpaid, incomplete, paused
  }
}

async function syncSubscription(sub: Stripe.Subscription) {
  // Ligne de l'offre (Starter, Pro, Clinique) et, en Clinique, praticiens supplémentaires.
  const item = sub.items.data.find((i) => parseLookupKey(i.price?.lookup_key)) ?? sub.items.data[0]
  const parsed = parseLookupKey(item?.price?.lookup_key)
  const extraSeats = sub.status === 'canceled'
    ? 0
    : sub.items.data.filter((i) => isSeatLookupKey(i.price?.lookup_key)).reduce((n, i) => n + (i.quantity ?? 0), 0)
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  // Selon la version d'API, la fin de période est sur l'abonnement ou sur la ligne.
  const periodEnd =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end

  const update: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    stripe_price_id: item?.price?.id ?? null,
    plan_status: mapStatus(sub.status),
    plan_expires_at: sub.trial_end && sub.status === 'trialing'
      ? new Date(sub.trial_end * 1000).toISOString()
      : periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    extra_seats: extraSeats,
    updated_at: new Date().toISOString(),
  }
  if (parsed) {
    update.plan = parsed.plan
    update.billing_interval = parsed.interval
  }

  const doctorId = sub.metadata?.doctor_id
  const query = admin.from('doctors').update(update)
  const { error } = doctorId ? await query.eq('id', doctorId) : await query.eq('stripe_customer_id', customerId)
  if (error) throw error
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })
  if (!(await loadWebhookSecret())) {
    console.error('STRIPE_WEBHOOK_SECRET manquant')
    return new Response('Webhook non configuré', { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Signature manquante', { status: 400 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider)
  } catch (err) {
    console.error('Signature Stripe invalide:', err)
    return new Response('Signature invalide', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          await syncSubscription(await stripe.subscriptions.retrieve(subId))
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_failed':
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null }
        const sub = invoice.subscription
        if (sub) await syncSubscription(await stripe.subscriptions.retrieve(typeof sub === 'string' ? sub : sub.id))
        break
      }
      default:
        break
    }
    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('stripe-webhook error:', error)
    // 500 : Stripe réessaiera automatiquement.
    return new Response('Erreur de traitement', { status: 500 })
  }
})
