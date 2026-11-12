import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { PLANS, PROCEDURES } from '../../lib/constants'
import { useConsentTemplates } from '../../hooks/useConsentTemplates'
import type { ConsentKind, NewConsentForm, PlanId, Profile } from '../../types'
import { profileName } from '../../lib/profiles'

const KINDS: { id: ConsentKind; label: string }[] = [
  { id: 'consent', label: 'Consentement' },
  { id: 'quote', label: 'Devis' },
  { id: 'both', label: 'Les deux' },
]

interface SendModalProps {
  onClose: () => void
  onSend: (form: NewConsentForm, senderId: string | null) => Promise<{ error: string | null }>
  planId: PlanId
  used: number
  limit: number
  /** Envoi de devis : offres Pro et Clinique. */
  quotesEnabled: boolean
  doctorId: string
  /** Offre Clinique, profil du titulaire : choix du praticien au nom duquel envoyer. */
  senders?: Profile[] | null
}

export function SendModal({ onClose, onSend, planId, used, limit, quotesEnabled, doctorId, senders }: SendModalProps) {
  const navigate = useNavigate()
  const [form, setForm] = useState<NewConsentForm>({ patient: '', email: '', procedure: PROCEDURES[0], kind: 'consent', quoteFile: null })
  const { templates } = useConsentTemplates(doctorId)
  const withConsent = form.kind !== 'quote'
  const withQuote = form.kind !== 'consent'
  const hasTemplate = templates.some((t) => t.procedure === form.procedure)
  const [senderId, setSenderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof NewConsentForm>(k: K, v: NewConsentForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const atLimit = limit < 999999 && used >= limit
  const valid = form.patient.trim() !== '' && form.email.trim() !== '' && (!withQuote || form.quoteFile !== null) && !atLimit && !loading
  const plan = PLANS.find((p) => p.id === planId)!

  const handleSend = async () => {
    setLoading(true)
    setError(null)
    const { error: sendError } = await onSend(form, senderId)
    setLoading(false)
    if (sendError) {
      setError(sendError)
    } else {
      onClose()
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-start justify-between gap-5">
        <div>
          <div
            className="flex items-center gap-[10px] text-[0.8125rem] font-semibold uppercase"
            style={{ color: 'var(--text-accent)', letterSpacing: 'var(--tracking-eyebrow)' }}
          >
            <span className="h-px w-[18px]" style={{ background: 'currentColor' }} />
            Envoi
          </div>
          <h2 className="font-display mt-[14px] text-[26px]" style={{ color: 'var(--text-primary)' }}>
            Nouvel envoi
          </h2>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer text-[22px] leading-none"
          style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
        >
          ×
        </button>
      </div>

      {atLimit ? (
        <div className="p-4 pt-8 text-center">
          <div className="mb-4 text-5xl">🔒</div>
          <div className="mb-2 font-semibold" style={{ color: 'var(--text-accent)' }}>
            Limite atteinte
          </div>
          <div className="mb-6 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            {used}/{limit} consentements utilisés sur le plan {plan.name}.
          </div>
          <Button
            variant="primary"
            onClick={() => {
              onClose()
              navigate('/settings?tab=plan')
            }}
          >
            Voir les plans
          </Button>
        </div>
      ) : (
        <>
          <p className="my-3 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            {form.kind === 'consent'
              ? 'Le patient reçoit un lien vers sa vidéo explicative, puis signe en ligne.'
              : form.kind === 'quote'
                ? 'Le patient reçoit un lien pour lire le devis, le télécharger pour sa mutuelle, puis le signer.'
                : 'Le patient reçoit un seul lien : vidéo, consentement et devis, signés en une fois.'}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-1" role="group" aria-label="Contenu de l'envoi">
            {KINDS.map((kind) => {
              const locked = kind.id !== 'consent' && !quotesEnabled
              const active = form.kind === kind.id
              return (
                <button
                  key={kind.id}
                  type="button"
                  disabled={locked}
                  aria-pressed={active}
                  onClick={() => set('kind', kind.id)}
                  title={locked ? 'Disponible avec les abonnements Pro et Clinique' : undefined}
                  className="rounded-[3px] px-[14px] py-[7px] text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                  style={{
                    background: active ? 'var(--action-primary)' : 'transparent',
                    color: active ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                    border: active ? '1px solid transparent' : '1px solid var(--border-subtle)',
                    cursor: locked ? 'not-allowed' : 'pointer',
                  }}
                >
                  {kind.label}
                </button>
              )
            })}
            {!quotesEnabled && (
              <span className="ml-1 text-[12px]" style={{ color: 'var(--text-accent)' }}>
                Devis : abonnements Pro et Clinique
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-1">
            {senders && senders.length > 1 && (
              <label className="mb-5 flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                  Envoyé au nom de
                </span>
                <select
                  value={senderId ?? senders[0].id}
                  onChange={(e) => setSenderId(e.target.value)}
                  className="w-full rounded-[3px] px-[14px] py-3 text-[1.0625rem] outline-none"
                  style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  {senders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {profileName(p)}
                      {p.isMain ? ' (titulaire)' : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                  Sa signature figure sur le PDF et l'envoi apparaît dans son tableau de bord.
                </span>
              </label>
            )}
            <Input label="Nom du patient" value={form.patient} onChange={(e) => set('patient', e.target.value)} placeholder="Marie Dupont" />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="patient@email.com"
            />
            {withConsent && (
            <label className="mb-5 flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                Acte médical
              </span>
              <select
                value={form.procedure}
                onChange={(e) => set('procedure', e.target.value)}
                className="w-full rounded-[3px] px-[14px] py-3 text-[1.0625rem] outline-none"
                style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                {PROCEDURES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <span className="text-[12.5px]" style={{ color: hasTemplate ? 'var(--status-signed-text)' : 'var(--text-muted)' }}>
                {hasTemplate
                  ? 'Le formulaire de votre cabinet sera joint.'
                  : 'Aucun formulaire du cabinet pour cet acte (Paramètres > Documents PDF).'}
              </span>
            </label>
            )}
            {withQuote && (
              <div className="mb-5 flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                  Devis (PDF)
                </span>
                <label
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-[3px] px-[14px] py-3 text-[0.9375rem]"
                  style={{ background: 'var(--surface-card-alt)', border: '1px dashed var(--border-default)', color: 'var(--text-primary)' }}
                >
                  <span className="truncate">{form.quoteFile ? form.quoteFile.name : 'Choisir le PDF exporté de votre logiciel'}</span>
                  <span className="flex-none text-[0.8125rem] font-semibold" style={{ color: 'var(--text-accent)' }}>
                    {form.quoteFile ? 'Changer' : 'Parcourir'}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    aria-label="Devis au format PDF"
                    onChange={(e) => {
                      set('quoteFile', e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {error && (
            <div
              className="mb-4 p-3 text-[0.875rem]"
              style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 3 }}
            >
              {error}
            </div>
          )}

          <div className="mt-3 flex items-center gap-[14px] pt-[22px]" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span className="font-mono mr-auto text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {used} / {limit >= 999999 ? '∞' : limit} consentements ce mois
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="primary" size="sm" onClick={handleSend} disabled={!valid} style={{ opacity: valid ? 1 : 0.45 }}>
              {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
