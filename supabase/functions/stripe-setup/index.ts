// Configure Stripe pour Woui en un appel, sans terminal (idempotent, relançable).
// Crée : 3 produits, 6 prix (mensuel + annuel −20 %, lookup keys woui_<plan>_<interval>),
// la configuration du portail client et le webhook vers stripe-webhook, dont le
// secret est enregistré dans app_secrets (jamais renvoyé au navigateur).
//
// Réservé aux administrateurs (ADMIN_EMAILS, par défaut l'adresse de Dylan).
// Prérequis : secret STRIPE_SECRET_KEY enregistré dans Supabase.
import { admin, APP_URL, corsHeaders, json, notConfigured, stripe, stripeConfigured } from '../_shared/stripe.ts'

const ADMINS = (Deno.env.get('ADMIN_EMAILS') ?? 'digitalee.art@gmail.com,didi-973@live.fr').split(',').map((e) => e.trim().toLowerCase())
const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-webhook`
const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const

const PLANS = [
  { id: 'starter', name: 'Woui Starter', monthly: 3500, yearly: 33600 },
  { id: 'pro', name: 'Woui Cabinet Pro', monthly: 5000, yearly: 48000 },
  { id: 'clinic', name: 'Woui Clinique', monthly: 16000, yearly: 153600 },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)
  if (!stripeConfigured) return notConfigured()

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: userData } = await admin.auth.getUser(jwt)
  const email = userData?.user?.email?.toLowerCase()
  if (!email || !ADMINS.includes(email)) return json({ error: 'Réservé aux administrateurs Woui' }, 403)

  try {
    const log: string[] = [`Mode ${Deno.env.get('STRIPE_SECRET_KEY')?.startsWith('sk_live') ? 'PRODUCTION' : 'TEST'}`]
    const productIds: string[] = []

    for (const plan of PLANS) {
      const found = await stripe.products.search({ query: `metadata['woui_plan']:'${plan.id}'` })
      const product = found.data[0] ?? (await stripe.products.create({ name: plan.name, metadata: { woui_plan: plan.id } }))
      productIds.push(product.id)
      for (const interval of ['monthly', 'yearly'] as const) {
        const lookup = `woui_${plan.id}_${interval}`
        const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 })
        if (existing.data[0]) continue
        await stripe.prices.create({
          product: product.id,
          currency: 'eur',
          unit_amount: plan[interval],
          recurring: { interval: interval === 'monthly' ? 'month' : 'year' },
          lookup_key: lookup,
          transfer_lookup_key: true,
        })
        log.push(`Prix créé : ${lookup}`)
      }
    }
    log.push('Produits et prix prêts')

    const prices = await stripe.prices.list({
      lookup_keys: PLANS.flatMap((p) => [`woui_${p.id}_monthly`, `woui_${p.id}_yearly`]),
      active: true,
      limit: 10,
    })
    const portalParams = {
      metadata: { woui: '1' },
      business_profile: { headline: 'Woui — gérez votre abonnement' },
      default_return_url: `${APP_URL}/settings?tab=plan`,
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ['email', 'address', 'tax_id', 'name'] as ('email' | 'address' | 'tax_id' | 'name')[] },
        subscription_cancel: { enabled: true, mode: 'at_period_end' as const },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'] as 'price'[],
          proration_behavior: 'create_prorations' as const,
          products: productIds.map((product) => ({
            product,
            prices: prices.data.filter((p) => p.product === product).map((p) => p.id),
          })),
        },
      },
    }
    const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 })
    const existingConfig = configs.data.find((c) => c.metadata?.woui === '1')
    if (existingConfig) await stripe.billingPortal.configurations.update(existingConfig.id, portalParams)
    else await stripe.billingPortal.configurations.create(portalParams)
    log.push('Portail client configuré')

    // Webhook : on (re)crée l'endpoint si son secret n'est pas connu côté Woui.
    const { data: stored } = await admin.from('app_secrets').select('value').eq('key', 'stripe_webhook_secret').maybeSingle()
    const hooks = await stripe.webhookEndpoints.list({ limit: 100 })
    const existingHook = hooks.data.find((h) => h.url === WEBHOOK_URL)
    if (existingHook && stored?.value) {
      log.push('Webhook déjà en place')
    } else {
      if (existingHook) await stripe.webhookEndpoints.del(existingHook.id)
      const hook = await stripe.webhookEndpoints.create({ url: WEBHOOK_URL, enabled_events: [...EVENTS] })
      const { error } = await admin
        .from('app_secrets')
        .upsert({ key: 'stripe_webhook_secret', value: hook.secret!, updated_at: new Date().toISOString() })
      if (error) throw error
      log.push('Webhook créé et secret enregistré')
    }

    return json({ success: true, log })
  } catch (error) {
    console.error('stripe-setup error:', error)
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
