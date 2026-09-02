import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export interface SignatureCanvasHandle {
  /** Retourne la signature en base64 PNG, ou null si le canvas est vide. */
  getDataUrl: () => string | null
  clear: () => void
  isEmpty: () => boolean
}

interface SignatureCanvasProps {
  disabled: boolean
}

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(function SignatureCanvas(
  { disabled },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasDrawn = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Redimensionne le canvas à sa taille CSS réelle (évite le flou / la distorsion).
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#10151d' // var(--navy-900) — canvas 2D ne lit pas les custom properties
  }, [])

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    drawing.current = true
    hasDrawn.current = true
    setEmpty(false)
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stop = () => {
    drawing.current = false
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawn.current = false
    setEmpty(true)
  }

  useImperativeHandle(ref, () => ({
    getDataUrl: () => (hasDrawn.current ? canvasRef.current!.toDataURL('image/png') : null),
    clear,
    isEmpty: () => !hasDrawn.current,
  }))

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerLeave={stop}
        className="w-full touch-none"
        style={{
          height: 180,
          background: 'var(--stone-0)',
          border: '1px dashed var(--border-default)',
          borderRadius: 4,
          cursor: disabled ? 'not-allowed' : 'crosshair',
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
          {disabled ? 'Visionnez la vidéo pour activer la signature' : 'Signez avec la souris ou votre doigt'}
        </span>
        <button
          onClick={clear}
          disabled={disabled || empty}
          className="cursor-pointer rounded-[3px] px-3 py-1 text-[0.8125rem] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          Effacer
        </button>
      </div>
    </div>
  )
})
