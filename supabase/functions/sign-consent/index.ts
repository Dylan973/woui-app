// supabase/functions/sign-consent/index.ts
//
// Signature patient (page publique /sign/:token).
// 1. Enregistre la signature via la fonction SQL sign_consent (refusée si la vidéo
//    n'a pas été visionnée, si le devis n'a pas été ouvert, ou si c'est déjà signé).
// 2. Relève les éléments de preuve côté serveur : horodatage, IP, appareil.
// 3. Produit les PDF signés, calcule leur empreinte SHA-256 et les archive dans le
//    stockage privé `consents/<doctor_id>/` :
//    - consentement : le formulaire du cabinet (s'il en a déposé un pour cet acte),
//      suivi d'une page de signature ; sinon la page de signature seule ;
//    - devis : le PDF déposé par le cabinet, suivi d'une page de signature.
//    La page de signature porte la signature du patient, celle (ou le tampon) du
//    praticien et le dossier de preuve.
//
// Déploiement : supabase functions deploy sign-consent --no-verify-jwt
// (accès patient sans compte : l'autorisation repose sur le token du lien).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'npm:pdf-lib@1.17.1'

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
  kind: 'consent' | 'quote' | 'both'
  template_path: string | null
  quote_path: string | null
  quote_name: string | null
  quote_opened_at: string | null
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

type Signer = { first_name?: string | null; last_name?: string | null; specialty?: string | null; phone?: string | null }

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

interface SignaturePage {
  title: string
  subtitle: string
  rows: [string, string][]
  statement: string
  patientPng: Uint8Array
  practitionerPng: Uint8Array | null
  proof: [string, string][]
}

/** Ajoute à la fin du document la page de signature (A4). */
async function addSignaturePage(pdf: PDFDocument, p: SignaturePage) {
  const page = pdf.addPage([595.28, 841.89])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.05, 0.12, 0.1)
  const muted = rgb(0.4, 0.45, 0.43)
  const line = rgb(0.85, 0.89, 0.87)
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
    page.drawLine({ start: { x: left, y }, end: { x: left + width, y }, thickness: 0.6, color: line })
    y -= 18
  }

  page.drawRectangle({ x: 0, y: 826, width: 595.28, height: 16, color: rgb(0.067, 0.694, 0.518) })
  text(p.title, 18, bold)
  y -= 2
  text(p.subtitle, 13, regular, muted)
  rule()
  for (const [label, value] of p.rows) row(label, value)
  rule()

  text('Déclaration du patient', 11.5, bold)
  y -= 4
  text(p.statement)
  y -= 12

  // Deux cadres côte à côte : patient à gauche, praticien à droite.
  const boxW = (width - 20) / 2
  const boxH = 104
  const drawBox = async (x: number, label: string, png: Uint8Array | null, empty: string) => {
    page.drawText(safe(label), { x, y, size: 9.5, font: regular, color: muted })
    page.drawRectangle({ x, y: y - boxH - 8, width: boxW, height: boxH, borderColor: line, borderWidth: 0.8 })
    if (png) {
      try {
        const img = await pdf.embedPng(png)
        const scale = Math.min((boxW - 20) / img.width, (boxH - 16) / img.height)
        const w = img.width * scale
        const h = img.height * scale
        page.drawImage(img, { x: x + (boxW - w) / 2, y: y - 8 - (boxH + h) / 2, width: w, height: h })
        return
      } catch {
        // image illisible : on laisse le cadre avec la mention ci-dessous
      }
    }
    page.drawText(safe(empty), { x: x + 10, y: y - 8 - boxH / 2, size: 9, font: regular, color: muted })
  }
  await drawBox(left, 'Signature du patient', p.patientPng, '[signature jointe au dossier]')
  await drawBox(left + boxW + 20, 'Signature ou tampon du praticien', p.practitionerPng, 'Non renseigné')
  y -= boxH + 30
  rule()

  text('Dossier de preuve', 11.5, bold)
  y -= 4
  for (const [label, value] of p.proof) row(label, value)

  page.drawText(
    safe(
      "Page générée automatiquement par Woui au moment de la signature. L'empreinte SHA-256 du document complet est enregistrée à part afin de pouvoir en vérifier l'intégrité."
    ),
    { x: left, y: 40, size: 8, font: regular, color: muted, maxWidth: width, lineHeight: 11 }
  )
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? ''
  return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function download(path: string | null | undefined): Promise<Uint8Array | null> {
  if (!path) return null
  const { data, error } = await admin.storage.from('documents').download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

/** Document du cabinet (formulaire ou devis) ; document vide s'il est absent ou illisible. */
async function baseDocument(path: string | null): Promise<{ pdf: PDFDocument; fromFile: boolean }> {
  const bytes = await download(path)
  if (bytes) {
    try {
      return { pdf: await PDFDocument.load(bytes, { ignoreEncryption: true }), fromFile: true }
    } catch (error) {
      console.error('PDF du cabinet illisible:', path, error)
    }
  }
  return { pdf: await PDFDocument.create(), fromFile: false }
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
      return json(
        { error: 'Signature impossible : la vidéo doit être visionnée en entier, le devis doit avoir été ouvert, et le document ne doit pas être déjà signé.' },
        409
      )
    }

    // À partir d'ici la signature est enregistrée : une erreur PDF ne doit pas l'annuler.
    const update: Record<string, unknown> = { signed_ip: ip || null, signed_user_agent: ua || null }
    let pdfReady = false
    let quoteReady = false
    try {
      const { data: doctor } = await admin
        .from('doctors')
        .select('first_name, last_name, specialty, phone, signature_path')
        .eq('id', consent.doctor_id)
        .maybeSingle()
      // Offre Clinique : nom et signature du profil praticien qui a envoyé le document.
      let signer: Signer = doctor ?? {}
      let signaturePath: string | null = doctor?.signature_path ?? null
      if (consent.practitioner_id) {
        const { data: practitioner } = await admin
          .from('practitioners')
          .select('first_name, last_name, specialty, signature_path')
          .eq('id', consent.practitioner_id)
          .maybeSingle()
        if (practitioner) {
          signer = { ...signer, ...practitioner }
          signaturePath = practitioner.signature_path ?? null
        }
      }
      const doctorName = ['Dr', signer.first_name, signer.last_name].filter(Boolean).join(' ')
      const patientPng = decodeDataUrl(signature)
      const practitionerPng = await download(signaturePath)
      const identity: [string, string][] = [['Patient', consent.patient]]
      const practitionerRows: [string, string][] = [['Praticien', doctorName === 'Dr' ? '—' : doctorName]]
      if (signer.specialty) practitionerRows.push(['Spécialité', signer.specialty])
      if (signer.phone) practitionerRows.push(['Téléphone du cabinet', signer.phone])
      const proofEnd: [string, string][] = [
        ['Signé le', `${fmt(consent.signed_at)} (heure de Paris, horodatage serveur)`],
        ['Adresse IP', ip || 'non disponible'],
        ['Appareil', ua ? ua.slice(0, 160) : 'non disponible'],
        ['Référence', consent.id],
      ]

      if (consent.kind !== 'quote') {
        try {
          const { pdf, fromFile } = await baseDocument(consent.template_path)
          pdf.setTitle(`Consentement éclairé — ${consent.procedure}`)
          pdf.setAuthor('Woui')
          await addSignaturePage(pdf, {
            title: fromFile ? 'PAGE DE SIGNATURE' : 'CONSENTEMENT ÉCLAIRÉ',
            subtitle: fromFile ? `Consentement éclairé — ${consent.procedure}` : consent.procedure,
            rows: [...identity, ['Acte concerné', consent.procedure], ...practitionerRows],
            statement: fromFile
              ? "Je certifie avoir lu le formulaire de consentement qui précède, avoir visionné la vidéo d'information présentant le déroulé de l'acte, ses suites habituelles et ses risques éventuels, avoir pu poser mes questions à mon praticien, et consens à l'acte médical mentionné ci-dessus."
              : "Je certifie avoir visionné la vidéo d'information présentant le déroulé de l'acte, ses suites habituelles et ses risques éventuels, avoir pu poser mes questions à mon praticien, et consens à l'acte médical mentionné ci-dessus.",
            patientPng,
            practitionerPng,
            proof: [
              ['Lien envoyé le', fmt(consent.sent_at)],
              ['Lien ouvert le', fmt(consent.opened_at)],
              ['Vidéo visionnée le', `${fmt(consent.viewed_at)} (${consent.video_progress ?? 0} %)`],
              ...proofEnd,
            ],
          })
          const bytes = await pdf.save()
          const path = `${consent.doctor_id}/${consent.id}.pdf`
          const { error } = await admin.storage.from('consents').upload(path, bytes, { contentType: 'application/pdf', upsert: false })
          if (error) throw error
          update.pdf_url = path
          update.document_hash = await sha256Hex(bytes)
          pdfReady = true
        } catch (error) {
          console.error('PDF du consentement non généré:', error)
        }
      }

      if (consent.kind !== 'consent') {
        try {
          const { pdf } = await baseDocument(consent.quote_path)
          pdf.setTitle(`Devis signé — ${consent.patient}`)
          await addSignaturePage(pdf, {
            title: 'PAGE DE SIGNATURE',
            subtitle: `Devis${consent.quote_name ? ` — ${consent.quote_name}` : ''}`,
            rows: [...identity, ['Document', consent.quote_name ?? 'Devis'], ...practitionerRows],
            statement:
              "Bon pour accord. Je reconnais avoir reçu et lu le devis qui précède, en avoir compris le contenu et le montant restant à ma charge, et je l'accepte.",
            patientPng,
            practitionerPng,
            proof: [['Lien envoyé le', fmt(consent.sent_at)], ['Devis ouvert le', fmt(consent.quote_opened_at)], ...proofEnd],
          })
          const bytes = await pdf.save()
          const path = `${consent.doctor_id}/${consent.id}-devis.pdf`
          const { error } = await admin.storage.from('consents').upload(path, bytes, { contentType: 'application/pdf', upsert: false })
          if (error) throw error
          update.quote_pdf_url = path
          update.quote_hash = await sha256Hex(bytes)
          quoteReady = true
        } catch (error) {
          console.error('PDF du devis non généré:', error)
        }
      }
    } catch (pdfError) {
      console.error('PDF non généré:', pdfError)
    }
    await admin.from('consents').update(update).eq('id', consent.id)

    return json({
      consent: {
        id: consent.id,
        patient: consent.patient,
        procedure: consent.procedure,
        kind: consent.kind,
        status: consent.status,
        sent_at: consent.sent_at,
        signed_at: consent.signed_at,
        video_progress: consent.video_progress,
        pdf_ready: pdfReady,
        quote_ready: quoteReady,
      },
    })
  } catch (error) {
    console.error('sign-consent error:', error)
    return json({ error: 'Erreur interne' }, 500)
  }
})
