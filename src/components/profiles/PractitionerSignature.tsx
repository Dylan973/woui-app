import { useEffect, useState } from 'react'
import { documentUrl, saveProfileSignature } from '../../lib/documents'
import { loadSignature, SIGNATURE_ACCEPT, SignatureImportError } from '../../lib/signatureImport'
import { SignatureDocPreview, SignatureEditor } from './SignatureEditor'
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
      <li>Sur une feuille A4 blanche, apposez votre tampon puis signez par-dessus, au stylo noir ou bleu foncé : tampon et signature ne forment qu’un seul bloc.</li>
      <li>Scannez la feuille ou prenez-la en photo bien à plat, à la lumière du jour, sans ombre.</li>
      <li>Importez le fichier : Woui retire le fond et les traces du scan, et recadre automatiquement. Vérifiez l’aperçu, puis enregistrez.</li>
    </ol>
  )
}

/** Signature et tampon du praticien, importés depuis un scan ou une photo. Ajoutés aux documents signés. */
export function PractitionerSignature({ doctorId, profile, onSaved, compact = false }: PractitionerSignatureProps) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [source, setSource] = useState<HTMLCanvasElement | null>(null)
  const [busy, setBusy] = useState<'reading' | 'saving' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCurrentUrl(null)
    if (profile.signature_path) void documentUrl(profile.signature_path).then((url) => !cancelled && setCurrentUrl(url))
    return () => {
      cancelled = true
    }
  }, [profile.signature_path])

  const read = async (file: File) => {
    setBusy('reading')
    setError(null)
    try {
      setSource(await loadSignature(file))
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
    setSource(null)
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

  const dropZone = (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file && busy === null) void read(file)
      }}
      className="flex max-w-[560px] cursor-pointer flex-col items-center justify-center gap-2 px-6 py-8 text-center"
      style={{
        background: dragOver ? 'var(--surface-card-alt)' : 'var(--surface-card)',
        border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--border-default)'}`,
        borderRadius: 6,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" style={{ color: 'var(--text-accent)' }}>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
      <span className="text-[0.9375rem] font-semibold" style={{ color: 'var(--text-primary)' }}>
        {busy === 'reading' ? 'Lecture du fichier…' : 'Déposez votre scan ici, ou cliquez pour le choisir'}
      </span>
      <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
        PDF, JPG, PNG ou HEIC · 15 Mo au plus
      </span>
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

  return (
    <div>
      {!source && <SignatureHowTo />}

      {source ? (
        <>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <div className="text-[0.9375rem] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Vérifiez votre signature et votre tampon
            </div>
            {pickButton('Changer de fichier')}
          </div>
          <SignatureEditor
            source={source}
            busy={busy === 'saving'}
            onCancel={() => setSource(null)}
            onConfirm={(image) => save(image, 'Signature et tampon enregistrés')}
          />
        </>
      ) : profile.signature_path && !compact ? (
        <div className="flex flex-wrap items-end gap-6">
          <SignatureDocPreview>
            {currentUrl && <img src={currentUrl} alt="Votre signature et votre tampon enregistrés" className="max-h-full max-w-full object-contain" />}
          </SignatureDocPreview>
          <div className="flex flex-wrap items-center gap-4 pb-1">
            {pickButton('Remplacer')}
            <button
              type="button"
              onClick={() => save(null, 'Signature et tampon retirés')}
              disabled={busy !== null}
              className="cursor-pointer text-[13px]"
              style={{ background: 'none', border: 0, color: 'var(--danger-text)' }}
            >
              Retirer
            </button>
          </div>
        </div>
      ) : (
        dropZone
      )}

      {error && (
        <p className="mt-3 max-w-[560px] text-[13px]" style={{ color: 'var(--danger-text)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
