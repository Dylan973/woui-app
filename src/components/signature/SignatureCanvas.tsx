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
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#e2e8f0'
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
        className="w-full touch-none rounded-2xl"
        style={{
          height: 180,
          background: 'var(--bg-input)',
          border: `1px dashed var(--border-color)`,
          cursor: disabled ? 'not-allowed' : 'crosshair',
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[0.72rem]" style={{ color: 'var(--text-dark)' }}>
          {disabled ? 'Visionnez la vidéo pour activer la signature' : 'Signez avec la souris ou votre doigt'}
        </span>
        <button
          onClick={clear}
          disabled={disabled || empty}
          className="cursor-pointer rounded-md px-3 py-1 text-[0.75rem] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
        >
          Effacer
        </button>
      </div>
    </div>
  )
})
