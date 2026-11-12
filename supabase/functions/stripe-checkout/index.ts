// Crée une session Stripe Checkout pour souscrire un abonnement Woui.
// Premier abonnement : 7 jours d'essai gratuit, carte obligatoire.
// Si un abonnement existe déjà, renvoie vers le portail client (changement de plan).
import { APP_URL, notConfigured, portalConfigurationId, stripeConfigured, admin, corsHeaders, currentDoctor, json, lookupKey, stripe, type Interval, type PlanId } from '../_shared/stripe.ts'

const TRIAL_DAYS = 7

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    if (!stripeConfigured) return notConfigured()
    const doctor = await currentDoctor(req)
    if (!doctor) return json({ error: 'Connexion requise' }, 401)

    const { plan, interval } = (await req.json()) as { plan?: PlanId; interval?: Interval }
    if (!plan || !['starter', 'pro', 'clinic'].includes(plan)) return json({ error: 'Plan invalide' }, 400)
    const billing: Interval = interval === 'yearly' ? 'yearly' : 'monthly'

    // Déjà abonné : le changement de plan passe par le portail Stripe.
    if (doctor.stripe_customer_id && doctor.stripe_subscription_id && doctor.plan_status !== 'cancelled') {
      const portal = await stripe.billingPortal.sessions.create({
        customer: doctor.stripe_customer_id,
        return_url: `${APP_URL}/settings?tab=plan`,
        configuration: await portalConfigurationId(),
      })
      return json({ url: portal.url })
    }

    const prices = await stripe.prices.list({ lookup_keys: [lookupKey(plan, billing)], active: true, limit: 1 })
    const price = prices.data[0]
    if (!price) return json({ error: `Prix Stripe introuvable (${lookupKey(plan, billing)})` }, 500)

    let customerId = doctor.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: doctor.email,
        name: [doctor.first_name, doctor.last_name].filter(Boolean).join(' ') || undefined,
        metadata: { doctor_id: doctor.id },
      })
      customerId = customer.id
      await admin.from('doctors').update({ stripe_customer_id: customerId }).eq('id', doctor.id)
    }

    // Essai gratuit de 7 jours avec carte : réservé aux comptes qui n'ont jamais eu d'abonnement.
    // La carte est obligatoire ; aucun prélèvement avant la fin de l'essai.
    const firstSubscription = doctor.plan_status === 'incomplete' && !doctor.stripe_subscription_id

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: doctor.id,
      line_items: [{ price: price.id, quantity: 1 }],
      payment_method_collection: 'always',
      subscription_data: {
        metadata: { doctor_id: doctor.id },
        ...(firstSubscription
          ? { trial_period_days: TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } } }
          : {}),
      },
      ...(firstSubscription
        ? {
            custom_text: {
              submit: {
                message: `Aucun prélèvement aujourd'hui. Votre essai gratuit dure ${TRIAL_DAYS} jours ; vous pouvez résilier à tout moment avant la fin depuis Woui.`,
              },
            },
          }
        : {}),
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { name: 'auto', address: 'auto' },
      locale: 'fr',
      success_url: firstSubscription ? `${APP_URL}/dashboard?checkout=success` : `${APP_URL}/settings?tab=plan&checkout=success`,
      cancel_url: firstSubscription ? `${APP_URL}/dashboard` : `${APP_URL}/settings?tab=plan`,
    })

    return json({ url: session.url })
  } catch (error) {
    console.error('stripe-checkout error:', error)
    return json({ error: 'Impossible de créer le paiement' }, 500)
  }
})
