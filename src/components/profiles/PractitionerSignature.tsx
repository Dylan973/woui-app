import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { documentUrl, saveProfileSignature } from '../../lib/documents'
import { prepareSignature, SIGNATURE_ACCEPT, SignatureImportError } from '../../lib/signatureImport'
import type { Profile } from '../../types'

interface PractitionerSignatureProps {
  doctorId: string
  profile: Profile
  /** Appelé après un enregistrement ou un retrait réussi. */
  onSaved: (message: string) => Promise<void> | void
  /** Affichage compact (fenêtre de bienvenue, configuration du cabinet) : pas d'aperçu de la signature actuelle. */
  compact?: boolean
}

/** Mode d'emploi affiché à côté du bouton d'import. */
export function SignatureHowTo() {
  return (
    <ol className="m-0 mb-5 flex max-w-[640px] flex-col gap-[6px] pl-5 text-[0.875rem] leading-[1.55]" style={{ color: 'var(--text-secondary)' }}>
      <li>Sur une feuille A4 blanche, apposez votre tampon et signez juste à côté, au stylo noir ou bleu foncé.</li>
      <li>Scannez la feuille (300 ppp, en PDF ou JPG) ou prenez-la en photo bien à plat, à la lumière du jour, sans ombre.</li>
      <li>Importez le fichier : Woui retire le fond blanc et recadre automatiquement. Vérifiez l’aperçu puis enregistrez.</li>
    </ol>
  )
}

/** Signature et tampon du praticien, importés depuis un scan ou une photo. Ajoutés aux documents signés. */
export function PractitionerSignature({ doctorId, profile, onSaved, compact = false }: PractitionerSignatureProps) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  const [busy, setBusy] = useState<'reading' | 'saving' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setCurrentUrl(null)
    if (profile.signature_path) void documentUrl(profile.signature_path).then((url) => !cancelled && setCurrentUrl(url))
    return () => {
      cancelled = true
    }
  }, [profile.signature_path])

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url)
  }, [preview])

  const read = async (file: File) => {
    setBusy('reading')
    setError(null)
    try {
      const blob = await prepareSignature(file)
      setPreview({ blob, url: URL.createObjectURL(blob) })
    } catch (e) {
      setError(e instanceof SignatureImportError ? e.message : 'Ce fichier ne peut pas être lu. Utilisez un PDF, un PNG ou un JPG.')
    }
    setBusy(null)
  }

  const save = async (image: Blob | null, message: string) => {
    setBusy('saving')
    setError(null)
    const result = await saveProfileSignature(doctorId, profile, image)
    setBusy(null)
    if (result.error) {
      setError(result.error)
      return
    }
    setPreview(null)
    await onSaved(message)
  }

  const pickButton = (label: string, primary = false) => (
    <label
      className="cursor-pointer rounded-[3px] px-5 py-[10px] text-[0.9375rem] font-semibold"
      style={{
        background: primary ? 'var(--action-primary)' : 'transparent',
        color: primary ? 'var(--action-primary-text)' : 'var(--text-secondary)',
        border: primary ? '1px solid transparent' : '1px solid var(--border-default)',
        opacity: busy ? 0.5 : 1,
      }}
    >
      {busy === 'reading' ? 'Lecture du fichier…' : label}
      <input
        type="file"
        accept={SIGNATURE_ACCEPT}
        className="sr-only"
        disabled={busy !== null}
        aria-label="Importer le scan de votre signature et de votre tampon"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void read(file)
          e.target.value = ''
        }}
      />
    </label>
  )

  const frame = (url: string | null, alt: string) => (
    <div
      className="mb-4 flex h-[150px] max-w-[380px] items-center justify-center p-3"
      style={{
        // Damier discret : montre que le fond est bien transparent.
        backgroundColor: '#ffffff',
        backgroundImage: 'linear-gradient(45deg,#f1f1f4 25%,transparent 25%,transparent 75%,#f1f1f4 75%),linear-gradient(45deg,#f1f1f4 25%,transparent 25%,transparent 75%,#f1f1f4 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0,8px 8px',
        border: '1px solid var(--border-subtle)',
        borderRadius: 4,
      }}
    >
      {url ? <img src={url} alt={alt} className="max-h-full max-w-full object-contain" /> : null}
    </div>
  )

  return (
    <div>
      <SignatureHowTo />

      {preview ? (
        <>
          <div className="mb-2 text-[0.875rem] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Aperçu : votre signature et votre tampon tels qu’ils figureront sur les documents
          </div>
          {frame(preview.url, 'Aperçu de la signature et du tampon importés')}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => save(preview.blob, 'Signature et tampon enregistrés')} disabled={busy !== null}>
              {busy === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {pickButton('Choisir un autre fichier')}
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={busy !== null}
              className="cursor-pointer text-[13px]"
              style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
            >
              Annuler
            </button>
          </div>
        </>
      ) : (
        <>
          {!compact && profile.signature_path && frame(currentUrl, 'Votre signature et votre tampon enregistrés')}
          <div className="flex flex-wrap items-center gap-3">
            {pickButton(profile.signature_path ? 'Importer un nouveau scan' : 'Importer le scan (PDF, JPG, PNG)', !profile.signature_path)}
            {profile.signature_path && !compact && (
              <button
                type="button"
                onClick={() => save(null, 'Signature et tampon retirés')}
                disabled={busy !== null}
                className="cursor-pointer text-[13px]"
                style={{ background: 'none', border: 0, color: 'var(--danger-text)' }}
              >
                Retirer
              </button>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="mt-3 max-w-[560px] text-[13px]" style={{ color: 'var(--danger-text)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
