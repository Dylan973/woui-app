// Ouvre le portail client Stripe (factures, moyen de paiement, changement de plan, résiliation).
// { flow: 'cancel' } ouvre directement l'écran de résiliation (effective à la fin de la période payée).
import { APP_URL, cabinetAllowed, cabinetLocked, notConfigured, portalConfigurationId, stripeConfigured, corsHeaders, currentDoctor, json, stripe } from '../_shared/stripe.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    if (!stripeConfigured) return notConfigured()
    const doctor = await currentDoctor(req)
    if (!doctor) return json({ error: 'Connexion requise' }, 401)
    if (!(await cabinetAllowed(req, doctor))) return cabinetLocked()
    if (!doctor.stripe_customer_id) return json({ error: "Aucun abonnement n'est encore associé à ce compte" }, 400)

    const { flow } = (await req.json().catch(() => ({}))) as { flow?: string }
    const cancel = flow === 'cancel' && doctor.stripe_subscription_id && doctor.plan_status !== 'cancelled'
    const portal = await stripe.billingPortal.sessions.create({
      customer: doctor.stripe_customer_id,
      return_url: `${APP_URL}/settings?tab=billing`,
      configuration: await portalConfigurationId(),
      locale: 'fr',
      ...(cancel
        ? {
            flow_data: {
              type: 'subscription_cancel' as const,
              subscription_cancel: { subscription: doctor.stripe_subscription_id! },
              after_completion: { type: 'redirect' as const, redirect: { return_url: `${APP_URL}/settings?tab=billing&resiliation=1` } },
            },
          }
        : {}),
    })
    return json({ url: portal.url })
  } catch (error) {
    console.error('stripe-portal error:', error)
    return json({ error: "Impossible d'ouvrir le portail" }, 500)
  }
})
