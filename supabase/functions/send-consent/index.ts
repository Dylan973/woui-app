// supabase/functions/send-consent/index.ts
//
// Reçoit les infos d'un consentement fraîchement créé et envoie au patient
// l'email contenant le lien de signature (/sign/:token).
//
// ⚠️ Cette fonction tourne côté serveur (Deno, runtime Supabase Edge Functions).
// C'est ICI, et uniquement ici, que la SUPABASE_SERVICE_ROLE_KEY peut être utilisée.
//
// Envoi d'email : via Resend (secret RESEND_API_KEY déjà configuré sur ce projet
// depuis une itération précédente — on le réutilise plutôt que d'ajouter un
// second système d'envoi).
// Variables d'env (déjà présentes) : RESEND_API_KEY, APP_URL

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface SendConsentPayload {
  consentId: string
  patientEmail: string
  patientName: string
  procedure: string
  token: string
  doctorName?: string
}

const APP_URL = Deno.env.get('APP_URL') ?? 'https://woui-app.vercel.app'
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Woui <no-reply@woui.fr>'

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

    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      console.warn('RESEND_API_KEY non configuré — email non envoyé.')
      return new Response(JSON.stringify({ success: false, warning: 'RESEND_API_KEY non configuré, email non envoyé.' }), {
        status: 200,
      })
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [patientEmail],
        subject,
        html,
      }),
    })

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text()
      console.error('Resend error:', errorBody)
      return new Response(JSON.stringify({ success: false, error: errorBody }), { status: 502 })
    }

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
