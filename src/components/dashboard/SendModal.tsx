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
      <div className="mb-[1.4rem] flex justify-between">
        <h3 className="font-display text-[1.2rem]" style={{ color: 'var(--text-main)' }}>
          Nouveau consentement
        </h3>
        <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-[22px] leading-none" style={{ color: 'var(--text-muted)' }}>
          ×
        </button>
      </div>

      {atLimit ? (
        <div className="p-4 text-center">
          <div className="mb-4 text-5xl">🔒</div>
          <div className="mb-2 font-semibold text-[#f59e0b]">Limite atteinte</div>
          <div className="mb-6 text-[0.88rem]" style={{ color: 'var(--text-muted)' }}>
            {used}/{limit} consentements utilisés sur le plan {plan.name}.
          </div>
          <Button onClick={onClose}>⬆ Voir les plans</Button>
        </div>
      ) : (
        <>
          <Input label="Nom du patient *" value={form.patient} onChange={(e) => set('patient', e.target.value)} placeholder="Marie Dupont" />
          <Input
            label="Email *"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="patient@email.com"
          />
          <div className="mb-[1.4rem]">
            <label className="mb-[0.35rem] block text-[0.75rem] uppercase tracking-[0.8px]" style={{ color: 'var(--text-muted)' }}>
              Acte médical
            </label>
            <select
              value={form.procedure}
              onChange={(e) => set('procedure', e.target.value)}
              className="w-full rounded-[10px] px-4 py-[0.7rem] text-[0.88rem] outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
            >
              {PROCEDURES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="mb-4 rounded-lg p-3 text-[0.8rem]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.18)' }}>
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button onClick={handleSend} disabled={!valid} className="flex-[2]">
              {loading ? 'Envoi en cours...' : '📤 Envoyer le lien'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
