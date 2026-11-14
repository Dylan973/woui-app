// Offre Clinique : ajoute ou retire un praticien supplémentaire (au-delà des 3 compris).
// Réservé à « Gestion du cabinet » (jeton de session dans x-woui-cabinet).
// Corps : { action: 'add' | 'remove' }. Le webhook met ensuite doctors.extra_seats à jour ;
// la réponse renvoie aussi le nouveau total pour un affichage immédiat.
import {
  admin,
  cabinetAllowed,
  cabinetLocked,
  corsHeaders,
  currentDoctor,
  isSeatLookupKey,
  json,
  notConfigured,
  parseLookupKey,
  seatLookupKey,
  stripe,
  stripeConfigured,
} from '../_shared/stripe.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    if (!stripeConfigured) return notConfigured()
    const doctor = await currentDoctor(req)
    if (!doctor) return json({ error: 'Connexion requise' }, 401)
    if (!(await cabinetAllowed(req, doctor))) return cabinetLocked()
    if (!doctor.stripe_subscription_id) return json({ error: "Aucun abonnement Clinique n'est actif sur ce compte." }, 400)

    const { action } = (await req.json().catch(() => ({}))) as { action?: string }
    if (action !== 'add' && action !== 'remove') return json({ error: 'Action invalide' }, 400)

    const sub = await stripe.subscriptions.retrieve(doctor.stripe_subscription_id)
    if (!['active', 'trialing', 'past_due'].includes(sub.status)) return json({ error: "L'abonnement n'est pas actif." }, 400)
    const planItem = sub.items.data.find((i) => parseLookupKey(i.price?.lookup_key))
    const plan = parseLookupKey(planItem?.price?.lookup_key)
    if (plan?.plan !== 'clinic') return json({ error: 'Les praticiens supplémentaires sont réservés à l’offre Clinique.' }, 400)

    const seatItem = sub.items.data.find((i) => isSeatLookupKey(i.price?.lookup_key))
    const current = seatItem?.quantity ?? 0

    if (action === 'remove') {
      if (current === 0) return json({ extra_seats: 0 })
      // On ne retire une place que si elle est libre (praticiens actifs ≤ places restantes).
      const { count } = await admin
        .from('practitioners')
        .select('id', { count: 'exact', head: true })
        .eq('doctor_id', doctor.id)
        .is('archived_at', null)
      if ((count ?? 0) > 3 + current - 1) {
        return json({ error: 'Archivez d’abord un profil praticien pour libérer cette place.' }, 409)
      }
      if (current === 1) await stripe.subscriptionItems.del(seatItem!.id, { proration_behavior: 'create_prorations' })
      else await stripe.subscriptionItems.update(seatItem!.id, { quantity: current - 1, proration_behavior: 'create_prorations' })
    } else if (seatItem) {
      await stripe.subscriptionItems.update(seatItem.id, { quantity: current + 1, proration_behavior: 'create_prorations' })
    } else {
      const prices = await stripe.prices.list({ lookup_keys: [seatLookupKey(plan.interval)], active: true, limit: 1 })
      if (!prices.data[0]) return json({ error: `Prix Stripe introuvable (${seatLookupKey(plan.interval)})` }, 500)
      await stripe.subscriptionItems.create({
        subscription: sub.id,
        price: prices.data[0].id,
        quantity: 1,
        proration_behavior: 'create_prorations',
      })
    }

    const extra = action === 'add' ? current + 1 : current - 1
    await admin.from('doctors').update({ extra_seats: extra, updated_at: new Date().toISOString() }).eq('id', doctor.id)
    return json({ extra_seats: extra })
  } catch (error) {
    console.error('stripe-seats error:', error)
    return json({ error: 'La modification de l’abonnement a échoué. Réessayez dans un instant.' }, 500)
  }
})
