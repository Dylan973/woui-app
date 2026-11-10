// supabase/functions/send-consent/index.ts
//
// Envoie au patient l'email contenant son lien de signature (/sign/:token).
//
// Sécurité :
// - Appel réservé à un praticien connecté (JWT vérifié par Supabase + getUser ici).
// - Le navigateur n'envoie QUE l'id du consentement. Destinataire, nom, acte et
//   lien sont relus en base : impossible d'utiliser la fonction pour écrire à
//   n'importe qui ou injecter du contenu.
// - Le consentement doit appartenir au praticien connecté et ne pas être signé.
// - Toutes les valeurs insérées dans le HTML sont échappées.
// - L'email ne contient pas l'acte médical (donnée de santé hors hébergement HDS).
//
// Secrets : RESEND_API_KEY, RESEND_FROM (optionnel), APP_URL
// (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://woui-app.vercel.app'
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Woui <no-reply@woui.fr>'

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderEmail(p: { patient: string; doctorName: string; specialty: string; link: string }) {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f6faf8;font-family:Poppins,Helvetica,Arial,sans-serif;color:#0c1f1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6faf8;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid rgba(12,31,26,.08);border-radius:16px">
        <tr><td style="padding:32px 32px 8px">
          <div style="font-size:13px;color:#0b7a5c;font-weight:600;letter-spacing:.08em;text-transform:uppercase">${esc(p.doctorName)}</div>
          <div style="font-size:13px;color:rgba(12,31,26,.55);margin-top:2px">${esc(p.specialty)}</div>
          <h1 style="font-size:22px;line-height:1.3;margin:22px 0 0;font-weight:600">Bonjour ${esc(p.patient)},</h1>
          <p style="font-size:15px;line-height:1.6;color:rgba(12,31,26,.72);margin:12px 0 0">
            Avant votre rendez-vous, votre praticien vous demande de prendre connaissance d'une courte vidéo d'information, puis de signer votre consentement en ligne.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px" align="left">
          <a href="${esc(p.link)}" style="display:inline-block;background:#11b184;color:#ffffff;padding:14px 26px;border-radius:12px;text-decoration:none;font-weight:500;font-size:15px">Voir la vidéo et signer</a>
        </td></tr>
        <tr><td style="padding:16px 32px 32px">
          <p style="font-size:12.5px;line-height:1.55;color:rgba(12,31,26,.5);margin:0">
            Ce lien est personnel : ne le transférez pas. Si vous n'attendiez pas ce message, ignorez-le ou contactez votre cabinet.
          </p>
        </td></tr>
      </table>
      <p style="font-size:11.5px;color:rgba(12,31,26,.4);margin:16px 0 0">Envoyé via Woui pour le compte de votre praticien.</p>
    </td></tr>
  </table>
</body></html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: userData, error: userError } = await admin.auth.getUser(jwt)
    if (userError || !userData?.user) return json({ error: 'Connexion requise' }, 401)

    const { consentId } = (await req.json()) as { consentId?: string }
    if (!consentId) return json({ error: 'consentId manquant' }, 400)

    const { data: consent, error: consentError } = await admin
      .from('consents')
      .select('id, patient, email, token, status, doctors!inner(user_id, first_name, last_name, specialty)')
      .eq('id', consentId)
      .maybeSingle()

    // Même réponse si le consentement n'existe pas ou appartient à un autre praticien.
    const doctor = consent?.doctors as unknown as
      | { user_id: string; first_name: string | null; last_name: string | null; specialty: string | null }
      | undefined
    if (consentError || !consent || !doctor || doctor.user_id !== userData.user.id) {
      return json({ error: 'Consentement introuvable' }, 404)
    }
    if (consent.status === 'signed') return json({ error: 'Ce consentement est déjà signé' }, 409)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return json({ error: "Service d'email non configuré" }, 500)

    const doctorName = ['Dr', doctor.first_name, doctor.last_name].filter(Boolean).join(' ').trim()
    const html = renderEmail({
      patient: consent.patient,
      doctorName: doctorName === 'Dr' ? 'Votre cabinet dentaire' : doctorName,
      specialty: doctor.specialty ?? '',
      link: `${APP_URL}/sign/${encodeURIComponent(consent.token)}`,
    })

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [consent.email],
        // Aucun acte médical dans l'email (donnée de santé) : il n'apparaît que sur la page sécurisée.
        subject: `${doctorName === 'Dr' ? 'Votre cabinet dentaire' : doctorName} — document à signer avant votre rendez-vous`,
        html,
      }),
    })

    if (!resendResponse.ok) {
      console.error('Resend error:', await resendResponse.text())
      return json({ error: "L'email n'a pas pu être envoyé" }, 502)
    }

    return json({ success: true })
  } catch (error) {
    console.error('send-consent error:', error)
    return json({ error: 'Erreur interne' }, 500)
  }
})
