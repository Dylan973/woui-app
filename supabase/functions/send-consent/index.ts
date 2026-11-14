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

type Kind = 'consent' | 'quote' | 'both' | 'postop'

// Aucun détail médical ni montant dans l'email : tout se lit sur la page sécurisée.
const INTRO: Record<Kind, string> = {
  consent:
    "Avant votre rendez-vous, votre praticien vous demande de prendre connaissance d'une courte vidéo d'information, puis de signer votre consentement en ligne.",
  quote: 'Votre praticien vous transmet un devis. Vous pouvez le consulter, le télécharger pour votre mutuelle, puis le signer en ligne.',
  both: "Avant votre rendez-vous, votre praticien vous transmet une courte vidéo d'information, votre consentement et un devis. Vous pouvez télécharger le devis pour votre mutuelle, puis signer vos documents en ligne.",
  postop: 'Votre praticien vous transmet vos conseils post-opératoires. Lisez-les et gardez-les à portée de main après votre intervention.',
}
const POSTOP_EXTRA = ' Vos conseils post-opératoires sont aussi disponibles sur la même page.'
const BUTTON: Record<Kind, string> = {
  consent: 'Voir la vidéo et signer',
  quote: 'Consulter le devis',
  both: 'Ouvrir mes documents',
  postop: 'Lire mes conseils',
}
const SUBJECT: Record<Kind, string> = {
  consent: 'document à signer avant votre rendez-vous',
  quote: 'votre devis à consulter et à signer',
  both: 'documents à signer avant votre rendez-vous',
  postop: 'vos conseils après votre rendez-vous',
}

/** « mardi 18 novembre à 09:30 » (heure de Paris). */
function formatAppointment(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  return `${day} à ${time}`
}

function renderEmail(p: {
  patient: string
  doctorName: string
  specialty: string
  link: string
  kind: Kind
  withPostop: boolean
  appointment: string | null
  cabinet: string | null
  logoUrl: string | null
}) {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f4f5fa;font-family:Poppins,Helvetica,Arial,sans-serif;color:#171734">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fa;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid rgba(23,23,52,.08);border-radius:16px">
        <tr><td style="padding:32px 32px 8px">
          ${p.logoUrl ? `<img src="${esc(p.logoUrl)}" alt="${esc(p.cabinet ?? 'Logo du cabinet')}" style="display:block;max-height:48px;max-width:180px;margin:0 0 18px">` : ''}
          ${p.cabinet ? `<div style="font-size:15px;font-weight:600;color:#171734;margin:0 0 4px">${esc(p.cabinet)}</div>` : ''}
          <div style="font-size:13px;color:#6c5ce7;font-weight:600;letter-spacing:.08em;text-transform:uppercase">${esc(p.doctorName)}</div>
          <div style="font-size:13px;color:rgba(23,23,52,.55);margin-top:2px">${esc(p.specialty)}</div>
          <h1 style="font-size:22px;line-height:1.3;margin:22px 0 0;font-weight:600">Bonjour ${esc(p.patient)},</h1>
          <p style="font-size:15px;line-height:1.6;color:rgba(23,23,52,.72);margin:12px 0 0">
            ${esc(INTRO[p.kind] + (p.withPostop && p.kind !== 'postop' ? POSTOP_EXTRA : ''))}
          </p>
          ${
            p.appointment
              ? `<p style="font-size:14.5px;line-height:1.6;color:#171734;margin:14px 0 0;padding:12px 14px;background:#f4f5fa;border-radius:10px">Votre rendez-vous : <strong>${esc(p.appointment)}</strong>${p.kind !== 'postop' ? '<br><span style="color:rgba(23,23,52,.6);font-size:13px">Merci de signer avant cette date.</span>' : ''}</p>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:24px 32px 8px" align="left">
          <a href="${esc(p.link)}" style="display:inline-block;background:#6c5ce7;color:#ffffff;padding:14px 26px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">${esc(BUTTON[p.kind])}</a>
        </td></tr>
        <tr><td style="padding:16px 32px 32px">
          <p style="font-size:12.5px;line-height:1.55;color:rgba(23,23,52,.5);margin:0">
            Ce lien est personnel et valable 30 jours : ne le transférez pas. Si vous n'attendiez pas ce message, ignorez-le ou contactez votre cabinet.
          </p>
        </td></tr>
      </table>
      <p style="font-size:11.5px;color:rgba(23,23,52,.42);margin:16px 0 0">Envoyé via Woui pour le compte de votre praticien.</p>
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
      .select('id, doctor_id, patient, email, token, status, kind, with_postop, appointment_at, last_sent_at, doctors!inner(user_id, first_name, last_name, specialty, cabinet_name, logo_path, plan), practitioners(first_name, last_name, specialty)')
      .eq('id', consentId)
      .maybeSingle()

    // Même réponse si le consentement n'existe pas ou appartient à un autre praticien.
    const doctor = consent?.doctors as unknown as
      | {
          user_id: string
          first_name: string | null
          last_name: string | null
          specialty: string | null
          cabinet_name: string | null
          logo_path: string | null
          plan: string
        }
      | undefined
    if (consentError || !consent || !doctor || doctor.user_id !== userData.user.id) {
      return json({ error: 'Consentement introuvable' }, 404)
    }
    if (consent.status === 'signed') return json({ error: 'Ce consentement est déjà signé' }, 409)

    // Relances : 10 minutes minimum entre deux envois au même patient.
    const RESEND_DELAY_MS = 10 * 60_000
    if (consent.last_sent_at && Date.now() - new Date(consent.last_sent_at).getTime() < RESEND_DELAY_MS) {
      return json({ error: 'Ce patient a déjà reçu un e-mail il y a moins de 10 minutes. Réessayez un peu plus tard.' }, 429)
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return json({ error: "Service d'email non configuré" }, 500)

    // Offre Clinique : l'email part au nom du profil praticien qui a envoyé le consentement.
    const sender =
      (consent.practitioners as unknown as { first_name: string | null; last_name: string | null; specialty: string | null } | null) ?? doctor
    const doctorName = ['Dr', sender.first_name, sender.last_name].filter(Boolean).join(' ').trim()
    // Logo du cabinet (offre Clinique) : lien valable 30 jours, comme le lien patient.
    let logoUrl: string | null = null
    if (doctor.plan === 'clinic' && doctor.logo_path) {
      const { data: signedLogo } = await admin.storage.from('documents').createSignedUrl(doctor.logo_path, 30 * 24 * 3600)
      logoUrl = signedLogo?.signedUrl ?? null
    }
    const kind: Kind = consent.kind === 'quote' || consent.kind === 'both' || consent.kind === 'postop' ? consent.kind : 'consent'
    const html = renderEmail({
      patient: consent.patient,
      doctorName: doctorName === 'Dr' ? 'Votre cabinet dentaire' : doctorName,
      specialty: sender.specialty ?? '',
      link: `${APP_URL}/sign/${encodeURIComponent(consent.token)}`,
      kind,
      withPostop: Boolean(consent.with_postop),
      appointment: consent.appointment_at && new Date(consent.appointment_at).getTime() > Date.now() ? formatAppointment(consent.appointment_at) : null,
      cabinet: doctor.cabinet_name,
      logoUrl,
    })

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [consent.email],
        // Aucun acte médical dans l'email (donnée de santé) : il n'apparaît que sur la page sécurisée.
        subject: `${doctorName === 'Dr' ? 'Votre cabinet dentaire' : doctorName} — ${SUBJECT[kind]}`,
        html,
      }),
    })

    if (!resendResponse.ok) {
      console.error('Resend error:', await resendResponse.text())
      return json({ error: "L'email n'a pas pu être envoyé" }, 502)
    }

    // Lien valable 30 jours à compter de ce dernier envoi.
    await admin
      .from('consents')
      .update({ last_sent_at: new Date().toISOString(), link_expires_at: new Date(Date.now() + 30 * 24 * 3600_000).toISOString() })
      .eq('id', consent.id)

    return json({ success: true })
  } catch (error) {
    console.error('send-consent error:', error)
    return json({ error: 'Erreur interne' }, 500)
  }
})
