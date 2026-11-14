import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { PLANS, PROCEDURES } from '../../lib/constants'
import { useConsentTemplates } from '../../hooks/useConsentTemplates'
import type { NewConsentForm, PlanId, Profile } from '../../types'
import { profileName } from '../../lib/profiles'

type Part = 'withConsent' | 'withQuote' | 'withPostop'

const PARTS: { id: Part; label: string; hint: string }[] = [
  { id: 'withConsent', label: 'Consentement', hint: 'vidéo + signature' },
  { id: 'withQuote', label: 'Devis', hint: 'lecture + signature' },
  { id: 'withPostop', label: 'Conseils post-opératoires', hint: 'PDF à lire' },
]

/** Téléphone : chiffres, espaces, points, tirets, + en tête ; 10 chiffres au moins. */
export function phoneValid(phone: string): boolean {
  return /^\+?[0-9 .()-]{6,24}$/.test(phone.trim()) && phone.replace(/[^0-9]/g, '').length >= 10
}

function todayLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function PdfPicker({ label, file, empty, onPick }: { label: string; file: File | null; empty: string; onPick: (f: File | null) => void }) {
  return (
    <div className="mb-5 flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <label
        className="flex cursor-pointer items-center justify-between gap-3 rounded-[3px] px-[14px] py-3 text-[0.9375rem]"
        style={{ background: 'var(--surface-card-alt)', border: '1px dashed var(--border-default)', color: 'var(--text-primary)' }}
      >
        <span className="truncate">{file ? file.name : empty}</span>
        <span className="flex-none text-[0.8125rem] font-semibold" style={{ color: 'var(--text-accent)' }}>
          {file ? 'Changer' : 'Parcourir'}
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label={label}
          onChange={(e) => {
            onPick(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}

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
  const [form, setForm] = useState<NewConsentForm>({
    patient: '',
    email: '',
    phone: '',
    procedure: PROCEDURES[0],
    withConsent: true,
    withQuote: false,
    withPostop: false,
    appointmentAt: '',
    quoteFile: null,
    postopFile: null,
  })
  const { templates } = useConsentTemplates(doctorId)
  const { withConsent, withQuote, withPostop } = form
  const needsProcedure = withConsent || withPostop
  const hasTemplate = templates.some((t) => (t.category ?? 'consent') === 'consent' && t.procedure === form.procedure)
  const postopTemplate = templates.find((t) => t.category === 'postop' && t.procedure === form.procedure)
  const [senderId, setSenderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof NewConsentForm>(k: K, v: NewConsentForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const atLimit = limit < 999999 && used >= limit
  const appointmentPast = form.appointmentAt !== '' && new Date(form.appointmentAt).getTime() < Date.now()
  const partsChosen = withConsent || withQuote || withPostop
  const valid =
    form.patient.trim() !== '' &&
    form.email.trim() !== '' &&
    phoneValid(form.phone) &&
    partsChosen &&
    !appointmentPast &&
    (!withQuote || form.quoteFile !== null) &&
    (!withPostop || form.postopFile !== null || postopTemplate !== undefined) &&
    !atLimit &&
    !loading
  const togglePart = (part: Part) => setForm((f) => ({ ...f, [part]: !f[part] }))
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
    <Modal onClose={onClose} maxWidth={620}>
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
            Le patient reçoit un seul lien par e-mail. Choisissez ce qu'il contient (plusieurs choix possibles).
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Contenu de l'envoi">
            {PARTS.map((part) => {
              const locked = part.id === 'withQuote' && !quotesEnabled
              const active = form[part.id]
              return (
                <button
                  key={part.id}
                  type="button"
                  role="checkbox"
                  aria-checked={active}
                  disabled={locked}
                  onClick={() => togglePart(part.id)}
                  title={locked ? 'Disponible avec les abonnements Pro et Clinique' : part.hint}
                  className="flex items-center gap-2 rounded-[3px] px-[12px] py-[7px] text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                  style={{
                    background: active ? 'var(--action-primary)' : 'transparent',
                    color: active ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                    border: active ? '1px solid transparent' : '1px solid var(--border-subtle)',
                    cursor: locked ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-[14px] w-[14px] items-center justify-center rounded-[2px] text-[10px]"
                    style={{ border: `1px solid ${active ? 'currentColor' : 'var(--border-default)'}` }}
                  >
                    {active ? '✓' : ''}
                  </span>
                  {part.label}
                </button>
              )
            })}
          </div>
          {!quotesEnabled && (
            <p className="mt-2 text-[12px]" style={{ color: 'var(--text-accent)' }}>
              Devis : abonnements Pro et Clinique
            </p>
          )}
          {!partsChosen && (
            <p className="mt-2 text-[12px]" style={{ color: 'var(--danger-text)' }}>
              Choisissez au moins un document.
            </p>
          )}

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
            <div className="grid gap-x-5 sm:grid-cols-2">
            <Input label="Nom du patient" value={form.patient} onChange={(e) => set('patient', e.target.value)} placeholder="Marie Dupont" />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="patient@email.com"
            />
            <Input
              label="Téléphone du patient"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value.slice(0, 24))}
              placeholder="06 12 34 56 78"
              hint={form.phone !== '' && !phoneValid(form.phone) ? 'Numéro incomplet : 10 chiffres au moins.' : 'Pour le joindre s’il n’a pas reçu le lien.'}
            />
            <Input
              label="Date du rendez-vous (facultatif)"
              type="datetime-local"
              min={`${todayLocal()}T00:00`}
              value={form.appointmentAt}
              onChange={(e) => set('appointmentAt', e.target.value)}
              hint={
                appointmentPast
                  ? 'Cette date est déjà passée.'
                  : 'Alerte 2 jours avant si rien n’est signé.'
              }
            />
            </div>
            {needsProcedure && (
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
              {withConsent && (
                <span className="text-[12.5px]" style={{ color: hasTemplate ? 'var(--status-signed-text)' : 'var(--text-muted)' }}>
                  {hasTemplate
                    ? 'Le formulaire de votre cabinet sera joint.'
                    : 'Aucun formulaire du cabinet pour cet acte (Paramètres > Documents PDF).'}
                </span>
              )}
            </label>
            )}
            {withQuote && (
              <PdfPicker label="Devis (PDF)" file={form.quoteFile} empty="Choisir le PDF exporté de votre logiciel" onPick={(f) => set('quoteFile', f)} />
            )}
            {withPostop && (
              <>
                <PdfPicker
                  label="Conseils post-opératoires (PDF)"
                  file={form.postopFile}
                  empty={postopTemplate ? `Modèle du cabinet : ${postopTemplate.file_name}` : 'Choisir le PDF des conseils post-opératoires'}
                  onPick={(f) => set('postopFile', f)}
                />
                {!form.postopFile && (
                  <p className="-mt-3 mb-5 text-[12.5px]" style={{ color: postopTemplate ? 'var(--status-signed-text)' : 'var(--text-muted)' }}>
                    {postopTemplate
                      ? 'Le modèle de votre cabinet pour cet acte sera joint. Choisissez un PDF pour le remplacer sur cet envoi.'
                      : 'Astuce : déposez un modèle par acte dans Paramètres > Documents PDF pour ne plus avoir à le choisir.'}
                  </p>
                )}
              </>
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
