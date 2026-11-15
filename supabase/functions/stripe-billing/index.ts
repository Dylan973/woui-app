// Facturation : abonnement en cours (offre, montant, prochaine échéance, carte) et factures Stripe du compte.
// Lecture seule ; les modifications passent par le portail client Stripe (stripe-portal).
import { cabinetAllowed, cabinetLocked, notConfigured, stripeConfigured, corsHeaders, currentDoctor, isSeatLookupKey, json, parseLookupKey, stripe } from '../_shared/stripe.ts'

type Card = { brand: string; last4: string; exp_month: number; exp_year: number } | null

function cardOf(pm: unknown): Card {
  const c = (pm as { card?: { brand: string; last4: string; exp_month: number; exp_year: number } } | null)?.card
  return c ? { brand: c.brand, last4: c.last4, exp_month: c.exp_month, exp_year: c.exp_year } : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    if (!stripeConfigured) return notConfigured()
    const doctor = await currentDoctor(req)
    if (!doctor) return json({ error: 'Connexion requise' }, 401)
    if (!(await cabinetAllowed(req, doctor))) return cabinetLocked()
    if (!doctor.stripe_customer_id) return json({ subscription: null, invoices: [] })

    const [customer, invoices] = await Promise.all([
      stripe.customers.retrieve(doctor.stripe_customer_id, { expand: ['invoice_settings.default_payment_method'] }),
      stripe.invoices.list({ customer: doctor.stripe_customer_id, limit: 36 }),
    ])

    let subscription = null
    if (doctor.stripe_subscription_id) {
      const sub = await stripe.subscriptions.retrieve(doctor.stripe_subscription_id, { expand: ['default_payment_method'] })
      let plan: string | null = null
      let interval: string | null = null
      let seats = 0
      let amount = 0
      for (const item of sub.items.data) {
        const key = item.price.lookup_key
        const parsed = parseLookupKey(key)
        if (parsed) {
          plan = parsed.plan
          interval = parsed.interval
        }
        if (isSeatLookupKey(key)) seats += item.quantity ?? 0
        amount += (item.price.unit_amount ?? 0) * (item.quantity ?? 1)
      }
      const s = sub as unknown as { current_period_end?: number; items: { data: { current_period_end?: number }[] } }
      const periodEnd = s.current_period_end ?? s.items.data[0]?.current_period_end ?? null
      const custPm = (customer as { invoice_settings?: { default_payment_method?: unknown } }).invoice_settings?.default_payment_method
      subscription = {
        status: sub.status,
        plan,
        interval,
        seats,
        amount,
        currency: sub.currency,
        current_period_end: periodEnd,
        trial_end: sub.trial_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        cancel_at: sub.cancel_at,
        card: cardOf(sub.default_payment_method) ?? cardOf(custPm),
      }
    }

    return json({
      subscription,
      invoices: invoices.data
        .filter((i) => i.status !== 'draft')
        .map((i) => ({
          id: i.id,
          number: i.number,
          created: i.created,
          total: i.total,
          currency: i.currency,
          status: i.status,
          hosted_invoice_url: i.hosted_invoice_url,
          invoice_pdf: i.invoice_pdf,
          description: i.lines.data[0]?.description ?? null,
        })),
    })
  } catch (error) {
    console.error('stripe-billing error:', error)
    return json({ error: 'La facturation est momentanément indisponible. Réessayez dans un instant.' }, 500)
  }
})
