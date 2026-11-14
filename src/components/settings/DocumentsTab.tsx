import { useState } from 'react'
import { PractitionerSignature } from '../profiles/PractitionerSignature'
import { useConsentTemplates } from '../../hooks/useConsentTemplates'
import { documentUrl } from '../../lib/documents'
import { PROCEDURES } from '../../lib/constants'
import { profileName } from '../../lib/profiles'
import type { ConsentTemplate, Profile } from '../../types'
import type { ToastType } from '../ui/Toast'

interface DocumentsTabProps {
  doctorId: string
  activeProfile: Profile
  onSignatureSaved: (message: string) => Promise<void>
  showToast: (msg: string, type?: ToastType) => void
  /** Gestion du cabinet : pas de signature (chaque praticien signe depuis son profil). */
  withSignature?: boolean
  /** Modèles PDF (consentements, conseils post-opératoires) : profils praticiens uniquement. */
  withTemplates?: boolean
}

const CARD = { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }

/** Paramètres > Documents PDF : signature et tampon du praticien, modèles du cabinet (consentements, conseils post-opératoires). */
export function DocumentsTab({ doctorId, activeProfile, onSignatureSaved, showToast, withSignature = true, withTemplates = true }: DocumentsTabProps) {
  const { templates, loading, saveTemplate, removeTemplate } = useConsentTemplates(doctorId)
  const [busy, setBusy] = useState<string | null>(null)

  const upload = async (procedure: string, file: File, category: ConsentTemplate['category']) => {
    setBusy(`${category}:${procedure}`)
    const { error } = await saveTemplate(procedure, file, category)
    setBusy(null)
    showToast(
      error ?? `${category === 'postop' ? 'Conseils post-opératoires enregistrés' : 'Formulaire enregistré'} pour « ${procedure} »`,
      error ? 'warning' : 'success'
    )
  }

  const open = async (path: string) => {
    const url = await documentUrl(path)
    if (url) window.open(url, '_blank', 'noopener')
    else showToast('Le document est momentanément indisponible.', 'warning')
  }

  return (
    <div className="flex flex-col gap-[22px]" style={{ animation: 'nb-rise 0.35s var(--ease-standard) both' }}>
      {withSignature && (
      <div className="p-[clamp(1.5rem,4vw,36px)]" style={CARD}>
        <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
          Votre signature et votre tampon
        </h2>
        <p className="mb-6 mt-[6px] max-w-[640px] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
          Obligatoires, ils sont ajoutés automatiquement, à côté de la signature du patient, sur chaque consentement et chaque devis signé envoyé par le
          profil « {profileName(activeProfile)} ».
        </p>
        <PractitionerSignature doctorId={doctorId} profile={activeProfile} onSaved={onSignatureSaved} />
      </div>
      )}

      {withTemplates && (['consent', 'postop'] as const).map((category) => (
        <div key={category} className="p-[clamp(1.5rem,4vw,36px)]" style={CARD}>
          <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
            {category === 'consent' ? 'Vos formulaires de consentement' : 'Vos conseils post-opératoires'}
          </h2>
          <p className="mb-6 mt-[6px] max-w-[640px] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            {category === 'consent'
              ? 'Déposez le formulaire de votre cabinet (PDF) pour chaque acte. Le patient le lit avant de signer, et le PDF signé reprend votre formulaire suivi de la page de signature. Sans formulaire, le PDF signé contient uniquement la page de signature.'
              : 'Déposez vos consignes (PDF) pour chaque acte. Quand vous cochez « Conseils post-opératoires » dans un envoi, le document de l’acte est joint automatiquement. Le patient le lit et le télécharge, sans rien signer.'}
          </p>
          <ul className="m-0 flex flex-col p-0" style={{ listStyle: 'none' }}>
            {PROCEDURES.map((procedure) => {
              const template = templates.find((t) => (t.category ?? 'consent') === category && t.procedure === procedure)
              const key = `${category}:${procedure}`
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
                      {loading
                        ? '…'
                        : template
                          ? template.file_name
                          : category === 'consent'
                            ? 'Aucun formulaire : page de signature seule'
                            : 'Aucun document : à choisir au moment de l’envoi'}
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
                    style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)', opacity: busy === key ? 0.5 : 1 }}
                  >
                    {busy === key ? 'Envoi…' : template ? 'Remplacer' : 'Importer un PDF'}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      disabled={busy !== null}
                      aria-label={`Importer le PDF pour ${procedure}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void upload(procedure, file, category)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {template && (
                    <button
                      type="button"
                      onClick={async () => {
                        const { error } = await removeTemplate(template.id)
                        showToast(error ?? 'Document retiré', error ? 'warning' : 'success')
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
      ))}
    </div>
  )
}
