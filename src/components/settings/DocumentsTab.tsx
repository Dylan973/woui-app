import { useState } from 'react'
import { PractitionerSignature } from '../profiles/PractitionerSignature'
import { useConsentTemplates } from '../../hooks/useConsentTemplates'
import { documentUrl } from '../../lib/documents'
import { PROCEDURES } from '../../lib/constants'
import { profileName } from '../../lib/profiles'
import type { Profile } from '../../types'
import type { ToastType } from '../ui/Toast'

interface DocumentsTabProps {
  doctorId: string
  activeProfile: Profile
  onSignatureSaved: (message: string) => Promise<void>
  showToast: (msg: string, type?: ToastType) => void
}

const CARD = { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }

/** Paramètres > Documents PDF : signature ou tampon du praticien, formulaires de consentement du cabinet. */
export function DocumentsTab({ doctorId, activeProfile, onSignatureSaved, showToast }: DocumentsTabProps) {
  const { templates, loading, saveTemplate, removeTemplate } = useConsentTemplates(doctorId)
  const [busy, setBusy] = useState<string | null>(null)

  const upload = async (procedure: string, file: File) => {
    setBusy(procedure)
    const { error } = await saveTemplate(procedure, file)
    setBusy(null)
    showToast(error ?? `Formulaire enregistré pour « ${procedure} »`, error ? 'warning' : 'success')
  }

  const open = async (path: string) => {
    const url = await documentUrl(path)
    if (url) window.open(url, '_blank', 'noopener')
    else showToast('Le document est momentanément indisponible.', 'warning')
  }

  return (
    <div className="flex flex-col gap-[22px]" style={{ animation: 'nb-rise 0.35s var(--ease-standard) both' }}>
      <div className="p-[clamp(1.5rem,4vw,36px)]" style={CARD}>
        <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
          Votre signature ou tampon
        </h2>
        <p className="mb-6 mt-[6px] max-w-[640px] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
          Elle est ajoutée automatiquement, à côté de celle du patient, sur chaque consentement et chaque devis signé envoyé par le profil «{' '}
          {profileName(activeProfile)} ».
        </p>
        <PractitionerSignature doctorId={doctorId} profile={activeProfile} onSaved={onSignatureSaved} />
      </div>

      <div className="p-[clamp(1.5rem,4vw,36px)]" style={CARD}>
        <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
          Vos formulaires de consentement
        </h2>
        <p className="mb-6 mt-[6px] max-w-[640px] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
          Déposez le formulaire de votre cabinet (PDF) pour chaque acte. Le patient le lit avant de signer, et le PDF signé reprend votre formulaire
          suivi de la page de signature. Sans formulaire, le PDF signé contient uniquement la page de signature.
        </p>

        <ul className="m-0 flex flex-col p-0" style={{ listStyle: 'none' }}>
          {PROCEDURES.map((procedure) => {
            const template = templates.find((t) => t.procedure === procedure)
            return (
              <li
                key={procedure}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 py-[14px]"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <div className="min-w-[200px] flex-1">
                  <div className="text-[0.9375rem] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {procedure}
                  </div>
                  <div className="text-[12.5px]" style={{ color: template ? 'var(--status-signed-text)' : 'var(--text-muted)' }}>
                    {loading ? '…' : template ? template.file_name : 'Aucun formulaire : page de signature seule'}
                  </div>
                </div>
                {template && (
                  <button
                    type="button"
                    onClick={() => open(template.file_path)}
                    className="cursor-pointer text-[13px]"
                    style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}
                  >
                    Voir
                  </button>
                )}
                <label
                  className="cursor-pointer rounded-[3px] px-[14px] py-[6px] text-[0.8125rem] font-semibold"
                  style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)', opacity: busy === procedure ? 0.5 : 1 }}
                >
                  {busy === procedure ? 'Envoi…' : template ? 'Remplacer' : 'Importer un PDF'}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    disabled={busy !== null}
                    aria-label={`Importer le formulaire PDF pour ${procedure}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void upload(procedure, file)
                      e.target.value = ''
                    }}
                  />
                </label>
                {template && (
                  <button
                    type="button"
                    onClick={async () => {
                      const { error } = await removeTemplate(template.id)
                      showToast(error ?? 'Formulaire retiré', error ? 'warning' : 'success')
                    }}
                    className="cursor-pointer text-[13px]"
                    style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
                  >
                    Retirer
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
