// supabase/functions/patient-document/index.ts
//
// Donne au patient un lien temporaire (5 minutes) vers un document de son envoi :
// - consent        : formulaire de consentement du cabinet (avant signature)
// - quote          : devis déposé par le cabinet (avant signature) — note l'ouverture du devis
// - consent_signed : consentement signé
// - quote_signed   : devis signé (à transmettre à la mutuelle)
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
    .replace(/[̀-ͯ]/g, '')
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
      .select('id, patient, status, kind, template_path, quote_path, quote_opened_at, pdf_url, quote_pdf_url')
      .eq('token', token)
      .maybeSingle()
    if (!consent) return json({ error: 'Lien invalide' }, 404)

    const signed = consent.status === 'signed'
    const choice: Record<string, { bucket: string; path: string | null; name: string } | undefined> = {
      consent: consent.kind !== 'quote' ? { bucket: 'documents', path: consent.template_path, name: 'consentement' } : undefined,
      quote: consent.kind !== 'consent' ? { bucket: 'documents', path: consent.quote_path, name: 'devis' } : undefined,
      consent_signed: signed ? { bucket: 'consents', path: consent.pdf_url, name: 'consentement-signe' } : undefined,
      quote_signed: signed ? { bucket: 'consents', path: consent.quote_pdf_url, name: 'devis-signe' } : undefined,
    }
    const target = choice[doc]
    if (!target?.path) return json({ error: 'Document indisponible' }, 404)

    const { data, error } = await admin.storage
      .from(target.bucket)
      .createSignedUrl(target.path, 300, download ? { download: `${target.name}-${slug(consent.patient)}.pdf` } : undefined)
    if (error || !data?.signedUrl) return json({ error: 'Document indisponible' }, 404)

    // Le devis doit avoir été ouvert avant de pouvoir être signé.
    let quoteOpenedAt = consent.quote_opened_at
    if (doc === 'quote' && !quoteOpenedAt) {
      quoteOpenedAt = new Date().toISOString()
      await admin.from('consents').update({ quote_opened_at: quoteOpenedAt }).eq('id', consent.id).is('quote_opened_at', null)
    }

    return json({ url: data.signedUrl, quote_opened_at: quoteOpenedAt })
  } catch (error) {
    console.error('patient-document error:', error)
    return json({ error: 'Erreur interne' }, 500)
  }
})
