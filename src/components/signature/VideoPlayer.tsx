import { useRef, useState } from 'react'

interface VideoPlayerProps {
  /** Appelé au plus une fois toutes les 5s avec le % de progression (0-100). */
  onProgress: (pct: number) => void
  /** Appelé une seule fois quand le patient atteint 90% de la vidéo. */
  onViewed: () => void
  alreadyViewed: boolean
}

// Placeholder — à remplacer par la vraie vidéo d'information du praticien.
const PLACEHOLDER_SRC = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

export function VideoPlayer({ onProgress, onViewed, alreadyViewed }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastSentAt = useRef(0)
  const viewedFired = useRef(alreadyViewed)
  const [pct, setPct] = useState(alreadyViewed ? 100 : 0)
  const [started, setStarted] = useState(false)

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video || !video.duration) return

    const progress = Math.round((video.currentTime / video.duration) * 100)
    setPct(progress)

    const now = Date.now()
    if (now - lastSentAt.current >= 5000) {
      lastSentAt.current = now
      onProgress(progress)
    }

    if (progress >= 90 && !viewedFired.current) {
      viewedFired.current = true
      onProgress(progress)
      onViewed()
    }
  }

  const handleEnded = () => {
    setPct(100)
    onProgress(100)
    if (!viewedFired.current) {
      viewedFired.current = true
      onViewed()
    }
  }

  const status =
    pct >= 100
      ? { label: 'Vidéo terminée', color: '#11b184' }
      : pct >= 97
        ? { label: 'Signature débloquée', color: '#11b184' }
        : { label: 'Visionnage en cours', color: 'var(--ink-3)' }

  return (
    <div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: 14,
          background: 'var(--video)',
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          src={PLACEHOLDER_SRC}
          controls={started}
          controlsList="nodownload"
          onPlay={() => setStarted(true)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          className="block h-full w-full"
        />

        {!started && (
          <button
            type="button"
            onClick={() => videoRef.current?.play().catch(() => {})}
            className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-[14px]"
            style={{ background: 'rgba(11,33,28,.68)', border: 0 }}
          >
            <span
              className="flex items-center justify-center rounded-full"
              style={{ width: 62, height: 62, background: '#11b184' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span style={{ color: '#ffffff', fontSize: 14, fontWeight: 500 }}>
              {pct > 0 ? 'Reprendre la vidéo' : 'Lancer la vidéo'}
            </span>
          </button>
        )}

        <div className="absolute bottom-0 left-0 right-0" style={{ height: 4, background: 'rgba(255,255,255,.16)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#11b184', transition: 'width .25s linear' }} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span style={{ fontSize: 13, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.06em' }}>
          {pct} % visionné
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: status.color }}>{status.label}</span>
      </div>
    </div>
  )
}
