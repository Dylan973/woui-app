// supabase/functions/patient-document/index.ts
//
// Donne au patient un lien temporaire (5 minutes) vers un document de son envoi :
// - consent        : formulaire de consentement du cabinet (avant signature)
// - quote          : devis déposé par le cabinet (avant signature) — note l'ouverture du devis
// - consent_signed : consentement signé
// - quote_signed   : devis signé (à transmettre à la mutuelle)
// - postop         : conseils post-opératoires (avant et après signature)
// - logo           : logo du cabinet (offre Clinique)
// Un lien expiré ne donne plus accès aux documents à signer ; les documents signés restent téléchargeables.
//
// Accès patient sans compte : l'autorisation repose sur le token du lien.
// Les fichiers restent dans des stockages privés ; seul ce lien temporaire est remis.
//
// Déploiement : supabase functions deploy patient-document --no-verify-jwt

import { createClient } from 'jsr:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'document'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    const { token, doc, download } = (await req.json()) as { token?: string; doc?: string; download?: boolean }
    if (!token || !doc) return json({ error: 'Demande incomplète' }, 400)

    const { data: consent } = await admin
      .from('consents')
      .select('id, patient, status, kind, template_path, quote_path, quote_opened_at, quote_signed_at, consent_signed_at, with_postop, postop_path, postop_opened_at, pdf_url, quote_pdf_url, link_expires_at, doctors!inner(logo_path, plan)')
      .eq('token', token)
      .maybeSingle()
    if (!consent) return json({ error: 'Lien invalide' }, 404)

    const signed = consent.status === 'signed'
    const expired = !signed && new Date(consent.link_expires_at).getTime() < Date.now()
    const doctor = consent.doctors as unknown as { logo_path: string | null; plan: string }
    // Documents signés, conseils et logo restent accessibles après l'expiration du lien.
    if (expired && !['logo', 'postop', 'consent_signed', 'quote_signed'].includes(doc)) return json({ error: 'Lien expiré' }, 410)
    const choice: Record<string, { bucket: string; path: string | null; name: string } | undefined> = {
      consent: consent.kind === 'consent' || consent.kind === 'both' ? { bucket: 'documents', path: consent.template_path, name: 'consentement' } : undefined,
      quote: consent.kind === 'quote' || consent.kind === 'both' ? { bucket: 'documents', path: consent.quote_path, name: 'devis' } : undefined,
      postop: consent.with_postop ? { bucket: 'documents', path: consent.postop_path, name: 'conseils-post-operatoires' } : undefined,
      consent_signed: consent.consent_signed_at || signed ? { bucket: 'consents', path: consent.pdf_url, name: 'consentement-signe' } : undefined,
      quote_signed: consent.quote_signed_at || signed ? { bucket: 'consents', path: consent.quote_pdf_url, name: 'devis-signe' } : undefined,
      logo: doctor.plan === 'clinic' ? { bucket: 'documents', path: doctor.logo_path, name: 'logo' } : undefined,
    }
    const target = choice[doc]
    if (!target?.path) return json({ error: 'Document indisponible' }, 404)

    const { data, error } = await admin.storage
      .from(target.bucket)
      .createSignedUrl(target.path, doc === 'logo' ? 3600 : 300, download ? { download: `${target.name}-${slug(consent.patient)}.pdf` } : undefined)
    if (error || !data?.signedUrl) return json({ error: 'Document indisponible' }, 404)

    // Le devis doit avoir été ouvert avant de pouvoir être signé.
    let quoteOpenedAt = consent.quote_opened_at
    if (doc === 'quote' && !quoteOpenedAt) {
      quoteOpenedAt = new Date().toISOString()
      await admin.from('consents').update({ quote_opened_at: quoteOpenedAt }).eq('id', consent.id).is('quote_opened_at', null)
    }

    if (doc === 'postop' && !consent.postop_opened_at) {
      await admin.from('consents').update({ postop_opened_at: new Date().toISOString() }).eq('id', consent.id).is('postop_opened_at', null)
    }

    return json({ url: data.signedUrl, quote_opened_at: quoteOpenedAt })
  } catch (error) {
    console.error('patient-document error:', error)
    return json({ error: 'Erreur interne' }, 500)
  }
})
