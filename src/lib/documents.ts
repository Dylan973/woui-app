import { supabase } from './supabase'

const MAX_PDF = 10 * 1024 * 1024

/** Dépose un PDF dans le stockage privé du compte (`documents/<doctorId>/<dossier>/…`). */
export async function uploadPdf(
  doctorId: string,
  folder: 'devis' | 'modeles' | 'postop',
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) return { path: null, error: 'Le document doit être au format PDF.' }
  if (file.size > MAX_PDF) return { path: null, error: 'Le PDF dépasse 10 Mo. Réduisez-le puis réessayez.' }
  const path = `${doctorId}/${folder}/${crypto.randomUUID()}.pdf`
  const { error } = await supabase.storage.from('documents').upload(path, file, { contentType: 'application/pdf', upsert: false })
  return error ? { path: null, error: 'Le PDF n’a pas pu être envoyé. Réessayez.' } : { path, error: null }
}

/** Lien temporaire (5 min) vers un document du stockage privé du compte. */
export async function documentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('documents').createSignedUrl(path, 300)
  return data?.signedUrl ?? null
}

/** Image importée (tampon scanné, signature photographiée) → PNG de 900 px de large au plus. */
export async function imageToPng(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 900 / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image illisible')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image illisible'))), 'image/png'))
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return await (await fetch(dataUrl)).blob()
}

/**
 * Enregistre la signature ou le tampon d'un profil (titulaire ou praticien ajouté).
 * image = null retire la signature.
 */
export async function saveProfileSignature(
  doctorId: string,
  profile: { id: string; isMain: boolean },
  image: Blob | null
): Promise<{ error: string | null }> {
  let path: string | null = null
  if (image) {
    path = `${doctorId}/signature/${profile.id}-${Date.now()}.png`
    const { error } = await supabase.storage.from('documents').upload(path, image, { contentType: 'image/png', upsert: false })
    if (error) return { error: 'La signature n’a pas pu être enregistrée. Réessayez.' }
  }
  const changes = { signature_path: path, updated_at: new Date().toISOString() }
  const { error } = profile.isMain
    ? await supabase.from('doctors').update(changes).eq('id', doctorId)
    : await supabase.from('practitioners').update(changes).eq('id', profile.id)
  return { error: error ? 'La signature n’a pas pu être enregistrée. Réessayez.' : null }
}
