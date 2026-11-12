import { useCallback, useEffect, useState, type ReactNode } from 'react'

export type PinStepKey = 'current' | 'new' | 'confirm'

interface PinDialogProps {
  /** Étapes à saisir, dans l'ordre (ex. ancien code, nouveau code, confirmation). */
  steps: { key: PinStepKey; title: string; hint?: string }[]
  /** Appelé avec les codes saisis. Renvoie un message d'erreur, ou null si tout est bon. */
  onComplete: (values: Partial<Record<PinStepKey, string>>) => Promise<string | null>
  onClose: () => void
  /** Contenu sous le clavier (ex. « Code oublié ? »). */
  footer?: ReactNode
  avatar?: ReactNode
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** Saisie d'un code à 4 chiffres : clavier à l'écran ou clavier physique. */
export function PinDialog({ steps, onComplete, onClose, footer, avatar }: PinDialogProps) {
  const [index, setIndex] = useState(0)
  const [digits, setDigits] = useState('')
  const [values, setValues] = useState<Partial<Record<PinStepKey, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const step = steps[index]

  const fail = useCallback((message: string, backTo: number) => {
    setError(message)
    setShake((n) => n + 1)
    setDigits('')
    setIndex(backTo)
  }, [])

  const submit = useCallback(
    async (code: string) => {
      const next = { ...values, [step.key]: code }
      if (step.key === 'confirm' && next.new !== code) {
        setValues({ current: next.current })
        fail('Les deux codes ne correspondent pas. Recommencez.', steps.findIndex((s) => s.key === 'new'))
        return
      }
      if (index < steps.length - 1) {
        setValues(next)
        setDigits('')
        setError(null)
        setIndex(index + 1)
        return
      }
      setBusy(true)
      const message = await onComplete(next)
      setBusy(false)
      if (message) {
        setValues({})
        fail(message, 0)
      }
    },
    [values, step, index, steps, onComplete, fail]
  )

  const press = useCallback(
    (digit: string) => {
      if (busy || digits.length >= 4) return
      const code = digits + digit
      setDigits(code)
      setError(null)
      // Laisse le 4e point s'afficher avant de passer à la suite.
      if (code.length === 4) window.setTimeout(() => void submit(code), 180)
    },
    [busy, digits, submit]
  )
  const erase = useCallback(() => !busy && setDigits((d) => d.slice(0, -1)), [busy])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) press(event.key)
      else if (event.key === 'Backspace') erase()
      else if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, erase, onClose])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-5"
      style={{ background: 'var(--surface-overlay)', backdropFilter: 'blur(10px)', zIndex: 600 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
    >
      <div
        className="pin-card w-full max-w-[340px] px-7 pb-6 pt-8 text-center"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {avatar && <div className="mb-4 flex justify-center">{avatar}</div>}
        <div key={index} className="pin-step">
          <h2 className="font-display text-[20px]" style={{ color: 'var(--text-primary)' }}>
            {step.title}
          </h2>
          <p className="mt-1 min-h-[20px] text-[13px]" style={{ color: error ? 'var(--danger-text)' : 'var(--text-muted)' }} aria-live="polite">
            {error ?? step.hint ?? 'Code à 4 chiffres'}
          </p>
        </div>

        <div key={`dots-${shake}`} className={`my-6 flex justify-center gap-4 ${shake ? 'pin-shake' : ''}`} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="pin-dot h-[14px] w-[14px] rounded-full"
              data-filled={i < digits.length}
              style={{
                background: i < digits.length ? 'var(--accent)' : 'transparent',
                border: `2px solid ${i < digits.length ? 'var(--accent)' : 'var(--border-default)'}`,
              }}
            />
          ))}
        </div>

        <div className="mx-auto grid max-w-[250px] grid-cols-3 gap-[10px]" style={{ opacity: busy ? 0.5 : 1 }}>
          {KEYS.map((key) => (
            <PinKey key={key} label={key} onPress={() => press(key)} />
          ))}
          <span />
          <PinKey label="0" onPress={() => press('0')} />
          <PinKey label="⌫" ariaLabel="Effacer" onPress={erase} />
        </div>

        <div className="mt-5 flex flex-col items-center gap-2">
          {footer}
          <button type="button" onClick={onClose} className="cursor-pointer text-[13px]" style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

function PinKey({ label, ariaLabel, onPress }: { label: string; ariaLabel?: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={ariaLabel ?? label}
      className="pin-key h-[58px] cursor-pointer rounded-[14px] text-[22px]"
      style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
    >
      {label}
    </button>
  )
}
