// Outils partagés par les fonctions Stripe.
import Stripe from 'npm:stripe@17.7.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''

/** false tant que STRIPE_SECRET_KEY n'est pas enregistré dans les secrets Supabase. */
export const stripeConfigured = STRIPE_KEY.startsWith('sk_')

// Clé factice si absente : évite un plantage au démarrage, chaque fonction
// vérifie `stripeConfigured` et répond un message clair.
export const stripe = new Stripe(stripeConfigured ? STRIPE_KEY : 'sk_test_non_configure', {
  httpClient: Stripe.createFetchHttpClient(),
})

export const notConfigured = () =>
  json({ error: "Le paiement n'est pas encore activé sur Woui. Réessayez plus tard ou contactez le support." }, 503)

export const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

export const APP_URL = Deno.env.get('APP_URL') ?? 'https://woui-app.vercel.app'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export type PlanId = 'starter' | 'pro' | 'clinic'
export type Interval = 'monthly' | 'yearly'

/** Prix Stripe repérés par « lookup key » : woui_<plan>_<monthly|yearly>. */
export const lookupKey = (plan: PlanId, interval: Interval) => `woui_${plan}_${interval}`

export function parseLookupKey(key: string | null | undefined): { plan: PlanId; interval: Interval } | null {
  const m = /^woui_(starter|pro|clinic)_(monthly|yearly)$/.exec(key ?? '')
  return m ? { plan: m[1] as PlanId, interval: m[2] as Interval } : null
}

/** Praticien connecté (à partir du jeton envoyé par l'app). */
export async function currentDoctor(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data?.user) return null
  const { data: doctor } = await admin.from('doctors').select('*').eq('user_id', data.user.id).maybeSingle()
  return doctor as null | {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    plan_status: string
    plan_expires_at: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
  }
}

/** Configuration du portail créée par scripts/stripe-setup.mjs (metadata woui=1), sinon celle par défaut. */
export async function portalConfigurationId(): Promise<string | undefined> {
  const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 })
  return configs.data.find((c) => c.metadata?.woui === '1')?.id
}
