import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { PLANS, PROCEDURES } from '../../lib/constants'
import type { NewConsentForm, PlanId } from '../../types'

interface SendModalProps {
  onClose: () => void
  onSend: (form: NewConsentForm) => Promise<{ error: string | null }>
  planId: PlanId
  used: number
  limit: number
}

export function SendModal({ onClose, onSend, planId, used, limit }: SendModalProps) {
  const [form, setForm] = useState<NewConsentForm>({ patient: '', email: '', procedure: PROCEDURES[0] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof NewConsentForm>(k: K, v: NewConsentForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const atLimit = limit < 999999 && used >= limit
  const valid = form.patient.trim() !== '' && form.email.trim() !== '' && !atLimit && !loading
  const plan = PLANS.find((p) => p.id === planId)!

  const handleSend = async () => {
    setLoading(true)
    setError(null)
    const { error: sendError } = await onSend(form)
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
            Nouveau consentement
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
          <Button variant="accent" onClick={onClose}>
            Voir les plans
          </Button>
        </div>
      ) : (
        <>
          <p className="my-3 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            Le patient reçoit un lien vers sa vidéo explicative, puis signe en ligne.
          </p>

          <div className="mt-5 flex flex-col gap-1">
            <Input label="Nom du patient" value={form.patient} onChange={(e) => set('patient', e.target.value)} placeholder="Marie Dupont" />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="patient@email.com"
            />
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
            </label>
          </div>

          {error && (
            <div
              className="mb-4 p-3 text-[0.875rem]"
              style={{ background: 'var(--garnet-100)', border: '1px solid var(--garnet-100)', color: 'var(--garnet-700)', borderRadius: 3 }}
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
            <Button variant="accent" size="sm" onClick={handleSend} disabled={!valid} style={{ opacity: valid ? 1 : 0.45 }}>
              {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
