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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-woui-cabinet',
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

/** Praticien supplémentaire de l'offre Clinique : woui_clinic_seat_<monthly|yearly>. */
export const seatLookupKey = (interval: Interval) => `woui_clinic_seat_${interval}`
export const isSeatLookupKey = (key: string | null | undefined) => /^woui_clinic_seat_(monthly|yearly)$/.test(key ?? '')

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
    account_type: 'practitioner' | 'cabinet'
    cabinet_name: string | null
    siret: string | null
    billing_interval: Interval | null
    extra_seats: number
  }
}

type DoctorRow = NonNullable<Awaited<ReturnType<typeof currentDoctor>>>

/**
 * Compte cabinet (offre Clinique) : l'abonnement ne se gère que depuis « Gestion du cabinet »,
 * ouvert avec le code du cabinet. L'app envoie le jeton de cette session dans x-woui-cabinet.
 */
export async function cabinetAllowed(req: Request, doctor: DoctorRow): Promise<boolean> {
  if (doctor.account_type !== 'cabinet') return true
  const token = req.headers.get('x-woui-cabinet') ?? ''
  if (!/^[0-9a-f]{48}$/.test(token)) return false
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  const { data } = await admin
    .from('cabinet_sessions')
    .select('doctor_id')
    .eq('token_hash', hash)
    .eq('doctor_id', doctor.id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  return !!data
}

export const cabinetLocked = () =>
  json({ error: 'Ouvrez « Gestion du cabinet » avec le code du cabinet pour gérer l’abonnement.' }, 403)

/** Configuration du portail créée par scripts/stripe-setup.mjs (metadata woui=1), sinon celle par défaut. */
export async function portalConfigurationId(): Promise<string | undefined> {
  const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 })
  return configs.data.find((c) => c.metadata?.woui === '1')?.id
}
