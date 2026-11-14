import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { contentBox, exportSignature, rotateCanvas, type Crop } from '../../lib/signatureImport'

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const MIN = 0.04

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Éditeur de la signature et du tampon importés : pivoter (quart de tour et réglage fin),
 * zoomer et rogner (cadre déplaçable, coins redimensionnables).
 */
export function SignatureEditor({
  source,
  busy,
  onCancel,
  onConfirm,
}: {
  source: HTMLCanvasElement
  busy: boolean
  onCancel: () => void
  onConfirm: (image: Blob) => void
}) {
  const [quarter, setQuarter] = useState(0)
  const [fine, setFine] = useState(0)
  const [zoom, setZoom] = useState(1)
  const angle = quarter * 90 + fine
  const rotated = useMemo(() => rotateCanvas(source, angle), [source, angle])
  const [crop, setCrop] = useState<Crop>(() => contentBox(source) ?? { x: 0, y: 0, w: 1, h: 1 })
  const displayRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: Crop } | null>(null)

  // Aperçu : l'image tournée, réduite pour l'écran.
  useEffect(() => {
    const canvas = displayRef.current
    if (!canvas) return
    const scale = Math.min(1, 1400 / rotated.width)
    canvas.width = Math.round(rotated.width * scale)
    canvas.height = Math.round(rotated.height * scale)
    const context = canvas.getContext('2d')!
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(rotated, 0, 0, canvas.width, canvas.height)
  }, [rotated])

  // Le cadre reste visible : à l'ouverture, après une rotation ou un zoom, la vue se centre dessus.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const id = requestAnimationFrame(() => {
      view.scrollLeft = (crop.x + crop.w / 2) * view.scrollWidth - view.clientWidth / 2
      view.scrollTop = (crop.y + crop.h / 2) * view.scrollHeight - view.clientHeight / 2
    })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, rotated])

  // Après une rotation, le cadre se replace autour de la signature et du tampon.
  const reframe = (next: HTMLCanvasElement) => setCrop(contentBox(next) ?? { x: 0, y: 0, w: 1, h: 1 })
  const turn = (delta: number) => {
    const q = (quarter + delta + 4) % 4
    setQuarter(q)
    reframe(rotateCanvas(source, q * 90 + fine))
  }

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { handle, startX: e.clientX, startY: e.clientY, start: crop }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const stage = stageRef.current
    if (!d || !stage) return
    const rect = stage.getBoundingClientRect()
    const dx = (e.clientX - d.startX) / rect.width
    const dy = (e.clientY - d.startY) / rect.height
    const s = d.start
    let { x, y, w, h } = s
    if (d.handle === 'move') {
      x = clamp(s.x + dx, 0, 1 - s.w)
      y = clamp(s.y + dy, 0, 1 - s.h)
    } else {
      const left = d.handle === 'nw' || d.handle === 'sw'
      const top = d.handle === 'nw' || d.handle === 'ne'
      if (left) {
        x = clamp(s.x + dx, 0, s.x + s.w - MIN)
        w = s.x + s.w - x
      } else w = clamp(s.w + dx, MIN, 1 - s.x)
      if (top) {
        y = clamp(s.y + dy, 0, s.y + s.h - MIN)
        h = s.y + s.h - y
      } else h = clamp(s.h + dy, MIN, 1 - s.y)
    }
    setCrop({ x, y, w, h })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const confirm = async () => onConfirm(await exportSignature(rotated, crop))

  const corner = (handle: Handle, style: React.CSSProperties) => (
    <span
      role="presentation"
      onPointerDown={onPointerDown(handle)}
      className="absolute h-4 w-4 touch-none"
      style={{
        ...style,
        background: '#ffffff',
        border: '2px solid var(--accent)',
        borderRadius: 3,
        cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize',
      }}
    />
  )

  const tool = (label: string, onClick: () => void, title: string) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-[3px] px-2 text-[15px]"
      style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
        <div className="flex items-center gap-2">
          {tool('⟲', () => turn(-1), 'Pivoter d’un quart de tour à gauche')}
          {tool('⟳', () => turn(1), 'Pivoter d’un quart de tour à droite')}
        </div>
        <label className="flex items-center gap-2">
          Redresser
          <input
            type="range"
            min={-15}
            max={15}
            step={0.5}
            value={fine}
            onChange={(e) => setFine(Number(e.target.value))}
            onPointerUp={() => reframe(rotateCanvas(source, quarter * 90 + fine))}
            aria-label="Redresser l’image"
            style={{ accentColor: 'var(--accent)', width: 120 }}
          />
          <span className="font-mono w-[42px] tabular-nums">{fine > 0 ? '+' : ''}{fine}°</span>
        </label>
        <label className="flex items-center gap-2">
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoomer"
            style={{ accentColor: 'var(--accent)', width: 120 }}
          />
          <span className="font-mono w-[36px] tabular-nums">×{zoom.toFixed(1)}</span>
        </label>
        <button
          type="button"
          onClick={() => reframe(rotated)}
          className="cursor-pointer text-[13px] underline"
          style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}
        >
          Recadrer automatiquement
        </button>
      </div>

      <div
        ref={viewRef}
        className="max-h-[420px] max-w-[640px] overflow-auto"
        style={{
          backgroundColor: '#ffffff',
          backgroundImage:
            'linear-gradient(45deg,#f1f1f4 25%,transparent 25%,transparent 75%,#f1f1f4 75%),linear-gradient(45deg,#f1f1f4 25%,transparent 25%,transparent 75%,#f1f1f4 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0,8px 8px',
          border: '1px solid var(--border-subtle)',
          borderRadius: 4,
        }}
      >
        <div ref={stageRef} className="relative select-none" style={{ width: `${zoom * 100}%` }} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <canvas ref={displayRef} className="block h-auto w-full" />
          {/* Voile hors du cadre */}
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.w * 100}%`,
              height: `${crop.h * 100}%`,
              boxShadow: '0 0 0 9999px rgba(23,23,52,0.45)',
            }}
          />
          <div
            role="presentation"
            onPointerDown={onPointerDown('move')}
            className="absolute touch-none"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.w * 100}%`,
              height: `${crop.h * 100}%`,
              border: '2px dashed var(--accent)',
              cursor: 'move',
            }}
          >
            {corner('nw', { left: -8, top: -8 })}
            {corner('ne', { right: -8, top: -8 })}
            {corner('sw', { left: -8, bottom: -8 })}
            {corner('se', { right: -8, bottom: -8 })}
          </div>
        </div>
      </div>
      <p className="mb-4 mt-2 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
        Faites glisser le cadre ou ses coins pour ne garder que le tampon et la signature.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={confirm} disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <button type="button" onClick={onCancel} disabled={busy} className="cursor-pointer text-[13px]" style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}>
          Annuler
        </button>
      </div>
    </div>
  )
}
