// Ouvre le portail client Stripe (factures, moyen de paiement, changement de plan, résiliation).
import { APP_URL, notConfigured, portalConfigurationId, stripeConfigured, corsHeaders, currentDoctor, json, stripe } from '../_shared/stripe.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    if (!stripeConfigured) return notConfigured()
    const doctor = await currentDoctor(req)
    if (!doctor) return json({ error: 'Connexion requise' }, 401)
    if (!doctor.stripe_customer_id) return json({ error: "Aucun abonnement n'est encore associé à ce compte" }, 400)

    const portal = await stripe.billingPortal.sessions.create({
      customer: doctor.stripe_customer_id,
      return_url: `${APP_URL}/settings?tab=plan`,
      configuration: await portalConfigurationId(),
    })
    return json({ url: portal.url })
  } catch (error) {
    console.error('stripe-portal error:', error)
    return json({ error: "Impossible d'ouvrir le portail" }, 500)
  }
})
