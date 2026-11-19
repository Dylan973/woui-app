// Offre Clinique : ajoute ou retire un praticien supplémentaire (au-delà des 4 compris).
// Réservé à « Gestion du cabinet » (jeton de session dans x-woui-cabinet).
//
// Ajout :
//   - Essai : la place est ajoutée, sans frais jusqu'à la première facture.
//   - Abonnement à jour avec carte ou mandat SEPA : la place est ajoutée, le prorata
//     figure sur la prochaine facture (un seul prélèvement par mois).
//   - Sinon (retard de paiement, aucun moyen de paiement) : Stripe facture tout de suite le prorata.
//     Paiement accepté → { extra_seats, paid: true }.
//     Validation bancaire demandée ou carte refusée → la modification reste en attente
//     (pending update) et { pay_url } renvoie la facture Stripe à régler ; le webhook
//     accorde la place une fois la facture payée.
// Retrait : la place libre est retirée, le prorata est crédité sur la prochaine facture.
// Aperçu (action 'preview') : montant exact débité aujourd'hui et montant des prochaines échéances,
// calculés par Stripe ; la date de calcul (proration_date) est renvoyée puis réutilisée à l'ajout,
// pour que le client paie exactement le montant affiché.
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

    const { action, proration_date } = (await req.json().catch(() => ({}))) as {
      action?: string
      proration_date?: number
    }
    if (action !== 'add' && action !== 'remove' && action !== 'preview') return json({ error: 'Action invalide' }, 400)

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

    // ── Ajout d'une place ──
    const prices = await stripe.prices.list({ lookup_keys: [seatLookupKey(plan.interval)], active: true, limit: 1 })
    const seatPrice = prices.data[0]
    if (!seatPrice) return json({ error: `Prix Stripe introuvable (${seatLookupKey(plan.interval)})` }, 500)
    const items = seatItem ? [{ id: seatItem.id, quantity: current + 1 }] : [{ price: seatPrice.id, quantity: 1 }]

    // Date de calcul du prorata : celle de l'aperçu (moins d'une heure), sinon maintenant.
    const now = Math.floor(Date.now() / 1000)
    const prorationDate = proration_date && proration_date <= now && proration_date > now - 3600 ? Math.floor(proration_date) : now
    const s = sub as unknown as { current_period_end?: number; items: { data: { current_period_end?: number }[] } }
    const periodEnd = s.current_period_end ?? s.items.data[0]?.current_period_end ?? null
    const recurring = sub.items.data.reduce((sum, i) => sum + (i.price.unit_amount ?? 0) * (i.quantity ?? 1), 0) + (seatPrice.unit_amount ?? 0)

    // Mode de facturation de la place :
    //  - 'trial' : essai en cours, la place s'ajoute gratuitement et entre dans la première facture ;
    //  - 'next_invoice' : abonnement à jour avec un moyen de paiement enregistré (carte ou mandat SEPA),
    //    le prorata s'ajoute à la prochaine facture, un seul prélèvement par mois ;
    //  - 'now' : paiement en retard ou aucun moyen de paiement, le prorata est payé tout de suite.
    let hasPaymentMethod = Boolean(sub.default_payment_method)
    if (!hasPaymentMethod) {
      const customer = await stripe.customers.retrieve(sub.customer as string)
      hasPaymentMethod = Boolean((customer as { invoice_settings?: { default_payment_method?: unknown } }).invoice_settings?.default_payment_method)
    }
    const mode: 'trial' | 'next_invoice' | 'now' =
      sub.status === 'trialing' ? 'trial' : sub.status === 'active' && hasPaymentMethod ? 'next_invoice' : 'now'

    if (action === 'preview') {
      if (mode === 'trial') {
        return json({ mode, due_now: 0, prorata: 0, next_amount: recurring, next_date: sub.trial_end, recurring, interval: plan.interval, period_end: sub.trial_end, proration_date: prorationDate })
      }
      const preview = await stripe.invoices.createPreview({
        customer: sub.customer as string,
        subscription: sub.id,
        subscription_details: { items, proration_behavior: mode === 'now' ? 'always_invoice' : 'create_prorations', proration_date: prorationDate },
      })
      const prorata = preview.lines.data
        .filter((l) => (l as unknown as { proration?: boolean }).proration)
        .reduce((sum, l) => sum + l.amount, 0)
      return json({
        mode,
        due_now: mode === 'now' ? preview.amount_due : 0,
        prorata,
        next_amount: mode === 'now' ? recurring : preview.amount_due,
        next_date: periodEnd,
        recurring,
        interval: plan.interval,
        period_end: periodEnd,
        proration_date: prorationDate,
      })
    }

    // Factures et libellés Stripe en français.
    await stripe.customers.update(sub.customer as string, { preferred_locales: ['fr-FR', 'fr'] }).catch(() => {})

    if (mode === 'trial') {
      await stripe.subscriptions.update(sub.id, { items, proration_behavior: 'none' })
    } else if (mode === 'next_invoice') {
      await stripe.subscriptions.update(sub.id, { items, proration_behavior: 'create_prorations', proration_date: prorationDate })
    } else {
      const updated = await stripe.subscriptions.update(sub.id, {
        items,
        proration_behavior: 'always_invoice',
        proration_date: prorationDate,
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
    return json({ extra_seats: extra, paid: mode === 'now', mode })
  } catch (error) {
    console.error('stripe-seats error:', error)
    return json({ error: 'La modification de l’abonnement a échoué. Réessayez dans un instant.' }, 500)
  }
})
