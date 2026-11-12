import { supabase } from './supabase'

const SIZE = 320

/** Recadre la photo au carré (centre) et la réduit en JPEG léger. */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image illisible')
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image illisible'))), 'image/jpeg', 0.86)
  )
}

/** Envoie la photo dans le stockage privé du compte et renvoie son chemin. */
export async function uploadAvatar(doctorId: string, profileId: string, file: File): Promise<{ path: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) return { path: null, error: 'Choisissez une image (JPG ou PNG).' }
  try {
    const blob = await toSquareJpeg(file)
    const path = `${doctorId}/${profileId}-${Date.now()}.jpg`
    const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    return error ? { path: null, error: 'La photo n’a pas pu être enregistrée.' } : { path, error: null }
  } catch {
    return { path: null, error: 'Cette image ne peut pas être lue. Essayez un fichier JPG ou PNG.' }
  }
}

export async function removeAvatar(path: string | null | undefined) {
  if (path) await supabase.storage.from('avatars').remove([path])
}

/** Liens temporaires (1 h) pour afficher les photos du stockage privé. */
export async function signAvatarUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data } = await supabase.storage.from('avatars').createSignedUrls(paths, 3600)
  const urls: Record<string, string> = {}
  for (const item of data ?? []) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
  return urls
}
