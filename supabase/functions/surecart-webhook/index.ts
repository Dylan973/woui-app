// supabase/functions/surecart-webhook/index.ts
//
// Reçoit les webhooks SureCart (abonnements) et synchronise la table `doctors`.
//
// ⚠️ NOTE IMPORTANTE : le brief mentionnait cette fonction comme "déjà rédigée"
// côté projet, mais son code source n'a pas été retrouvé parmi les fichiers
// fournis. Ce qui suit est une implémentation de référence basée sur le format
// standard des webhooks SureCart (events `checkout.order.completed`,
// `subscription.updated`, `subscription.canceled`) — À FAIRE AVANT PROD :
//   1. Coller ici le code existant si vous l'avez ailleurs, OU
//   2. Vérifier dans SureCart → Developers → Webhooks le nom exact de l'en-tête
//      de signature et l'algorithme utilisé, et ajuster `verifySignature()`.
//
// Variables d'env (supabase secrets set) :
//   SURECART_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Déploiement : supabase functions deploy surecart-webhook --no-verify-jwt

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

const webhookSecret = Deno.env.get('SURECART_WEBHOOK_SECRET') ?? ''

// Associe l'ID de prix/produit SureCart au plan interne Woui.
// À compléter avec vos vrais IDs SureCart (Developers → Products).
const PRICE_TO_PLAN: Record<string, 'starter' | 'pro' | 'clinic'> = {
  // 'price_xxx_starter': 'starter',
  // 'price_xxx_pro': 'pro',
  // 'price_xxx_clinic': 'clinic',
}

async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!webhookSecret) return true // pas de secret configuré → skip (dev only)
  if (!signatureHeader) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return expected === signatureHeader
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Méthode non autorisée', { status: 405 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('sc-signature') ?? req.headers.get('x-surecart-signature')

  const isValid = await verifySignature(rawBody, signature)
  if (!isValid) {
    return new Response('Signature invalide', { status: 401 })
  }

  let event: { type?: string; data?: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('JSON invalide', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.order.completed':
      case 'subscription.created':
      case 'subscription.updated': {
        const data = event.data ?? {}
        const customerEmail = String((data.customer as { email?: string } | undefined)?.email ?? '')
        const customerId = String((data.customer as { id?: string } | undefined)?.id ?? '')
        const subscriptionId = String(data.id ?? '')
        const priceId = String((data.price as { id?: string } | undefined)?.id ?? '')
        const plan = PRICE_TO_PLAN[priceId] ?? 'starter'

        if (customerEmail) {
          await supabaseAdmin
            .from('doctors')
            .update({
              plan,
              plan_status: 'active',
              surecart_customer_id: customerId || null,
              surecart_subscription_id: subscriptionId || null,
              subscribed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('email', customerEmail)
        }
        break
      }

      case 'subscription.canceled':
      case 'subscription.deleted': {
        const data = event.data ?? {}
        const subscriptionId = String(data.id ?? '')
        if (subscriptionId) {
          await supabaseAdmin
            .from('doctors')
            .update({ plan_status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('surecart_subscription_id', subscriptionId)
        }
        break
      }

      case 'subscription.past_due': {
        const data = event.data ?? {}
        const subscriptionId = String(data.id ?? '')
        if (subscriptionId) {
          await supabaseAdmin
            .from('doctors')
            .update({ plan_status: 'past_due', updated_at: new Date().toISOString() })
            .eq('surecart_subscription_id', subscriptionId)
        }
        break
      }

      default:
        console.log('Événement SureCart non géré:', event.type)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('surecart-webhook error:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
