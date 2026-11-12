// supabase/functions/sign-consent/index.ts
//
// Signature patient (page publique /sign/:token).
// 1. Enregistre la signature via la fonction SQL sign_consent (refusée si la vidéo
//    n'a pas été visionnée ou si le document est déjà signé).
// 2. Relève les éléments de preuve côté serveur : horodatage, IP, appareil.
// 3. Génère le PDF signé, calcule son empreinte SHA-256 et l'archive dans le
//    stockage privé `consents/<doctor_id>/<consent_id>.pdf`.
//
// Déploiement : supabase functions deploy sign-consent --no-verify-jwt
// (accès patient sans compte : l'autorisation repose sur le token du lien).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1'

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

interface ConsentRow {
  id: string
  doctor_id: string
  practitioner_id: string | null
  patient: string
  email: string
  procedure: string
  status: string
  token: string
  video_progress: number | null
  sent_at: string
  opened_at: string | null
  viewed_at: string | null
  signed_at: string
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—'

/** Polices standard PDF : on remplace les caractères hors WinAnsi pour éviter un échec de génération. */
const safe = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF—–…€]/g, '?')

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of safe(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

async function buildPdf(c: ConsentRow, doctor: Record<string, string | null>, signaturePng: Uint8Array, ip: string, ua: string) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Consentement éclairé — ${c.procedure}`)
  pdf.setAuthor('Woui')
  pdf.setCreationDate(new Date(c.signed_at))
  const page: PDFPage = pdf.addPage([595.28, 841.89]) // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.05, 0.12, 0.1)
  const muted = rgb(0.4, 0.45, 0.43)
  const mint = rgb(0.067, 0.694, 0.518)
  const left = 56
  const width = 595.28 - left * 2
  let y = 785

  const text = (t: string, size = 10.5, font = regular, color = ink) => {
    for (const l of wrap(t, font, size, width)) {
      page.drawText(l, { x: left, y, size, font, color })
      y -= size * 1.45
    }
  }
  const row = (label: string, value: string) => {
    page.drawText(safe(label), { x: left, y, size: 9.5, font: regular, color: muted })
    const lines = wrap(value, bold, 10.5, width - 150)
    lines.forEach((l, i) => page.drawText(l, { x: left + 150, y: y - i * 14, size: 10.5, font: bold, color: ink }))
    y -= Math.max(1, lines.length) * 14 + 4
  }
  const rule = () => {
    y -= 4
    page.drawLine({ start: { x: left, y }, end: { x: left + width, y }, thickness: 0.6, color: rgb(0.85, 0.89, 0.87) })
    y -= 18
  }

  page.drawRectangle({ x: 0, y: 826, width: 595.28, height: 16, color: mint })
  text('CONSENTEMENT ÉCLAIRÉ', 18, bold)
  y -= 2
  text(c.procedure, 13, regular, muted)
  rule()

  const doctorName = ['Dr', doctor.first_name, doctor.last_name].filter(Boolean).join(' ')
  row('Patient', c.patient)
  row('Acte concerné', c.procedure)
  row('Praticien', doctorName === 'Dr' ? '—' : doctorName)
  if (doctor.specialty) row('Spécialité', doctor.specialty)
  if (doctor.phone) row('Téléphone du cabinet', doctor.phone)
  rule()

  text('Déclaration du patient', 11.5, bold)
  y -= 4
  text(
    "Je certifie avoir visionné la vidéo d'information présentant le déroulé de l'acte, ses suites habituelles et ses risques éventuels, avoir pu poser mes questions à mon praticien, et consens à l'acte médical mentionné ci-dessus."
  )
  y -= 10

  text('Signature du patient', 9.5, regular, muted)
  y -= 6
  try {
    const img = await pdf.embedPng(signaturePng)
    const scale = Math.min(220 / img.width, 90 / img.height)
    const h = img.height * scale
    page.drawRectangle({ x: left, y: y - h - 8, width: 236, height: h + 16, borderColor: rgb(0.85, 0.89, 0.87), borderWidth: 0.8 })
    page.drawImage(img, { x: left + 8, y: y - h, width: img.width * scale, height: h })
    y -= h + 30
  } catch {
    text('[signature graphique jointe au dossier]')
    y -= 10
  }
  rule()

  text('Dossier de preuve', 11.5, bold)
  y -= 4
  row('Lien envoyé le', fmt(c.sent_at))
  row('Lien ouvert le', fmt(c.opened_at))
  row('Vidéo visionnée le', `${fmt(c.viewed_at)} (${c.video_progress ?? 0} %)`)
  row('Signé le', `${fmt(c.signed_at)} (heure de Paris, horodatage serveur)`)
  row('Adresse IP', ip || 'non disponible')
  row('Appareil', ua ? ua.slice(0, 160) : 'non disponible')
  row('Référence', c.id)

  page.drawText(
    safe(
      "Document généré automatiquement par Woui au moment de la signature. Son empreinte SHA-256 est enregistrée à part afin de pouvoir en vérifier l'intégrité."
    ),
    { x: left, y: 40, size: 8, font: regular, color: muted, maxWidth: width, lineHeight: 11 }
  )

  return await pdf.save()
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? ''
  return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    const { token, signature } = (await req.json()) as { token?: string; signature?: string }
    if (!token || !signature?.startsWith('data:image/png;base64,')) return json({ error: 'Signature invalide' }, 400)

    const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? '').split(',')[0].trim()
    const ua = req.headers.get('user-agent') ?? ''

    const { data: rows, error: signError } = await admin.rpc('sign_consent', { p_token: token, p_signature: signature })
    const consent = (Array.isArray(rows) ? rows[0] : rows) as ConsentRow | undefined
    if (signError || !consent) {
      return json({ error: 'Signature impossible : la vidéo doit être visionnée en entier, et le document ne doit pas être déjà signé.' }, 409)
    }

    // À partir d'ici la signature est enregistrée : une erreur PDF ne doit pas l'annuler.
    let pdfPath: string | null = null
    try {
      const { data: doctor } = await admin
        .from('doctors')
        .select('first_name, last_name, specialty, phone')
        .eq('id', consent.doctor_id)
        .maybeSingle()
      // Offre Clinique : le PDF porte le nom du profil praticien qui a envoyé le consentement.
      let signer: Record<string, string | null> = doctor ?? {}
      if (consent.practitioner_id) {
        const { data: practitioner } = await admin
          .from('practitioners')
          .select('first_name, last_name, specialty')
          .eq('id', consent.practitioner_id)
          .maybeSingle()
        if (practitioner) signer = { ...signer, ...practitioner }
      }
      const bytes = await buildPdf(consent, signer, decodeDataUrl(signature), ip, ua)
      const hash = await sha256Hex(bytes)
      const path = `${consent.doctor_id}/${consent.id}.pdf`
      const { error: uploadError } = await admin.storage
        .from('consents')
        .upload(path, bytes, { contentType: 'application/pdf', upsert: false })
      if (uploadError) throw uploadError
      pdfPath = path
      await admin.from('consents').update({ pdf_url: path, document_hash: hash, signed_ip: ip || null, signed_user_agent: ua || null }).eq('id', consent.id)
    } catch (pdfError) {
      console.error('PDF non généré:', pdfError)
      await admin.from('consents').update({ signed_ip: ip || null, signed_user_agent: ua || null }).eq('id', consent.id)
    }

    return json({
      consent: {
        id: consent.id,
        patient: consent.patient,
        procedure: consent.procedure,
        status: consent.status,
        sent_at: consent.sent_at,
        signed_at: consent.signed_at,
        video_progress: consent.video_progress,
        pdf_ready: pdfPath !== null,
      },
    })
  } catch (error) {
    console.error('sign-consent error:', error)
    return json({ error: 'Erreur interne' }, 500)
  }
})
