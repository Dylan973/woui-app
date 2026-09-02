import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { VideoPlayer } from '../components/signature/VideoPlayer'
import { SignatureCanvas, type SignatureCanvasHandle } from '../components/signature/SignatureCanvas'
import { Spinner } from '../components/ui/Spinner'
import { WOUI_LOGO_URL } from '../lib/constants'
import type { Consent } from '../types'

type LoadState = 'loading' | 'not-found' | 'ready'

function StepNumber({ n }: { n: number }) {
  return (
    <span
      className="font-mono flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[13px]"
      style={{ background: 'var(--action-primary)', color: 'var(--action-primary-text)' }}
    >
      {n}
    </span>
  )
}

export function SignaturePage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<LoadState>('loading')
  const [consent, setConsent] = useState<Consent | null>(null)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const signatureRef = useRef<SignatureCanvasHandle>(null)

  useEffect(() => {
    if (!token) {
      setState('not-found')
      return
    }

    let cancelled = false

    async function load() {
      const { data, error } = await supabase.from('consents').select('*').eq('token', token).maybeSingle()
      if (cancelled) return

      if (error || !data) {
        setState('not-found')
        return
      }

      const row = data as Consent
      setConsent(row)
      setState('ready')

      // Première ouverture du lien -> statut "opened".
      if (row.status === 'sent') {
        const { data: updated } = await supabase
          .from('consents')
          .update({ status: 'opened', opened_at: new Date().toISOString() })
          .eq('token', token)
          .select()
          .single()
        if (!cancelled && updated) setConsent(updated as Consent)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleVideoProgress = async (pct: number) => {
    if (!token) return
    const { data } = await supabase.from('consents').update({ video_progress: pct }).eq('token', token).select().single()
    if (data) setConsent(data as Consent)
  }

  const handleVideoViewed = async () => {
    if (!token) return
    const { data } = await supabase
      .from('consents')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('token', token)
      .select()
      .single()
    if (data) setConsent(data as Consent)
  }

  const handleSign = async () => {
    if (!token || !confirmChecked) return
    const dataUrl = signatureRef.current?.getDataUrl()
    if (!dataUrl) {
      setSignError('Veuillez signer dans le cadre prévu avant de valider.')
      return
    }
    setSigning(true)
    setSignError(null)
    const { data, error } = await supabase
      .from('consents')
      .update({ status: 'signed', signed_at: new Date().toISOString(), signature_data: dataUrl })
      .eq('token', token)
      .select()
      .single()
    setSigning(false)
    if (error) {
      setSignError("Erreur lors de l'enregistrement de la signature. Réessayez.")
      return
    }
    setConsent(data as Consent)
  }

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--surface-page)' }}>
        <Spinner />
      </div>
    )
  }

  if (state === 'not-found' || !consent) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
        style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
      >
        <div className="text-5xl">🔗</div>
        <h1 className="font-display text-xl">Lien invalide ou expiré</h1>
        <p className="max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ce lien de consentement n'existe pas ou a déjà été utilisé. Contactez votre praticien pour obtenir un nouveau lien.
        </p>
      </div>
    )
  }

  const videoUnlocked = consent.video_progress >= 90 || consent.status === 'viewed' || consent.status === 'signed'
  const alreadySigned = consent.status === 'signed'

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}>
      <header
        className="flex items-center justify-center gap-[11px] py-6"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-[3px] p-[6px]" style={{ background: 'var(--action-accent)' }}>
          <img src={WOUI_LOGO_URL} alt="Woui" className="h-full w-full object-contain" />
        </div>
        <span className="text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
          Espace Patient Sécurisé
        </span>
      </header>

      <div className="mx-auto max-w-[680px] p-[48px_24px]">
        {alreadySigned ? (
          <div
            className="p-[64px_32px] text-center"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
          >
            <div
              className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full"
              style={{ background: 'var(--surface-card-alt)' }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--action-accent)" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h2 className="font-display text-[1.75rem]" style={{ color: 'var(--text-primary)' }}>
              Consentement enregistré
            </h2>
            <p className="mx-auto mt-3 max-w-[42ch] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
              Signé le {new Date(consent.signed_at!).toLocaleDateString('fr-FR')} à{' '}
              {new Date(consent.signed_at!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Une copie du
              document vous sera transmise par email.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {/* Étape 1 — informations */}
            <div className="flex gap-4">
              <StepNumber n={1} />
              <div
                className="flex-1 p-6"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
              >
                <div className="font-mono mb-3 text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                  Informations
                </div>
                <div className="grid grid-cols-2 gap-4 text-[0.9375rem]">
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Patient</div>
                    <div style={{ color: 'var(--text-primary)' }}>{consent.patient}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Acte médical</div>
                    <div style={{ color: 'var(--text-primary)' }}>{consent.procedure}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Étape 2 — vidéo */}
            <div className="flex gap-4">
              <StepNumber n={2} />
              <div
                className="flex-1 p-6"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
              >
                <div className="font-mono mb-3 text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                  Vidéo d'information
                </div>
                <VideoPlayer onProgress={handleVideoProgress} onViewed={handleVideoViewed} alreadyViewed={videoUnlocked} />
              </div>
            </div>

            {/* Étape 3 — signature */}
            <div className="flex gap-4">
              <StepNumber n={3} />
              <div
                className="flex-1 p-6"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
              >
                <div className="font-mono mb-3 text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                  Signature électronique
                </div>
                <SignatureCanvas ref={signatureRef} disabled={!videoUnlocked} />

                <label
                  className="mt-4 flex items-center gap-2 text-[0.9375rem]"
                  style={{ color: videoUnlocked ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                >
                  <input
                    type="checkbox"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    disabled={!videoUnlocked}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Je confirme avoir visionné la vidéo et compris les informations transmises.
                </label>

                {signError && (
                  <div
                    className="mt-3 p-3 text-[0.875rem]"
                    style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 3 }}
                  >
                    {signError}
                  </div>
                )}

                <button
                  onClick={handleSign}
                  disabled={!videoUnlocked || !confirmChecked || signing}
                  className="mt-4 w-full cursor-pointer py-4 text-[1rem] font-semibold disabled:cursor-not-allowed"
                  style={{
                    borderRadius: 3,
                    border: 'none',
                    background: !videoUnlocked || !confirmChecked || signing ? 'var(--border-default)' : 'var(--action-primary)',
                    color: !videoUnlocked || !confirmChecked || signing ? 'var(--text-muted)' : 'var(--action-primary-text)',
                  }}
                >
                  {signing ? 'Enregistrement...' : 'Signer le consentement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
