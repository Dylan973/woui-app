import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { VideoPlayer } from '../components/signature/VideoPlayer'
import { SignatureCanvas, type SignatureCanvasHandle } from '../components/signature/SignatureCanvas'
import { WOUI_LOGO_URL } from '../lib/constants'
import type { PatientConsent } from '../types'

type LoadState = 'loading' | 'not-found' | 'ready'
type Theme = 'light' | 'dark'

const THEME_KEY = 'woui_patient_theme'
// Violet Woui (même charte que le tableau de bord et le site) ; texte blanc lisible dessus.
const MINT = 'var(--brand)'
const MINT_HOVER = 'var(--brand-hover)'

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

function PatientHeader({
  theme,
  onToggle,
  cabinetName,
  logoUrl,
}: {
  theme: Theme
  onToggle: () => void
  cabinetName?: string | null
  logoUrl?: string | null
}) {
  const [hover, setHover] = useState(false)
  return (
    <header className="mx-auto flex max-w-[680px] flex-wrap items-center justify-between gap-4 pb-[22px] pt-5">
      {/* TODO wordmarks : déposer /public/woui-wordmark.png (thème clair) et
          /public/woui-wordmark-white.png (thème sombre), puis remplacer ce bloc
          par deux <img> conditionnels de 18px de haut. En attendant, la marque
          blanche existante est posée sur un carré violet pour rester lisible
          sur les deux fonds. */}
      {logoUrl || cabinetName ? (
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl && (
            <span
              className="flex flex-none items-center justify-center overflow-hidden"
              style={{ height: 40, maxWidth: 140, borderRadius: 8, background: '#ffffff', padding: '4px 8px' }}
            >
              <img src={logoUrl} alt={cabinetName ? `Logo ${cabinetName}` : 'Logo du cabinet'} style={{ maxHeight: 32, maxWidth: 124, objectFit: 'contain' }} />
            </span>
          )}
          {cabinetName && (
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)', overflowWrap: 'anywhere' }}>
              {cabinetName}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span
            className="flex items-center justify-center"
            style={{ width: 22, height: 22, borderRadius: 6, background: MINT, padding: 4 }}
          >
            <img src={WOUI_LOGO_URL} alt="" className="h-full w-full object-contain" />
          </span>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Woui</span>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <span
          className="inline-flex items-center gap-1.5"
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            background: 'var(--brand-soft)',
            color: 'var(--brand-ink)',
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
          background: 'var(--brand-soft)',
          color: 'var(--brand-ink)',
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

function DocumentRow({
  title,
  note,
  done = false,
  onOpen,
  onDownload,
}: {
  title: string
  note: string
  done?: boolean
  onOpen: () => void
  onDownload?: () => void
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3"
      style={{ padding: 14, borderRadius: 12, background: 'var(--panel)', border: `1px solid ${done ? MINT : 'var(--line)'}` }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={MINT} strokeWidth="1.8" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </svg>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{title}</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-3)', marginTop: 2 }}>{note}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-h-[44px] cursor-pointer"
          style={{ padding: '9px 16px', fontSize: 13.5, fontWeight: 500, color: '#ffffff', background: MINT, border: 0, borderRadius: 10 }}
        >
          Lire le document
        </button>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="min-h-[44px] cursor-pointer"
            style={{ padding: '9px 14px', fontSize: 13.5, color: 'var(--ink-2)', background: 'transparent', border: '1px solid var(--line-2)', borderRadius: 10 }}
          >
            Télécharger
          </button>
        )}
      </div>
    </div>
  )
}

function DownloadButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[48px] w-full cursor-pointer"
      style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: 'var(--ink)', background: 'transparent', border: '1px solid var(--line-2)', borderRadius: 12 }}
    >
      {label}
    </button>
  )
}

export function SignaturePage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<LoadState>('loading')
  const [consent, setConsent] = useState<PatientConsent | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [quoteChecked, setQuoteChecked] = useState(false)
  const [quoteOpened, setQuoteOpened] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [justSigned, setJustSigned] = useState(false)
  // Après signature : le patient peut revoir la vidéo (suites de l'acte, conseils), sans effet sur la signature.
  const [replay, setReplay] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [liveProgress, setLiveProgress] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  )
  const signatureRef = useRef<SignatureCanvasHandle>(null)
  const videoBlockRef = useRef<HTMLDivElement>(null)

  // Titre de l'onglet : le nom du cabinet plutôt que celui du tableau de bord.
  useEffect(() => {
    const previous = document.title
    document.title = consent?.cabinet_name ? `Vos documents — ${consent.cabinet_name}` : 'Vos documents à signer — Woui'
    return () => {
      document.title = previous
    }
  }, [consent?.cabinet_name])

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
      // Accès patient uniquement via les fonctions sécurisées par token (RPC) :
      // la table `consents` n'est plus lisible directement par un visiteur anonyme.
      const { data, error } = await supabase.rpc('get_consent_by_token', { p_token: token })
      if (cancelled) return

      const row = (Array.isArray(data) ? data[0] : data) as PatientConsent | undefined
      if (error || !row) {
        setState('not-found')
        return
      }

      setConsent(row)
      setQuoteOpened(Boolean(row.quote_opened_at))
      setState('ready')

      // Logo du cabinet (offre Clinique) : lien temporaire remis par le serveur.
      if (row.has_logo) {
        void supabase.functions.invoke('patient-document', { body: { token, doc: 'logo' } }).then(({ data: logo }) => {
          const url = (logo as { url?: string } | null)?.url
          if (!cancelled && url) setLogoUrl(url)
        })
      }

      // Première ouverture du lien -> statut "opened".
      if (row.status === 'sent' && !row.expired) {
        const { data: updated } = await supabase.rpc('mark_consent_opened', { p_token: token })
        const next = (Array.isArray(updated) ? updated[0] : updated) as PatientConsent | undefined
        if (!cancelled && next) setConsent(next)
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
    await supabase.rpc('update_consent_video_progress', { p_token: token, p_progress: pct })
    setConsent((c) => (c ? { ...c, video_progress: Math.max(c.video_progress ?? 0, pct) } : c))
  }

  const handleVideoViewed = async () => {
    if (!token) return
    const { data } = await supabase.rpc('mark_consent_viewed', { p_token: token })
    const next = (Array.isArray(data) ? data[0] : data) as PatientConsent | undefined
    if (next) setConsent(next)
  }

  // Les documents sont dans un stockage privé : le serveur remet un lien temporaire.
  // L'onglet est ouvert avant l'appel pour ne pas être bloqué par le navigateur.
  const openDocument = async (doc: 'consent' | 'quote' | 'consent_signed' | 'quote_signed', download = false) => {
    if (!token) return
    setDocError(null)
    const tab = download ? null : window.open('', '_blank')
    const { data, error } = await supabase.functions.invoke('patient-document', { body: { token, doc, download } })
    const url = (data as { url?: string } | null)?.url
    if (error || !url) {
      tab?.close()
      setDocError('Ce document est momentanément indisponible. Réessayez dans un instant.')
      return
    }
    if (doc === 'quote') setQuoteOpened(true)
    if (tab) tab.location.href = url
    else window.location.assign(url)
  }

  const handleSign = async () => {
    const kindNow = consent?.kind ?? 'consent'
    if (!token || (kindNow !== 'quote' && !confirmChecked) || (kindNow !== 'consent' && !quoteChecked)) return
    const dataUrl = signatureRef.current?.getDataUrl()
    if (!dataUrl) {
      setSignError('Veuillez signer dans le cadre prévu avant de valider.')
      return
    }
    setSigning(true)
    setSignError(null)
    // Signature côté serveur : horodatage, IP, appareil, PDF signé et empreinte.
    const { data, error } = await supabase.functions.invoke('sign-consent', {
      body: { token, signature: dataUrl },
    })
    setSigning(false)
    const signed = (data as { consent?: Partial<PatientConsent> } | null)?.consent
    if (error || !signed) {
      setSignError("La signature n'a pas pu être enregistrée. Vérifiez que la vidéo a été visionnée et que le devis a été ouvert, puis réessayez.")
      return
    }
    setConsent((c) => (c ? { ...c, ...signed } : c))
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
      <PatientHeader theme={theme} onToggle={toggleTheme} cabinetName={consent?.cabinet_name} logoUrl={logoUrl} />
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

  if (state === 'not-found' || !consent || (consent.expired && consent.status !== 'signed')) {
    const expired = consent?.expired === true
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
              {expired ? 'Ce lien a expiré' : "Ce lien n'est plus valide"}
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: 380, marginTop: 10 }}>
              {expired
                ? `Pour votre sécurité, les liens restent valables 30 jours. Contactez ${consent?.cabinet_name ?? 'votre cabinet'} pour en recevoir un nouveau.`
                : 'Le lien de signature est introuvable. Vérifiez qu’il a été copié en entier, ou contactez votre cabinet.'}
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const alreadySigned = consent.status === 'signed'
  const kind = consent.kind ?? 'consent'
  const withConsent = kind !== 'quote'
  const withQuote = kind !== 'consent'
  const docLabel = kind === 'consent' ? 'Consentement' : kind === 'quote' ? 'Devis' : 'Documents'
  const signedDownloads = (
    <div className="flex w-full flex-col gap-2" style={{ marginTop: 22 }}>
      {withConsent && (
        <DownloadButton label="Télécharger mon consentement signé" onClick={() => openDocument('consent_signed', true)} />
      )}
      {withQuote && (
        <DownloadButton label="Télécharger mon devis signé (pour ma mutuelle)" onClick={() => openDocument('quote_signed', true)} />
      )}
      {docError && <p style={{ fontSize: 13, color: '#c0564c' }}>{docError}</p>}
    </div>
  )

  const replayBlock = withConsent ? (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)' }}>Vidéo d'information</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink-2)', margin: '4px 0 0' }}>
            Revoyez le déroulé de l'acte et les suites habituelles quand vous le souhaitez.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReplay((v) => !v)}
          aria-expanded={replay}
          className="cursor-pointer"
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 14.5,
            fontWeight: 500,
            background: replay ? 'transparent' : 'var(--brand-soft)',
            color: 'var(--brand-ink)',
            border: '1px solid var(--line-2)',
          }}
        >
          {replay ? 'Masquer la vidéo' : 'Revoir la vidéo'}
        </button>
      </div>
      {replay && (
        <div style={{ position: 'relative', marginTop: 18 }}>
          <VideoPlayer onProgress={() => {}} onViewed={() => {}} alreadyViewed />
          <span className="pointer-events-none absolute" style={{ left: 14, top: 12, fontSize: 12, color: 'rgba(255,255,255,.34)' }}>
            {consent.procedure}
          </span>
        </div>
      )}
    </Card>
  ) : null

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
              {kind === 'both' ? 'Documents déjà signés' : `${docLabel} déjà signé`}
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: 400, marginTop: 10 }}>
              La signature a été enregistrée le {formatLongDate(consent.signed_at!)} à {formatHour(consent.signed_at!)}.
              Votre praticien en conserve une copie.
            </p>
            {signedDownloads}
          </div>
        </Card>
        {replayBlock && <div style={{ marginTop: 18 }}>{replayBlock}</div>}
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
              {kind === 'both' ? 'Documents signés' : `${docLabel} signé`}
            </h1>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: 400, marginTop: 10 }}>
              Votre praticien a été notifié. Vous pouvez fermer cette page.
            </p>

            <div
              className="flex w-full flex-col gap-2 text-left"
              style={{ marginTop: 30, padding: 16, borderRadius: 12, background: 'var(--panel)', fontSize: 13 }}
            >
              <div className="flex justify-between gap-4">
                <span style={{ color: 'var(--ink-2)' }}>{withConsent ? 'Acte' : 'Document'}</span>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{withConsent ? consent.procedure : (consent.quote_name ?? 'Devis')}</span>
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
            {signedDownloads}
          </div>
        </Card>
        {replayBlock && <div style={{ marginTop: 18 }}>{replayBlock}</div>}
      </div>
    )
  }

  const progress = Math.max(consent.video_progress ?? 0, liveProgress)
  const videoDone = !withConsent || progress >= UNLOCK_AT
  const unlocked = videoDone && (!withQuote || quoteOpened)
  const hasDocuments = withQuote || consent.has_template
  const videoStep = 2
  const documentsStep = withConsent ? 3 : 2
  const signatureStep = 2 + (withConsent ? 1 : 0) + (hasDocuments ? 1 : 0)
  const remainingSeconds = videoDuration > 0 ? (videoDuration * (UNLOCK_AT - progress)) / 100 : 0
  const canSign = unlocked && (!withConsent || confirmChecked) && (!withQuote || quoteChecked) && hasSignature && !signing

  return shell(
    <>
      <div className="flex flex-col gap-4">
        {/* ── 1 — Identification ── */}
        <Card>
          <StepHeading n={1}>{kind === 'consent' ? 'Votre consentement' : kind === 'quote' ? 'Votre devis' : 'Vos documents'}</StepHeading>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 16,
              marginTop: 18,
            }}
          >
            <Field label="Patient" value={consent.patient} />
            <Field label={withConsent ? 'Acte concerné' : 'Document'} value={withConsent ? consent.procedure : (consent.quote_name ?? 'Devis')} />
            {consent.practitioner_name && <Field label="Praticien" value={`Dr ${consent.practitioner_name}`} />}
            <Field label="Envoyé le" value={formatLongDate(consent.sent_at)} />
          </div>
        </Card>

        {/* ── Vidéo (envois avec consentement) ── */}
        {withConsent && (
        <Card>
          <StepHeading n={videoStep}>Vidéo d'information</StepHeading>
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
        )}

        {/* ── Documents à lire : formulaire du cabinet, devis ── */}
        {hasDocuments && (
          <Card>
            <StepHeading n={documentsStep}>{withQuote && !consent.has_template ? 'Votre devis' : 'Documents à lire'}</StepHeading>
            <div className="flex flex-col gap-3" style={{ marginTop: 16 }}>
              {withConsent && consent.has_template && (
                <DocumentRow
                  title="Formulaire de consentement"
                  note="Le document de votre cabinet, à lire avant de signer."
                  onOpen={() => openDocument('consent')}
                />
              )}
              {withQuote && (
                <DocumentRow
                  title={consent.quote_name ?? 'Devis'}
                  note={
                    quoteOpened
                      ? 'Devis ouvert. Vous pouvez le télécharger pour l’envoyer à votre mutuelle avant de signer.'
                      : 'Ouvrez le devis pour pouvoir le signer. Vous pouvez aussi le télécharger pour votre mutuelle.'
                  }
                  done={quoteOpened}
                  onOpen={() => openDocument('quote')}
                  onDownload={() => openDocument('quote', true)}
                />
              )}
              {docError && <p style={{ fontSize: 13, color: '#c0564c' }}>{docError}</p>}
            </div>
          </Card>
        )}

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
              <StepHeading n={signatureStep}>Votre signature</StepHeading>

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

              {withConsent && (
                <label className="flex items-start gap-3" style={{ marginTop: 18 }}>
                  <input
                    type="checkbox"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    style={{ width: 19, height: 19, accentColor: MINT, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                    Je certifie avoir visionné la vidéo d'information{consent.has_template ? ', avoir lu le formulaire de consentement' : ''} et
                    consens à l'acte médical mentionné ci-dessus.
                  </span>
                </label>
              )}
              {withQuote && (
                <label className="flex items-start gap-3" style={{ marginTop: withConsent ? 12 : 18 }}>
                  <input
                    type="checkbox"
                    checked={quoteChecked}
                    onChange={(e) => setQuoteChecked(e.target.checked)}
                    style={{ width: 19, height: 19, accentColor: MINT, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                    Bon pour accord : j'ai lu le devis, j'en ai compris le contenu et le montant restant à ma charge, et je l'accepte.
                  </span>
                </label>
              )}

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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-ink)" strokeWidth="2" aria-hidden="true">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <span style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>Signature verrouillée</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-2)', maxWidth: 330 }}>
                  {!videoDone
                    ? "Elle se débloque dès que la vidéo d'information est visionnée en entier."
                    : 'Elle se débloque dès que vous avez ouvert le devis.'}
                  {!videoDone && remainingSeconds > 0 && ` Il reste ${formatRemaining(remainingSeconds)} à regarder.`}
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
