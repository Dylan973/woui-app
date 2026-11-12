import { zipSync, strToU8 } from 'fflate'
import { supabase } from './supabase'

/**
 * Archive annuelle : tous les documents signés d'une année civile, dans un fichier ZIP
 * téléchargé sur l'ordinateur du cabinet, avec un index (CSV) des envois.
 * Le ZIP est construit dans le navigateur : rien n'est recopié côté serveur.
 */

interface ExportRow {
  id: string
  patient: string
  email: string
  procedure: string
  kind: 'consent' | 'quote' | 'both'
  signed_at: string
  pdf_url: string | null
  quote_pdf_url: string | null
  practitioner_id: string | null
}

export interface ExportProgress {
  done: number
  total: number
}

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'patient'

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`

export function exportReminderKey(doctorId: string, year: number) {
  return `woui-archive-${doctorId}-${year}`
}

export async function countSignedInYear(doctorId: string, year: number): Promise<number> {
  const { count } = await supabase
    .from('consents')
    .select('id', { count: 'exact', head: true })
    .eq('doctor_id', doctorId)
    .eq('status', 'signed')
    .gte('signed_at', `${year}-01-01T00:00:00Z`)
    .lt('signed_at', `${year + 1}-01-01T00:00:00Z`)
  return count ?? 0
}

export async function exportYear(
  doctorId: string,
  year: number,
  practitionerName: (practitionerId: string | null) => string,
  onProgress: (p: ExportProgress) => void
): Promise<{ error: string | null; count: number }> {
  const rows: ExportRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('consents')
      .select('id, patient, email, procedure, kind, signed_at, pdf_url, quote_pdf_url, practitioner_id')
      .eq('doctor_id', doctorId)
      .eq('status', 'signed')
      .gte('signed_at', `${year}-01-01T00:00:00Z`)
      .lt('signed_at', `${year + 1}-01-01T00:00:00Z`)
      .order('signed_at', { ascending: true })
      .range(from, from + 999)
    if (error) return { error: 'La liste des documents n’a pas pu être chargée.', count: 0 }
    rows.push(...((data ?? []) as ExportRow[]))
    if (!data || data.length < 1000) break
  }
  if (rows.length === 0) return { error: `Aucun document signé en ${year}.`, count: 0 }

  const jobs: { path: string; name: string }[] = []
  const used = new Set<string>()
  const unique = (name: string) => {
    let candidate = name
    for (let i = 2; used.has(candidate); i++) candidate = name.replace(/\.pdf$/, `-${i}.pdf`)
    used.add(candidate)
    return candidate
  }
  const csv = [
    ['Date de signature', 'Patient', 'E-mail', 'Acte', 'Contenu', 'Praticien', 'Fichiers'].map(csvCell).join(';'),
  ]
  for (const row of rows) {
    const day = row.signed_at.slice(0, 10)
    const files: string[] = []
    if (row.pdf_url) {
      const name = unique(`${day}_${slug(row.patient)}_consentement.pdf`)
      jobs.push({ path: row.pdf_url, name })
      files.push(name)
    }
    if (row.quote_pdf_url) {
      const name = unique(`${day}_${slug(row.patient)}_devis.pdf`)
      jobs.push({ path: row.quote_pdf_url, name })
      files.push(name)
    }
    csv.push(
      [
        new Date(row.signed_at).toLocaleString('fr-FR'),
        row.patient,
        row.email,
        row.procedure,
        { consent: 'Consentement', quote: 'Devis', both: 'Consentement + devis' }[row.kind] ?? row.kind,
        practitionerName(row.practitioner_id),
        files.join(' | ') || 'PDF en préparation',
      ]
        .map(csvCell)
        .join(';')
    )
  }

  const entries: Record<string, Uint8Array> = {}
  const missing: string[] = []
  let done = 0
  onProgress({ done, total: jobs.length })
  // Téléchargements 4 par 4 pour rester rapide sans saturer la connexion du cabinet.
  for (let i = 0; i < jobs.length; i += 4) {
    await Promise.all(
      jobs.slice(i, i + 4).map(async (job) => {
        const { data, error } = await supabase.storage.from('consents').download(job.path)
        if (error || !data) missing.push(job.name)
        else entries[`documents/${job.name}`] = new Uint8Array(await data.arrayBuffer())
        done++
        onProgress({ done, total: jobs.length })
      })
    )
  }
  if (missing.length > 0) csv.push('', csvCell(`Fichiers indisponibles au moment de l'export : ${missing.join(', ')}`))

  // Les PDF sont déjà compressés : on les range tels quels (level 0), l'index est compressé.
  const zip = zipSync(
    {
      ...Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, [v, { level: 0 }]])),
      [`index-${year}.csv`]: [strToU8('﻿' + csv.join('\r\n')), { level: 6 }],
    } as Parameters<typeof zipSync>[0]
  )
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `woui-archives-${year}.zip`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  try {
    localStorage.setItem(exportReminderKey(doctorId, year), 'done')
  } catch {
    /* stockage indisponible : le rappel reviendra */
  }
  return { error: missing.length > 0 ? `${missing.length} fichier(s) indisponible(s), listés dans l'index.` : null, count: rows.length }
}
