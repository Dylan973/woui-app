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

  return (
    <div>
      <div
        className="overflow-hidden"
        style={{ background: 'var(--navy-900)', borderRadius: 4, aspectRatio: '16 / 9' }}
      >
        <video
          ref={videoRef}
          src={PLACEHOLDER_SRC}
          controls
          controlsList="nodownload"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          className="block h-full w-full"
        />
      </div>
      <div className="mt-3 h-[3px]" style={{ background: 'var(--navy-700)' }}>
        <div className="h-full transition-[width]" style={{ width: `${pct}%`, background: 'var(--action-accent)' }} />
      </div>
      <div className="font-mono mt-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
        {pct}% visionné {pct >= 90 && '— section signature déverrouillée'}
      </div>
    </div>
  )
}
