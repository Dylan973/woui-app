import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { VideoPlayer } from '../components/signature/VideoPlayer'
import { SignatureCanvas, type SignatureCanvasHandle } from '../components/signature/SignatureCanvas'
import { WOUI_LOGO_URL } from '../lib/constants'
import type { Consent } from '../types'

type LoadState = 'loading' | 'not-found' | 'ready'
type Theme = 'light' | 'dark'

const THEME_KEY = 'woui_patient_theme'
const MINT = '#11b184'
const MINT_HOVER = '#0d8f6b'

/** VideoPlayer déclenche onViewed à 90% ; la signature, elle, n'ouvre qu'à 97%. */
const UNLOCK_AT = 97

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
}

function formatRemaining(seconds: number): string {
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} min`
  return `${Math.max(1, Math.ceil(seconds))} s`
}

function PatientHeader({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <header className="mx-auto flex max-w-[680px] flex-wrap items-center justify-between gap-4 pb-[22px] pt-5">
      {/* TODO wordmarks : déposer /public/woui-wordmark.png (thème clair) et
          /public/woui-wordmark-white.png (thème sombre), puis remplacer ce bloc
          par deux <img> conditionnels de 18px de haut. En attendant, la marque
          blanche existante est posée sur un carré menthe pour rester lisible
          sur les deux fonds. */}
      <div className="flex items-center gap-2">
        <span
          className="flex items-center justify-center"
          style={{ width: 22, height: 22, borderRadius: 6, background: MINT, padding: 4 }}
        >
          <img src={WOUI_LOGO_URL} alt="" className="h-full w-full object-contain" />
        </span>
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Woui</span>
      </div>

      <div className="flex items-center gap-2.5">
        <span
          className="inline-flex items-center gap-1.5"
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            background: 'var(--mint-soft)',
            color: 'var(--mint-ink)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={MINT} strokeWidth="2" aria-hidden="true">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          Espace patient sécurisé
        </span>

        <button
          type="button"
          onClick={onToggle}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          title={theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'}
          className="flex cursor-pointer items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: 'var(--card)',
            border: `1px solid ${hover ? MINT : 'var(--line-2)'}`,
            color: hover ? MINT : 'var(--ink-2)',
            transition: 'border-color .2s, color .2s',
          }}
        >
          {theme === 'light' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9 6.3 6.3M17.7 17.7l1.4 1.4M19.1 4.9 17.7 6.3M6.3 17.7l-1.4 1.4" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  )
}

function StepHeading({ n, children }: { n: number; children: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex items-center justify-center"
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          background: 'var(--mint-soft)',
          color: 'var(--mint-ink)',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {n}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {children}
      </span>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4, color: 'var(--ink)' }}>{value}</div>
    </div>
  )
}

function Card({ children, padding = 24 }: { children: React.ReactNode; padding?: number | string }) {
  return (
    <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding }}>
      {children}
    </section>
  )
}

export function SignaturePage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<LoadState>('loading')
  const [consent, setConsent] = useState<Consent | null>(null)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [justSigned, setJustSigned] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [liveProgress, setLiveProgress] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  )
  const signatureRef = useRef<SignatureCanvasHandle>(null)
  const videoBlockRef = useRef<HTMLDivElement>(null)

  const toggleTheme = () =>
    setTheme((current) => {
      const next: Theme = current === 'light' ? 'dark' : 'light'
      localStorage.setItem(THEME_KEY, next)
      return next
    })

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

  // Durée de la vidéo : lue sur l'élément rendu par VideoPlayer, dont l'API ne
  // l'expose pas. Sert uniquement à afficher le temps restant avant déverrouillage.
  useEffect(() => {
    if (state !== 'ready') return
    const video = videoBlockRef.current?.querySelector('video')
    if (!video) return
    const read = () => setVideoDuration(video.duration || 0)
    read()
    video.addEventListener('loadedmetadata', read)
    return () => video.removeEventListener('loadedmetadata', read)
  }, [state])

  const handleVideoProgress = async (pct: number) => {
    if (!token) return
    setLiveProgress(pct)
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
    setJustSigned(true)
  }

  const syncSignature = () => setHasSignature(!(signatureRef.current?.isEmpty() ?? true))

  const clearSignature = () => {
    signatureRef.current?.clear()
    setHasSignature(false)
  }

  const shell = (children: React.ReactNode) => (
    <div
      data-woui-patient=""
      data-theme={theme}
      className="min-h-screen px-4 pb-14"
      style={{
        background: 'var(--page)',
        color: 'var(--ink)',
        transition: 'background .3s, color .3s',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <PatientHeader theme={theme} onToggle={toggleTheme} />
      <div className="mx-auto max-w-[680px]">{children}</div>
    </div>
  )

  if (state === 'loading') {
    return shell(
      <>
        <div className="flex flex-col gap-4">
          {[96, 240, 280].map((height, i) => (
            <div
              key={height}
              style={{
                height,
                borderRadius: 16,
                background: 'var(--card)',
                border: '1px solid var(--line)',
                animation: `wp-skel 1.4s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
        <p className="mt-4 text-center" style={{ fontSize: 13, color: 'var(--ink-4)' }}>
          Vérification de votre lien…
        </p>
      </>
    )
  }

  if (state === 'not-found' || !consent) {
    return shell(
      <div style={{ animation: 'wp-fade .3s both' }}>
        <Card padding="44px 32px">
          <div className="flex flex-col items-center text-center">
            <span
              className="flex items-center justify-center"
              style={{ width: 52, height: 52, borderRadius: 14, background: '#fbeceb' }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#c0564c"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5" />
                <path d="M12 16.2h.01" />
              </svg>
            </span>
            <h1 style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 18, color: 'var(--ink)' }}>
              Ce lien n'est plus valide
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: 380, marginTop: 10 }}>
              Le lien de signature a expiré ou a déjà été utilisé. Contactez votre cabinet pour en recevoir un nouveau.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const alreadySigned = consent.status === 'signed'

  if (alreadySigned && !justSigned) {
    return shell(
      <div style={{ animation: 'wp-fade .3s both' }}>
        <Card padding="44px 32px">
          <div className="flex flex-col items-center text-center">
            <span
              className="flex items-center justify-center rounded-full"
              style={{ width: 56, height: 56, background: MINT }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <h1 style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 18, color: 'var(--ink)' }}>
              Consentement déjà signé
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: 400, marginTop: 10 }}>
              Ce consentement a déjà été signé le {formatLongDate(consent.signed_at!)} à {formatHour(consent.signed_at!)}.
              Votre praticien en conserve une copie.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (justSigned) {
    return shell(
      <div style={{ animation: 'wp-pop .35s cubic-bezier(.16,.8,.3,1) both' }}>
        <Card padding="52px 32px">
          <div className="flex flex-col items-center text-center">
            <span
              className="flex items-center justify-center rounded-full"
              style={{ width: 64, height: 64, background: MINT }}
            >
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <h1 style={{ fontSize: 23, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 20, color: 'var(--ink)' }}>
              Consentement enregistré
            </h1>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: 400, marginTop: 10 }}>
              Votre praticien a été notifié. Vous pouvez fermer cette page.
            </p>

            <div
              className="flex w-full flex-col gap-2 text-left"
              style={{ marginTop: 30, padding: 16, borderRadius: 12, background: 'var(--panel)', fontSize: 13 }}
            >
              <div className="flex justify-between gap-4">
                <span style={{ color: 'var(--ink-2)' }}>Acte</span>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{consent.procedure}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: 'var(--ink-2)' }}>Signé le</span>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
                  {formatLongDate(consent.signed_at!)} à {formatHour(consent.signed_at!)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: 'var(--ink-2)' }}>Référence</span>
                <span
                  style={{
                    color: 'var(--ink)',
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '.04em',
                  }}
                >
                  {consent.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const progress = Math.max(consent.video_progress ?? 0, liveProgress)
  const unlocked = progress >= UNLOCK_AT
  const remainingSeconds = videoDuration > 0 ? (videoDuration * (UNLOCK_AT - progress)) / 100 : 0
  const canSign = unlocked && confirmChecked && hasSignature && !signing

  return shell(
    <>
      <div className="flex flex-col gap-4">
        {/* ── 1 — Identification ── */}
        <Card>
          <StepHeading n={1}>Votre consentement</StepHeading>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 16,
              marginTop: 18,
            }}
          >
            <Field label="Patient" value={consent.patient} />
            <Field label="Acte concerné" value={consent.procedure} />
            <Field label="Envoyé le" value={formatLongDate(consent.sent_at)} />
          </div>
        </Card>

        {/* ── 2 — Vidéo ── */}
        <Card>
          <StepHeading n={2}>Vidéo d'information</StepHeading>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: '14px 0 16px' }}>
            Regardez la vidéo en entier. Elle explique le déroulé de l'acte, les suites habituelles et les risques
            éventuels.
          </p>
          <div ref={videoBlockRef} style={{ position: 'relative' }}>
            <VideoPlayer
              onProgress={handleVideoProgress}
              onViewed={handleVideoViewed}
              alreadyViewed={consent.status === 'viewed' || consent.status === 'signed'}
            />
            <span
              className="pointer-events-none absolute"
              style={{ left: 14, top: 12, fontSize: 12, color: 'rgba(255,255,255,.34)' }}
            >
              {consent.procedure}
            </span>
          </div>
        </Card>

        {/* ── 3 — Signature ── */}
        <Card>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                filter: unlocked ? 'none' : 'blur(3px)',
                opacity: unlocked ? 1 : 0.4,
                pointerEvents: unlocked ? 'auto' : 'none',
                transition: 'filter .4s, opacity .4s',
              }}
            >
              <StepHeading n={3}>Votre signature</StepHeading>

              <div className="flex items-center justify-between gap-3" style={{ marginTop: 18 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                  Signez ici avec votre doigt ou votre souris
                </span>
                <button
                  type="button"
                  onClick={clearSignature}
                  disabled={!hasSignature}
                  className="min-h-[44px] cursor-pointer md:min-h-[32px]"
                  style={{
                    padding: '7px 13px',
                    fontSize: 13,
                    color: 'var(--ink-3)',
                    background: 'transparent',
                    border: '1px solid var(--line-2)',
                    borderRadius: 10,
                    opacity: hasSignature ? 1 : 0.4,
                    cursor: hasSignature ? 'pointer' : 'not-allowed',
                    transition: 'opacity .2s',
                  }}
                >
                  Effacer
                </button>
              </div>

              <div
                style={{ position: 'relative', marginTop: 12 }}
                onPointerDown={syncSignature}
                onPointerUp={syncSignature}
                onPointerLeave={syncSignature}
              >
                <SignatureCanvas ref={signatureRef} disabled={!unlocked} />
                {!hasSignature && (
                  <span
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    style={{ fontSize: 14, color: 'var(--ink-4)' }}
                  >
                    Tracez votre signature
                  </span>
                )}
              </div>

              <label className="flex items-start gap-3" style={{ marginTop: 18 }}>
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  style={{ width: 19, height: 19, accentColor: MINT, flexShrink: 0 }}
                />
                <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                  Je certifie avoir visionné la vidéo d'information et consens à l'acte médical mentionné ci-dessus.
                </span>
              </label>

              {signError && (
                <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5, color: '#c0564c' }}>{signError}</p>
              )}

              <button
                type="button"
                onClick={handleSign}
                disabled={!canSign}
                onMouseEnter={(e) => {
                  if (canSign) e.currentTarget.style.background = MINT_HOVER
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = MINT
                }}
                className="w-full"
                style={{
                  marginTop: 20,
                  padding: 16,
                  minHeight: 52,
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#ffffff',
                  background: MINT,
                  border: 0,
                  borderRadius: 12,
                  opacity: canSign ? 1 : 0.45,
                  cursor: canSign ? 'pointer' : 'not-allowed',
                  transition: 'background .2s, opacity .2s',
                }}
              >
                {signing ? 'Enregistrement…' : 'Valider ma signature'}
              </button>

              <p className="text-center" style={{ marginTop: 14, fontSize: 12, lineHeight: 1.5, color: 'var(--ink-4)' }}>
                Signature horodatée et conservée par votre cabinet. Aucune donnée n'est transmise à un tiers.
              </p>
            </div>

            {!unlocked && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
                style={{ background: 'var(--veil)', borderRadius: 16, padding: 28 }}
              >
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'var(--card)',
                    border: '1px solid var(--line-2)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b7a5c" strokeWidth="2" aria-hidden="true">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <span style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>Signature verrouillée</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-2)', maxWidth: 330 }}>
                  Elle se débloque dès que la vidéo d'information est visionnée en entier.
                  {remainingSeconds > 0 && ` Il reste ${formatRemaining(remainingSeconds)} à regarder.`}
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>

      <p className="text-center" style={{ marginTop: 16, fontSize: 12, lineHeight: 1.5, color: 'var(--ink-4)' }}>
        Lien personnel et sécurisé — ne le transmettez à personne.
      </p>
    </>
  )
}
