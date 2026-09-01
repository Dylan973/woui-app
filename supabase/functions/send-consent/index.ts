// supabase/functions/send-consent/index.ts
//
// Reçoit les infos d'un consentement fraîchement créé et envoie au patient
// l'email contenant le lien de signature (/sign/:token).
//
// ⚠️ Cette fonction tourne côté serveur (Deno, runtime Supabase Edge Functions).
// C'est ICI, et uniquement ici, que la SUPABASE_SERVICE_ROLE_KEY peut être utilisée.
//
// Envoi d'email : conformément au brief, pas de service tiers (Resend, etc.).
// On utilise un client SMTP simple (denomailer) branché sur le même SMTP que
// celui configuré dans Supabase Dashboard → Project Settings → Auth → SMTP Settings.
// Variables d'env à définir via `supabase secrets set` :
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// Déploiement : supabase functions deploy send-consent

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

interface SendConsentPayload {
  consentId: string
  patientEmail: string
  patientName: string
  procedure: string
  token: string
  doctorName?: string
}

const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.woui.fr'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 })
  }

  try {
    const payload = (await req.json()) as SendConsentPayload
    const { patientEmail, patientName, procedure, token } = payload

    if (!patientEmail || !token) {
      return new Response(JSON.stringify({ error: 'Champs requis manquants' }), { status: 400 })
    }

    const signLink = `${APP_URL}/sign/${token}`
    const subject = `Votre consentement éclairé — ${procedure}`
    const html = `
      <div style="font-family:sans-serif;background:#050a14;color:#e2e8f0;padding:32px">
        <h2 style="color:#f1f5f9">Bonjour ${patientName},</h2>
        <p>Votre praticien vous invite à consulter et signer votre consentement éclairé pour l'acte suivant :</p>
        <p style="font-weight:600">${procedure}</p>
        <p style="margin:24px 0">
          <a href="${signLink}" style="background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">
            Consulter et signer
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">Ce lien est personnel, ne le partagez pas. Il vous permet de visionner une vidéo d'information puis de signer électroniquement.</p>
      </div>
    `

    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')
    const smtpFrom = Deno.env.get('SMTP_FROM') ?? 'no-reply@woui.fr'

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('SMTP non configuré — email non envoyé. Configurez SMTP_HOST/SMTP_USER/SMTP_PASS via `supabase secrets set`.')
      return new Response(JSON.stringify({ success: false, warning: 'SMTP non configuré, email non envoyé.' }), { status: 200 })
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: Number(Deno.env.get('SMTP_PORT') ?? 587),
        tls: true,
        auth: { username: smtpUser, password: smtpPass },
      },
    })

    await client.send({
      from: smtpFrom,
      to: patientEmail,
      subject,
      html,
    })
    await client.close()

    // Optionnel : trace d'audit via le client Supabase (service_role) si besoin plus tard.
    void createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('send-consent error:', error)
    return new Response(JSON.stringify({ success: false, error: String(error) }), { status: 500 })
  }
})
