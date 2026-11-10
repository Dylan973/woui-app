#!/usr/bin/env node
// Configure Stripe pour Woui en une commande (idempotent : relançable sans doublons).
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
//
// Crée : 3 produits (Starter, Pro, Clinique), 6 prix (mensuel + annuel -20 %)
// repérés par lookup key woui_<plan>_<monthly|yearly>, le portail client,
// et le webhook vers la fonction Supabase stripe-webhook (affiche son secret).

const KEY = process.env.STRIPE_SECRET_KEY
if (!KEY) {
  console.error('Définissez STRIPE_SECRET_KEY (clé secrète test sk_test_... ou live sk_live_...)')
  process.exit(1)
}
const WEBHOOK_URL =
  process.env.WEBHOOK_URL ?? 'https://kflyeygbwirqhbsirncg.supabase.co/functions/v1/stripe-webhook'
const APP_URL = process.env.APP_URL ?? 'https://woui-app.vercel.app'

const PLANS = [
  { id: 'starter', name: 'Woui Starter', monthly: 3500, yearly: 33600 },
  { id: 'pro', name: 'Woui Cabinet Pro', monthly: 5000, yearly: 48000 },
  { id: 'clinic', name: 'Woui Clinique', monthly: 16000, yearly: 153600 },
]

async function api(method, path, params) {
  const body = params ? new URLSearchParams(flatten(params)).toString() : undefined
  const url = `https://api.stripe.com/v1/${path}${method === 'GET' && body ? `?${body}` : ''}`
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${method} ${path}: ${json.error?.message ?? res.status}`)
  return json
}

function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? flatten(item, `${key}[${i}]`, out) : out.push([`${key}[${i}]`, String(item)])))
    else if (typeof v === 'object') flatten(v, key, out)
    else out.push([key, String(v)])
  }
  return out
}

const mode = KEY.startsWith('sk_live') ? 'PRODUCTION (live)' : 'TEST'
console.log(`\nStripe — mode ${mode}\n`)

const productIds = []
for (const plan of PLANS) {
  const existing = await api('GET', 'products/search', { query: `metadata['woui_plan']:'${plan.id}'` })
  const product =
    existing.data[0] ?? (await api('POST', 'products', { name: plan.name, metadata: { woui_plan: plan.id } }))
  productIds.push(product.id)
  console.log(`✓ Produit ${plan.name} (${product.id})`)

  for (const interval of ['monthly', 'yearly']) {
    const lookup = `woui_${plan.id}_${interval}`
    const found = await api('GET', 'prices', { lookup_keys: [lookup], active: true })
    if (found.data[0]) {
      console.log(`  · prix ${lookup} déjà présent`)
      continue
    }
    await api('POST', 'prices', {
      product: product.id,
      currency: 'eur',
      unit_amount: plan[interval],
      recurring: { interval: interval === 'monthly' ? 'month' : 'year' },
      lookup_key: lookup,
      transfer_lookup_key: true,
    })
    console.log(`  + prix ${lookup} : ${(plan[interval] / 100).toFixed(2)} €`)
  }
}

// Portail client : factures, carte, changement de plan, résiliation en fin de période.
const prices = await api('GET', 'prices', {
  lookup_keys: PLANS.flatMap((p) => [`woui_${p.id}_monthly`, `woui_${p.id}_yearly`]),
  active: true,
  limit: 10,
})
const configs = await api('GET', 'billing_portal/configurations', { active: true, limit: 100 })
const existingConfig = configs.data.find((c) => c.metadata?.woui === '1')
await api('POST', existingConfig ? `billing_portal/configurations/${existingConfig.id}` : 'billing_portal/configurations', {
  metadata: { woui: '1' },
  business_profile: { headline: 'Woui — gérez votre abonnement' },
  default_return_url: `${APP_URL}/settings?tab=plan`,
  features: {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ['email', 'address', 'tax_id', 'name'] },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations',
      products: productIds.map((product) => ({
        product,
        prices: prices.data.filter((p) => p.product === product).map((p) => p.id),
      })),
    },
  },
})
console.log('✓ Portail client configuré')

// Webhook
const hooks = await api('GET', 'webhook_endpoints', { limit: 100 })
if (hooks.data.some((h) => h.url === WEBHOOK_URL)) {
  console.log(`✓ Webhook déjà présent (${WEBHOOK_URL}) — son secret est visible dans Stripe > Développeurs > Webhooks`)
} else {
  const hook = await api('POST', 'webhook_endpoints', {
    url: WEBHOOK_URL,
    enabled_events: [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_failed',
    ],
  })
  console.log(`✓ Webhook créé : ${WEBHOOK_URL}`)
  console.log(`\n  ➜ Secret à ajouter dans Supabase (Edge Functions > Secrets) :\n    STRIPE_WEBHOOK_SECRET=${hook.secret}\n`)
}
console.log('Terminé.\n')
