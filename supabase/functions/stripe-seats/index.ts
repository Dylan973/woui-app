// Offre Clinique : ajoute ou retire un praticien supplémentaire (au-delà des 4 compris).
// Réservé à « Gestion du cabinet » (jeton de session dans x-woui-cabinet).
//
// Ajout : la place n'est accordée qu'une fois payée.
//   - Abonnement actif : Stripe facture tout de suite le prorata et débite la carte.
//     Paiement accepté → { extra_seats, paid: true }.
//     Validation bancaire demandée ou carte refusée → la modification reste en attente
//     (pending update) et { pay_url } renvoie la facture Stripe à régler ; le webhook
//     accorde la place une fois la facture payée.
//   - Essai gratuit : { needs_trial_end, plan_amount, seat_amount } ; avec { end_trial: true },
//     l'essai se termine, l'abonnement et la place sont facturés et payés immédiatement
//     (refusé sans rien modifier si le paiement échoue).
// Retrait : la place libre est retirée, le prorata est crédité sur la prochaine facture.
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

    const { action, end_trial } = (await req.json().catch(() => ({}))) as { action?: string; end_trial?: boolean }
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
      if ((count ?? 0) > 4 + current - 1) {
        return json({ error: 'Archivez d’abord un profil praticien pour libérer cette place.' }, 409)
      }
      if (current === 1) await stripe.subscriptionItems.del(seatItem!.id, { proration_behavior: 'create_prorations' })
      else await stripe.subscriptionItems.update(seatItem!.id, { quantity: current - 1, proration_behavior: 'create_prorations' })
      const extra = current - 1
      await admin.from('doctors').update({ extra_seats: extra, updated_at: new Date().toISOString() }).eq('id', doctor.id)
      return json({ extra_seats: extra })
    }

    // ── Ajout d'une place : paiement d'abord ──
    const prices = await stripe.prices.list({ lookup_keys: [seatLookupKey(plan.interval)], active: true, limit: 1 })
    const seatPrice = prices.data[0]
    if (!seatPrice) return json({ error: `Prix Stripe introuvable (${seatLookupKey(plan.interval)})` }, 500)
    const items = seatItem ? [{ id: seatItem.id, quantity: current + 1 }] : [{ price: seatPrice.id, quantity: 1 }]

    if (sub.status === 'trialing' && end_trial !== true) {
      // Pendant l'essai, rien ne serait débité : on propose de démarrer l'abonnement maintenant.
      return json({
        needs_trial_end: true,
        plan_amount: (planItem?.price?.unit_amount ?? 0) * (planItem?.quantity ?? 1),
        seat_amount: (seatPrice.unit_amount ?? 0) * (current + 1),
        interval: plan.interval,
      })
    }

    if (sub.status === 'trialing') {
      try {
        const updated = await stripe.subscriptions.update(sub.id, {
          items,
          trial_end: 'now',
          proration_behavior: 'always_invoice',
          payment_behavior: 'error_if_incomplete',
          expand: ['latest_invoice'],
        })
        const invoice = updated.latest_invoice as { status?: string } | null
        if (invoice?.status !== 'paid') return json({ error: 'Le paiement n’a pas été confirmé. Aucune place n’a été ajoutée.' }, 402)
      } catch (error) {
        console.error('stripe-seats fin d’essai:', error)
        return json(
          { error: 'Le paiement a été refusé par la banque. Vérifiez votre carte dans « Abonnement > Gérer mon abonnement » puis réessayez. Aucune place n’a été ajoutée.' },
          402
        )
      }
    } else {
      const updated = await stripe.subscriptions.update(sub.id, {
        items,
        proration_behavior: 'always_invoice',
        payment_behavior: 'pending_if_incomplete',
        expand: ['latest_invoice'],
      })
      const invoice = updated.latest_invoice as { status?: string; hosted_invoice_url?: string | null } | null
      if (updated.pending_update || invoice?.status !== 'paid') {
        // Paiement à valider (3D Secure) ou refusé : la place sera accordée une fois la facture réglée.
        if (invoice?.hosted_invoice_url) return json({ pay_url: invoice.hosted_invoice_url })
        return json({ error: 'Le paiement n’a pas pu être effectué. Aucune place n’a été ajoutée.' }, 402)
      }
    }

    const extra = current + 1
    await admin.from('doctors').update({ extra_seats: extra, updated_at: new Date().toISOString() }).eq('id', doctor.id)
    return json({ extra_seats: extra, paid: true })
  } catch (error) {
    console.error('stripe-seats error:', error)
    return json({ error: 'La modification de l’abonnement a échoué. Réessayez dans un instant.' }, 500)
  }
})
