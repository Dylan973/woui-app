import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { SignatureCanvas, type SignatureCanvasHandle } from '../signature/SignatureCanvas'
import { dataUrlToBlob, documentUrl, imageToPng, saveProfileSignature } from '../../lib/documents'
import type { Profile } from '../../types'

interface PractitionerSignatureProps {
  doctorId: string
  profile: Profile
  /** Appelé après un enregistrement ou un retrait réussi. */
  onSaved: (message: string) => Promise<void> | void
  /** Affichage compact (fenêtre de bienvenue) : pas d'aperçu de la signature actuelle. */
  compact?: boolean
}

/** Signature ou tampon du praticien : à dessiner ou à importer (image). Ajouté aux documents signés. */
export function PractitionerSignature({ doctorId, profile, onSaved, compact = false }: PractitionerSignatureProps) {
  const canvasRef = useRef<SignatureCanvasHandle>(null)
  const [drawing, setDrawing] = useState(compact)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setCurrentUrl(null)
    if (profile.signature_path) void documentUrl(profile.signature_path).then((url) => !cancelled && setCurrentUrl(url))
    return () => {
      cancelled = true
    }
  }, [profile.signature_path])

  const save = async (image: Blob | null, message: string) => {
    setBusy(true)
    setError(null)
    const result = await saveProfileSignature(doctorId, profile, image)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setDrawing(false)
    await onSaved(message)
  }

  const saveDrawing = async () => {
    const dataUrl = canvasRef.current?.getDataUrl()
    if (!dataUrl) {
      setError('Tracez votre signature dans le cadre avant d’enregistrer.')
      return
    }
    await save(await dataUrlToBlob(dataUrl), 'Signature enregistrée')
  }

  const importImage = async (file: File) => {
    try {
      await save(await imageToPng(file), 'Signature enregistrée')
    } catch {
      setError('Cette image ne peut pas être lue. Essayez un fichier PNG ou JPG.')
    }
  }

  const importButton = (
    <label
      className="cursor-pointer rounded-[3px] px-5 py-[10px] text-[0.9375rem] font-semibold"
      style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)', opacity: busy ? 0.5 : 1 }}
    >
      Importer une image
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importImage(file)
          e.target.value = ''
        }}
      />
    </label>
  )

  return (
    <div>
      {!compact && profile.signature_path && !drawing && (
        <div
          className="mb-4 flex h-[120px] max-w-[340px] items-center justify-center p-3"
          style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
        >
          {currentUrl ? <img src={currentUrl} alt="Votre signature enregistrée" className="max-h-full max-w-full object-contain" /> : null}
        </div>
      )}

      {drawing ? (
        <>
          <div className="max-w-[460px]">
            <SignatureCanvas ref={canvasRef} disabled={busy} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={saveDrawing} disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer la signature'}
            </Button>
            <Button variant="ghost" onClick={() => canvasRef.current?.clear()} disabled={busy}>
              Effacer
            </Button>
            {importButton}
            {!compact && (
              <button
                type="button"
                onClick={() => setDrawing(false)}
                className="cursor-pointer text-[13px]"
                style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
              >
                Annuler
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => setDrawing(true)} disabled={busy}>
            {profile.signature_path ? 'Redessiner' : 'Dessiner ma signature'}
          </Button>
          {importButton}
          {profile.signature_path && (
            <button
              type="button"
              onClick={() => save(null, 'Signature retirée')}
              disabled={busy}
              className="cursor-pointer text-[13px]"
              style={{ background: 'none', border: 0, color: 'var(--danger-text)' }}
            >
              Retirer
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--danger-text)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
