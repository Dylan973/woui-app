// Import de la signature et du tampon du praticien depuis un fichier (scan ou photo).
//
// Formats : PDF (1re page, scan d'une feuille A4), PNG, JPG, WEBP, HEIC (si le navigateur sait le lire).
// Traitement, entièrement dans le navigateur :
//   1. lecture du fichier (pdf.js pour les PDF, chargé à la demande) ;
//   2. fond de la feuille rendu transparent (seuil adapté à la teinte du papier) ;
//   3. recadrage automatique autour de la signature et du tampon ;
//   4. export PNG, 1 200 px de large au plus.

const MAX_FILE = 15 * 1024 * 1024
const MAX_OUTPUT_WIDTH = 1200
const RENDER_WIDTH = 2000

export class SignatureImportError extends Error {}

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isHeic(file: File) {
  return /image\/hei[cf]/.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

/** Première page d'un PDF → canvas, rendue à ~2 000 px de large. */
async function pdfToCanvas(file: File): Promise<HTMLCanvasElement> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise
  try {
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(4, RENDER_WIDTH / base.width) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) throw new SignatureImportError('Votre navigateur ne peut pas lire ce PDF.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport }).promise
    return canvas
  } finally {
    void pdf.destroy()
  }
}

/** Image → canvas (createImageBitmap, sinon élément <img>). */
async function imageToCanvas(file: File): Promise<HTMLCanvasElement> {
  let source: CanvasImageSource & { width: number; height: number }
  let close = () => {}
  try {
    const bitmap = await createImageBitmap(file)
    source = bitmap
    close = () => bitmap.close()
  } catch {
    const url = URL.createObjectURL(file)
    try {
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('illisible'))
        img.src = url
      })
    } catch {
      URL.revokeObjectURL(url)
      throw new SignatureImportError(
        isHeic(file)
          ? 'Ce navigateur ne lit pas les photos HEIC. Sur iPhone, choisissez « Le plus compatible » (JPG) dans Réglages > Appareil photo > Formats, ou envoyez un PDF.'
          : 'Ce fichier ne peut pas être lu. Utilisez un PDF, un PNG ou un JPG.'
      )
    }
    const img = source as HTMLImageElement
    close = () => URL.revokeObjectURL(url)
    source = Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight })
  }
  const scale = Math.min(1, RENDER_WIDTH / source.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new SignatureImportError('Votre navigateur ne peut pas lire cette image.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  close()
  return canvas
}

/**
 * Fond transparent + recadrage. Le papier (le plus clair) devient transparent ; l'encre garde sa couleur
 * (signature noire ou bleue, tampon bleu ou rouge).
 */
function cleanAndCrop(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const context = canvas.getContext('2d')!
  const { width, height } = canvas
  const image = context.getImageData(0, 0, width, height)
  const px = image.data

  // Teinte du papier : 90e centile de luminosité (robuste aux photos un peu grises).
  const histogram = new Uint32Array(256)
  const lum = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const l = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
    lum[p] = l
    histogram[l | 0]++
  }
  let acc = 0
  let paper = 255
  for (let v = 0; v < 256; v++) {
    acc += histogram[v]
    if (acc >= lum.length * 0.9) {
      paper = v
      break
    }
  }
  const opaqueBelow = Math.max(40, paper - 70) // encre franche
  const clearAbove = Math.max(opaqueBelow + 10, paper - 25) // papier

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const l = lum[p]
      let alpha: number
      if (l >= clearAbove) alpha = 0
      else if (l <= opaqueBelow) alpha = 255
      else alpha = Math.round((255 * (clearAbove - l)) / (clearAbove - opaqueBelow))
      px[p * 4 + 3] = alpha
      if (alpha > 90) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0 || (maxX - minX) * (maxY - minY) < 400) {
    throw new SignatureImportError('Aucune signature n’a été trouvée sur ce fichier. Vérifiez que la feuille n’est pas blanche et que le scan est net.')
  }
  context.putImageData(image, 0, 0)

  // Marge de 3 % autour de la zone utile.
  const margin = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03) + 4
  const x0 = Math.max(0, minX - margin)
  const y0 = Math.max(0, minY - margin)
  const w = Math.min(width, maxX + margin) - x0
  const h = Math.min(height, maxY + margin) - y0
  const scale = Math.min(1, MAX_OUTPUT_WIDTH / w)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(w * scale))
  out.height = Math.max(1, Math.round(h * scale))
  const outContext = out.getContext('2d')!
  outContext.imageSmoothingQuality = 'high'
  outContext.drawImage(canvas, x0, y0, w, h, 0, 0, out.width, out.height)
  return out
}

/** Fichier (scan PDF, photo, image) → PNG transparent et recadré de la signature et du tampon. */
export async function prepareSignature(file: File): Promise<Blob> {
  if (file.size > MAX_FILE) throw new SignatureImportError('Le fichier dépasse 15 Mo. Scannez en 300 ppp plutôt qu’en 600, ou envoyez un JPG.')
  let canvas: HTMLCanvasElement
  try {
    canvas = isPdf(file) ? await pdfToCanvas(file) : await imageToCanvas(file)
  } catch (error) {
    if (error instanceof SignatureImportError) throw error
    throw new SignatureImportError(
      isPdf(file) ? 'Ce PDF ne peut pas être lu. Réenregistrez le scan en PDF ou en JPG puis réessayez.' : 'Ce fichier ne peut pas être lu. Utilisez un PDF, un PNG ou un JPG.'
    )
  }
  const cropped = cleanAndCrop(canvas)
  return await new Promise<Blob>((resolve, reject) =>
    cropped.toBlob((blob) => (blob ? resolve(blob) : reject(new SignatureImportError('La signature n’a pas pu être préparée.'))), 'image/png')
  )
}

export const SIGNATURE_ACCEPT = 'application/pdf,.pdf,image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif'
