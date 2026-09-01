import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { VideoPlayer } from '../components/signature/VideoPlayer'
import { SignatureCanvas, type SignatureCanvasHandle } from '../components/signature/SignatureCanvas'
import { Spinner } from '../components/ui/Spinner'
import { WOUI_LOGO_URL } from '../lib/constants'
import type { Consent } from '../types'

type LoadState = 'loading' | 'not-found' | 'ready'

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
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#050a14' }}>
        <Spinner />
      </div>
    )
  }

  if (state === 'not-found' || !consent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: '#050a14', color: '#e2e8f0' }}>
        <div className="text-5xl">🔗</div>
        <h1 className="font-display text-xl">Lien invalide ou expiré</h1>
        <p className="max-w-sm text-sm" style={{ color: '#64748b' }}>
          Ce lien de consentement n'existe pas ou a déjà été utilisé. Contactez votre praticien pour obtenir un nouveau lien.
        </p>
      </div>
    )
  }

  const videoUnlocked = consent.video_progress >= 90 || consent.status === 'viewed' || consent.status === 'signed'
  const alreadySigned = consent.status === 'signed'

  return (
    <div className="min-h-screen p-4 sm:p-8" style={{ background: '#050a14', color: '#e2e8f0' }}>
      <div className="mx-auto max-w-[640px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src={WOUI_LOGO_URL} alt="Woui" className="h-11 w-11 rounded-xl" />
          <h1 className="font-display text-[1.4rem]" style={{ color: '#f1f5f9' }}>
            Espace Patient Sécurisé
          </h1>
        </div>

        {alreadySigned ? (
          <div className="rounded-[20px] p-10 text-center" style={{ background: '#0f172a', border: '1px solid #10b981' }}>
            <div className="mb-4 text-5xl">✅</div>
            <h2 className="font-display mb-2 text-xl" style={{ color: '#f1f5f9' }}>
              Votre consentement a bien été enregistré
            </h2>
            <p className="text-sm" style={{ color: '#64748b' }}>
              Signé le {new Date(consent.signed_at!).toLocaleDateString('fr-FR')} à{' '}
              {new Date(consent.signed_at!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Une copie du
              document vous sera transmise par email.
            </p>
          </div>
        ) : (
          <>
            {/* Section 1 — informations */}
            <div className="mb-5 rounded-[18px] p-6" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
              <div className="mb-3 text-[0.72rem] uppercase tracking-wide" style={{ color: '#475569' }}>
                Informations
              </div>
              <div className="grid grid-cols-2 gap-3 text-[0.86rem]">
                <div>
                  <div style={{ color: '#475569' }}>Patient</div>
                  <div style={{ color: '#e2e8f0' }}>{consent.patient}</div>
                </div>
                <div>
                  <div style={{ color: '#475569' }}>Acte médical</div>
                  <div style={{ color: '#e2e8f0' }}>{consent.procedure}</div>
                </div>
              </div>
            </div>

            {/* Section 2 — vidéo */}
            <div className="mb-5 rounded-[18px] p-6" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
              <div className="mb-3 text-[0.72rem] uppercase tracking-wide" style={{ color: '#475569' }}>
                Vidéo d'information
              </div>
              <VideoPlayer onProgress={handleVideoProgress} onViewed={handleVideoViewed} alreadyViewed={videoUnlocked} />
            </div>

            {/* Section 3 — signature */}
            <div className="rounded-[18px] p-6" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
              <div className="mb-3 text-[0.72rem] uppercase tracking-wide" style={{ color: '#475569' }}>
                Signature électronique
              </div>
              <SignatureCanvas ref={signatureRef} disabled={!videoUnlocked} />

              <label className="mt-4 flex items-center gap-2 text-[0.82rem]" style={{ color: videoUnlocked ? '#94a3b8' : '#334155' }}>
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  disabled={!videoUnlocked}
                />
                Je confirme avoir visionné la vidéo et compris les informations transmises.
              </label>

              {signError && (
                <div className="mt-3 rounded-lg p-3 text-[0.8rem]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.18)' }}>
                  {signError}
                </div>
              )}

              <button
                onClick={handleSign}
                disabled={!videoUnlocked || !confirmChecked || signing}
                className="mt-4 w-full cursor-pointer rounded-[10px] py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', border: 'none' }}
              >
                {signing ? 'Enregistrement...' : 'Signer le consentement'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
