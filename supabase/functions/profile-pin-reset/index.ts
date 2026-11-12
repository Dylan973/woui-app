// supabase/functions/profile-pin-reset/index.ts
//
// « Code oublié ? » : envoie à l'adresse du compte un lien qui supprime le code
// à 4 chiffres d'un profil. Un nouveau code se crée ensuite dans Paramètres > Sécurité.
//
// Sécurité :
// - Réservé à un utilisateur connecté ; le profil doit appartenir à son compte.
// - L'e-mail part uniquement à l'adresse du compte (jamais à une adresse fournie par le navigateur).
// - Le lien contient un jeton aléatoire dont seule l'empreinte SHA-256 est stockée ; il expire après 30 minutes.
// - Une demande toutes les 2 minutes au plus par profil.
//
// Secrets : RESEND_API_KEY, RESEND_FROM (optionnel), APP_URL

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
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** d***@exemple.fr : rappelle où l'e-mail est parti sans afficher l'adresse entière. */
const mask = (email: string) => email.replace(/^(.).*(@.*)$/, '$1***$2')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: userData, error: userError } = await admin.auth.getUser(jwt)
    if (userError || !userData?.user) return json({ error: 'Connexion requise' }, 401)

    const { profile } = (await req.json()) as { profile?: string }
    if (!profile) return json({ error: 'Profil manquant' }, 400)

    const { data: doctor } = await admin.from('doctors').select('id, email, first_name, last_name').eq('user_id', userData.user.id).maybeSingle()
    if (!doctor) return json({ error: 'Compte introuvable' }, 404)

    let name = [doctor.first_name, doctor.last_name].filter(Boolean).join(' ')
    if (profile !== 'main') {
      const { data: practitioner } = await admin
        .from('practitioners')
        .select('first_name, last_name')
        .eq('id', profile)
        .eq('doctor_id', doctor.id)
        .maybeSingle()
      if (!practitioner) return json({ error: 'Profil introuvable' }, 404)
      name = [practitioner.first_name, practitioner.last_name].filter(Boolean).join(' ')
    }

    const { data: recent } = await admin
      .from('profile_pin_resets')
      .select('created_at')
      .eq('doctor_id', doctor.id)
      .eq('profile_key', profile)
      .gt('created_at', new Date(Date.now() - 2 * 60_000).toISOString())
      .limit(1)
    if (recent && recent.length > 0) return json({ success: true, sentTo: mask(doctor.email) })

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return json({ error: "Service d'email non configuré" }, 500)

    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
    await admin.from('profile_pin_resets').delete().eq('doctor_id', doctor.id).eq('profile_key', profile)
    const { error: insertError } = await admin.from('profile_pin_resets').insert({
      token_hash: await sha256Hex(token),
      doctor_id: doctor.id,
      profile_key: profile,
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    })
    if (insertError) throw insertError

    const link = `${APP_URL}/profiles?reset=${token}`
    const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f4f5fa;font-family:Poppins,Helvetica,Arial,sans-serif;color:#171734">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fa;padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid rgba(23,23,52,.08);border-radius:16px">
      <tr><td style="padding:32px">
        <div style="font-size:13px;color:#6c5ce7;font-weight:600;letter-spacing:.08em;text-transform:uppercase">Woui</div>
        <h1 style="font-size:21px;line-height:1.3;margin:18px 0 0;font-weight:600">Code du profil oublié</h1>
        <p style="font-size:15px;line-height:1.6;color:rgba(23,23,52,.7);margin:12px 0 0">
          Une demande de réinitialisation a été faite pour le code à 4 chiffres du profil <b>${esc(name ? `Dr ${name}` : 'principal')}</b>.
          Ce lien supprime le code. Vous pourrez ensuite en créer un nouveau dans Paramètres &gt; Sécurité.
        </p>
        <p style="margin:24px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#6c5ce7;color:#ffffff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">Supprimer le code</a></p>
        <p style="font-size:12.5px;line-height:1.55;color:rgba(23,23,52,.5);margin:22px 0 0">
          Le lien est valable 30 minutes et fonctionne sur un appareil connecté à votre compte Woui. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : le code reste inchangé.
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM, to: [doctor.email], subject: 'Woui — code de profil oublié', html }),
    })
    if (!resendResponse.ok) {
      console.error('Resend error:', await resendResponse.text())
      await admin.from('profile_pin_resets').delete().eq('doctor_id', doctor.id).eq('profile_key', profile)
      return json({ error: "L'email n'a pas pu être envoyé" }, 502)
    }

    return json({ success: true, sentTo: mask(doctor.email) })
  } catch (error) {
    console.error('profile-pin-reset error:', error)
    return json({ error: 'Erreur interne' }, 500)
  }
})
