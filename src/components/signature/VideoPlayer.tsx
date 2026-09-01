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
      <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid var(--border-color)', background: '#000' }}>
        <video
          ref={videoRef}
          src={PLACEHOLDER_SRC}
          controls
          controlsList="nodownload"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          className="block w-full"
          style={{ maxHeight: 420 }}
        />
      </div>
      <div className="mt-2 h-[6px] overflow-hidden rounded" style={{ background: 'var(--border-color)' }}>
        <div className="h-full transition-[width]" style={{ width: `${pct}%`, background: pct >= 90 ? '#10b981' : '#3b82f6' }} />
      </div>
      <div className="mt-1 text-[0.72rem]" style={{ color: 'var(--text-dark)' }}>
        {pct}% visionné {pct >= 90 && '— section signature déverrouillée ✓'}
      </div>
    </div>
  )
}
