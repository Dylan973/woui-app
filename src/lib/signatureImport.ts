// Import de la signature et du tampon du praticien depuis un fichier (scan ou photo).
//
// Formats : PDF (1re page, scan d'une feuille A4), PNG, JPG, WEBP, HEIC (si le navigateur sait le lire).
// Traitement, entièrement dans le navigateur :
//   1. lecture du fichier (pdf.js pour les PDF, chargé à la demande) ;
//   2. fond rendu transparent, en comparant chaque point au papier qui l'entoure (ombres et
//      lumière inégale d'une photo n'apparaissent pas) ;
//   3. nettoyage : bords de feuille, traits du scanner, poussières et taches isolées sont retirés ;
//   4. encre renforcée (plus foncée, plus opaque) pour rester lisible en petit sur un document ;
//   5. recadrage serré autour de la signature et du tampon, export PNG.

const MAX_FILE = 15 * 1024 * 1024
const MAX_OUTPUT_WIDTH = 1200
const RENDER_LONG_SIDE = 2400
/** En dessous de cette largeur d'encre (px de l'image d'origine), la signature risque d'être floue. */
export const SMALL_INK_WIDTH = 320

export class SignatureImportError extends Error {}

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isHeic(file: File) {
  return /image\/hei[cf]/.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

function blankCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

/** Première page d'un PDF → canvas, ~2 400 px sur le grand côté. */
async function pdfToCanvas(file: File): Promise<HTMLCanvasElement> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise
  try {
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(5, RENDER_LONG_SIDE / Math.max(base.width, base.height)) })
    const canvas = blankCanvas(viewport.width, viewport.height)
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
  const scale = Math.min(1, RENDER_LONG_SIDE / Math.max(source.width, source.height))
  const canvas = blankCanvas(source.width * scale, source.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new SignatureImportError('Votre navigateur ne peut pas lire cette image.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  close()
  return canvas
}

/** Fichier (scan PDF, photo, image) → image brute sur fond blanc. */
export async function loadSignature(file: File): Promise<HTMLCanvasElement> {
  if (file.size > MAX_FILE) throw new SignatureImportError('Le fichier dépasse 15 Mo. Scannez en 300 ppp plutôt qu’en 600, ou envoyez un JPG.')
  try {
    return isPdf(file) ? await pdfToCanvas(file) : await imageToCanvas(file)
  } catch (error) {
    if (error instanceof SignatureImportError) throw error
    throw new SignatureImportError(
      isPdf(file) ? 'Ce PDF ne peut pas être lu. Réenregistrez le scan en PDF ou en JPG puis réessayez.' : 'Ce fichier ne peut pas être lu. Utilisez un PDF, un PNG ou un JPG.'
    )
  }
}

/** Image tournée d'un multiple de 90° (sens horaire). */
export function rotateQuarter(source: HTMLCanvasElement, quarter: number): HTMLCanvasElement {
  const q = ((quarter % 4) + 4) % 4
  if (q === 0) return source
  const out = blankCanvas(q % 2 ? source.height : source.width, q % 2 ? source.width : source.height)
  const context = out.getContext('2d')!
  context.translate(out.width / 2, out.height / 2)
  context.rotate((q * Math.PI) / 2)
  context.drawImage(source, -source.width / 2, -source.height / 2)
  return out
}

/** Nettoyage du fond : léger (garde les traits pâles), standard, fort (photo grise ou papier coloré). */
export type CleanLevel = 'light' | 'normal' | 'strong'

const LEVELS: Record<CleanLevel, { clear: number; opaque: number }> = {
  // Rapport « point / papier autour » : au-dessus de clear, transparent ; en dessous de opaque, encre pleine.
  light: { clear: 0.93, opaque: 0.7 },
  normal: { clear: 0.86, opaque: 0.62 },
  strong: { clear: 0.76, opaque: 0.5 },
}

export interface CleanResult {
  /** Signature et tampon seuls, fond transparent, recadrés au plus près. */
  image: HTMLCanvasElement
  /** Largeur de l'encre dans l'image d'origine (px) : sert à prévenir si le scan est trop petit. */
  inkWidth: number
  /** Éléments parasites retirés (bords, traits, poussières). */
  removed: number
}

/**
 * Image brute → signature et tampon seuls, fond transparent, recadrés serré.
 * Lève SignatureImportError si aucune encre n'est trouvée.
 */
export function cleanSignature(raw: HTMLCanvasElement, level: CleanLevel = 'normal'): CleanResult {
  const { width: W, height: H } = raw
  const ctx = raw.getContext('2d', { willReadFrequently: true })!
  const src = ctx.getImageData(0, 0, W, H)
  const px = src.data
  const N = W * H

  // 1. Luminosité et papier local (moyenne sur un large voisinage, via une image intégrale).
  const lum = new Uint8Array(N)
  for (let i = 0, p = 0; p < N; i += 4, p++) lum[p] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
  const iw = W + 1
  const integral = new Uint32Array(iw * (H + 1))
  for (let y = 0; y < H; y++) {
    let row = 0
    for (let x = 0; x < W; x++) {
      row += lum[y * W + x]
      integral[(y + 1) * iw + x + 1] = integral[y * iw + x + 1] + row
    }
  }
  const r = Math.max(12, Math.round(Math.max(W, H) / 30))
  const { clear, opaque } = LEVELS[level]
  const alpha = new Uint8Array(N)
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(H, y + r + 1)
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(W, x + r + 1)
      const sum = integral[y1 * iw + x1] - integral[y0 * iw + x1] - integral[y1 * iw + x0] + integral[y0 * iw + x0]
      // Le papier est un peu plus clair que la moyenne locale (qui contient aussi l'encre).
      const paper = Math.max(60, Math.min(255, (sum / ((x1 - x0) * (y1 - y0))) * 1.04))
      const ratio = lum[y * W + x] / paper
      alpha[y * W + x] = ratio >= clear ? 0 : ratio <= opaque ? 255 : Math.round((255 * (clear - ratio)) / (clear - opaque))
    }
  }

  // 2. Éléments d'encre séparés (8-connexité).
  const labels = new Int32Array(N).fill(-1)
  const comps: { area: number; x0: number; y0: number; x1: number; y1: number }[] = []
  const stack = new Int32Array(N)
  for (let start = 0; start < N; start++) {
    if (alpha[start] < 70 || labels[start] !== -1) continue
    const id = comps.length
    const c = { area: 0, x0: W, y0: H, x1: 0, y1: 0 }
    let top = 0
    stack[top++] = start
    labels[start] = id
    while (top > 0) {
      const p = stack[--top]
      const x = p % W
      const y = (p - x) / W
      c.area++
      if (x < c.x0) c.x0 = x
      if (x > c.x1) c.x1 = x
      if (y < c.y0) c.y0 = y
      if (y > c.y1) c.y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= H) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= W) continue
          const q = ny * W + nx
          if (labels[q] === -1 && alpha[q] >= 70) {
            labels[q] = id
            stack[top++] = q
          }
        }
      }
    }
    comps.push(c)
  }

  // 3. Parasites : traits le long des bords (bord de feuille, ombre du scanner), lignes fines très longues, poussières.
  const edge = Math.max(4, Math.round(Math.min(W, H) * 0.015))
  const isNoise = comps.map((c) => {
    const w = c.x1 - c.x0 + 1
    const h = c.y1 - c.y0 + 1
    const touchesEdge = c.x0 <= edge || c.y0 <= edge || c.x1 >= W - 1 - edge || c.y1 >= H - 1 - edge
    const lineLike = (w > 12 * h && w > W * 0.15) || (h > 12 * w && h > H * 0.15)
    const frameLike = (w > W * 0.6 || h > H * 0.6) && c.area / (w * h) < 0.03
    return c.area < 6 || lineLike || frameLike || (touchesEdge && (lineLike || c.area / (w * h) < 0.05 || w < 4 || h < 4))
  })
  let largest = -1
  comps.forEach((c, i) => {
    if (!isNoise[i] && (largest < 0 || c.area > comps[largest].area)) largest = i
  })
  if (largest < 0) {
    throw new SignatureImportError('Aucune signature n’a été trouvée sur ce fichier. Vérifiez que la feuille n’est pas blanche et que le scan est net.')
  }

  // Bloc principal : les éléments significatifs (au moins 1,5 % du plus grand) proches les uns des autres,
  // puis les petits éléments (points, accents) situés dans ce bloc.
  const keep = new Uint8Array(comps.length)
  const minArea = comps[largest].area * 0.015
  let bx0 = comps[largest].x0
  let by0 = comps[largest].y0
  let bx1 = comps[largest].x1
  let by1 = comps[largest].y1
  keep[largest] = 1
  for (let changed = true; changed; ) {
    changed = false
    const mx = Math.max(40, (bx1 - bx0) * 0.35)
    const my = Math.max(40, (by1 - by0) * 0.35)
    comps.forEach((c, i) => {
      if (keep[i] || isNoise[i] || c.area < minArea) return
      if (c.x1 >= bx0 - mx && c.x0 <= bx1 + mx && c.y1 >= by0 - my && c.y0 <= by1 + my) {
        keep[i] = 1
        bx0 = Math.min(bx0, c.x0)
        by0 = Math.min(by0, c.y0)
        bx1 = Math.max(bx1, c.x1)
        by1 = Math.max(by1, c.y1)
        changed = true
      }
    })
  }
  const pad = Math.max(10, (bx1 - bx0) * 0.08)
  comps.forEach((c, i) => {
    if (!keep[i] && !isNoise[i] && c.area >= Math.max(10, comps[largest].area * 0.004) && c.x0 >= bx0 - pad && c.x1 <= bx1 + pad && c.y0 >= by0 - pad && c.y1 <= by1 + pad) keep[i] = 1
  })
  const removed = comps.length - keep.reduce((a, b) => a + b, 0)

  // 4. Image finale : encre gardée, plus foncée et plus opaque ; bords doux conservés près de l'encre gardée.
  const margin = Math.round(Math.max(bx1 - bx0, by1 - by0) * 0.04) + 6
  const cx0 = Math.max(0, bx0 - margin)
  const cy0 = Math.max(0, by0 - margin)
  const cx1 = Math.min(W - 1, bx1 + margin)
  const cy1 = Math.min(H - 1, by1 + margin)
  const out = blankCanvas(cx1 - cx0 + 1, cy1 - cy0 + 1)
  const octx = out.getContext('2d')!
  const img = octx.createImageData(out.width, out.height)
  const o = img.data
  const keptNear = (x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const l = labels[ny * W + nx]
        if (l >= 0 && keep[l]) return true
      }
    }
    return false
  }
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      const p = y * W + x
      const a = alpha[p]
      if (a === 0) continue
      const l = labels[p]
      if (l >= 0 ? !keep[l] : !keptNear(x, y)) continue
      const i = p * 4
      const j = ((y - cy0) * out.width + (x - cx0)) * 4
      // Encre foncée et franche : la teinte (noir, bleu, rouge du tampon) est conservée.
      o[j] = px[i] * 0.55
      o[j + 1] = px[i + 1] * 0.55
      o[j + 2] = px[i + 2] * 0.55
      o[j + 3] = Math.min(255, a * 1.35)
    }
  }
  octx.putImageData(img, 0, 0)
  // Traits fins : épaissis d'un pixel, pour rester lisibles une fois la signature réduite sur le document.
  if (out.width > 500) {
    const copy = blankCanvas(out.width, out.height)
    copy.getContext('2d')!.drawImage(out, 0, 0)
    octx.globalCompositeOperation = 'destination-over'
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) octx.drawImage(copy, dx, dy)
    octx.globalCompositeOperation = 'source-over'
  }
  return { image: out, inkWidth: bx1 - bx0 + 1, removed }
}

/** Rectangle de recadrage, en fractions de l'image (0 à 1). */
export interface Crop {
  x: number
  y: number
  w: number
  h: number
}

export const FULL_CROP: Crop = { x: 0, y: 0, w: 1, h: 1 }

/** Recadre l'image nettoyée, resserre autour de l'encre restante et exporte en PNG (1 200 px de large au plus). */
export async function exportSignature(image: HTMLCanvasElement, crop: Crop = FULL_CROP): Promise<Blob> {
  const x = Math.round(crop.x * image.width)
  const y = Math.round(crop.y * image.height)
  const w = Math.max(1, Math.round(crop.w * image.width))
  const h = Math.max(1, Math.round(crop.h * image.height))
  const data = image.getContext('2d')!.getImageData(x, y, w, h).data
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (data[(yy * w + xx) * 4 + 3] > 40) {
        if (xx < minX) minX = xx
        if (xx > maxX) maxX = xx
        if (yy < minY) minY = yy
        if (yy > maxY) maxY = yy
      }
    }
  }
  if (maxX < 0) throw new SignatureImportError('Le cadre ne contient plus de signature. Agrandissez-le.')
  const m = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03) + 4
  const sx = x + Math.max(0, minX - m)
  const sy = y + Math.max(0, minY - m)
  const sw = Math.min(x + w, x + maxX + m + 1) - sx
  const sh = Math.min(y + h, y + maxY + m + 1) - sy
  const scale = Math.min(1, MAX_OUTPUT_WIDTH / sw)
  const out = blankCanvas(sw * scale, sh * scale)
  const context = out.getContext('2d')!
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, sx, sy, sw, sh, 0, 0, out.width, out.height)
  return await new Promise<Blob>((resolve, reject) =>
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new SignatureImportError('La signature n’a pas pu être préparée.'))), 'image/png')
  )
}

export const SIGNATURE_ACCEPT = 'application/pdf,.pdf,image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif'
