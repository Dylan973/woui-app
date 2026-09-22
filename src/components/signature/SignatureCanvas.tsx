import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

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
  }, [])

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    drawing.current = true
    hasDrawn.current = true
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    // canvas 2D ne lit pas les custom properties : on résout --ink au moment du tracé
    // pour que la signature suive le thème actif de la page patient.
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--ink').trim() || '#0c1f1a'
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
  }

  useImperativeHandle(ref, () => ({
    getDataUrl: () => (hasDrawn.current ? canvasRef.current!.toDataURL('image/png') : null),
    clear,
    isEmpty: () => !hasDrawn.current,
  }))

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerLeave={stop}
      className="block w-full touch-none"
      style={{
        height: 200,
        background: 'var(--card)',
        border: '1.5px dashed rgba(17,177,132,.45)',
        borderRadius: 14,
        cursor: disabled ? 'not-allowed' : 'crosshair',
      }}
    />
  )
})
