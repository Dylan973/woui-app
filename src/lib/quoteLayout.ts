// Repère, dans le devis déposé, les cadres « Date et signature du patient » et « Signature du chirurgien-dentiste »
// (modèle de devis conventionnel exporté par LOGOS, JULIE…). Les coordonnées sont celles du PDF (origine en bas à gauche),
// pour que la signature du patient et celle du praticien s'inscrivent directement dans ces cadres.

export interface SignBox {
  x: number
  y: number
  w: number
  h: number
}

export interface QuoteSignBox {
  /** Index de page (0 = première). */
  page: number
  patient: SignBox
  practitioner?: SignBox
}

const PATIENT_LABEL = /signature\s+du\s+patient/i
const PRACTITIONER_LABEL = /signature\s+du\s+(chirurgien[-\s]?dentiste|praticien|dentiste)/i

/** Cadres de signature du devis, ou null si le modèle n'est pas reconnu (la page de signature ajoutée suffit alors). */
export async function findQuoteSignBox(file: File): Promise<QuoteSignBox | null> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise
    try {
      // On part de la dernière page : le cadre de signature est en fin de devis.
      for (let index = pdf.numPages - 1; index >= 0; index--) {
        const page = await pdf.getPage(index + 1)
        if (page.rotate % 360 !== 0) continue
        const [, , pageWidth] = page.view
        const items = (await page.getTextContent()).items as { str: string; transform: number[]; width: number; height: number }[]
        const patientLabel = items.filter((it) => PATIENT_LABEL.test(it.str)).pop()
        if (!patientLabel) continue
        const doctorLabel = items.filter((it) => PRACTITIONER_LABEL.test(it.str)).pop()
        const px = patientLabel.transform[4]
        const py = patientLabel.transform[5]
        const top = py - 6
        const height = Math.max(30, Math.min(top - 24, 80))
        const patientRight = doctorLabel && doctorLabel.transform[4] > px + 80 ? doctorLabel.transform[4] - 24 : Math.min(px + 320, pageWidth - 30)
        const box: QuoteSignBox = {
          page: index,
          patient: { x: px, y: top - height, w: Math.max(80, patientRight - px), h: height },
        }
        if (doctorLabel && doctorLabel.transform[4] > px + 80) {
          const dx = doctorLabel.transform[4]
          const dTop = Math.min(doctorLabel.transform[5], py) - 6
          const dHeight = Math.max(30, Math.min(dTop - 24, 80))
          box.practitioner = { x: dx, y: dTop - dHeight, w: Math.max(80, Math.min(pageWidth - dx - 30, 330)), h: dHeight }
        }
        const round = (b: SignBox) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) })
        return { page: box.page, patient: round(box.patient), ...(box.practitioner ? { practitioner: round(box.practitioner) } : {}) }
      }
      return null
    } finally {
      void pdf.destroy()
    }
  } catch {
    return null
  }
}
