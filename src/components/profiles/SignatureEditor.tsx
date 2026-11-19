import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import {
  cleanSignature,
  exportSignature,
  FULL_CROP,
  rotateQuarter,
  SignatureImportError,
  SMALL_INK_WIDTH,
  type CleanLevel,
  type CleanResult,
  type Crop,
} from '../../lib/signatureImport'

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const MIN = 0.05
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const LEVEL_LABELS: [CleanLevel, string][] = [
  ['light', 'Léger'],
  ['normal', 'Standard'],
  ['strong', 'Fort'],
]

/** Cadre d'aperçu « comme sur le document » : même proportion que le cadre de signature des PDF Woui. */
export function SignatureDocPreview({ children, label = 'Signature et tampon du praticien' }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="w-full max-w-[300px]">
      <div className="mb-[6px] text-[11px]" style={{ color: '#6b6b80' }}>
        {label}
      </div>
      <div
        className="flex aspect-[5/2] w-full items-center justify-center p-[10px]"
        style={{ background: '#ffffff', border: '1px solid #d9d9e3', borderRadius: 2 }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Réglage de la signature et du tampon importés. Woui nettoie le scan tout seul (fond, bords de feuille,
 * poussières) et recadre au plus près ; le praticien peut pivoter, régler le nettoyage ou rogner à la main.
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
  const [level, setLevel] = useState<CleanLevel>('normal')
  const [result, setResult] = useState<CleanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(true)
  const [crop, setCrop] = useState<Crop>(FULL_CROP)
  const [cropping, setCropping] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLCanvasElement>(null)
  const docRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: Crop } | null>(null)

  // Nettoyage (quelques centaines de ms) : lancé après l'affichage de « Préparation… ».
  useEffect(() => {
    setWorking(true)
    const id = window.setTimeout(() => {
      try {
        setResult(cleanSignature(rotateQuarter(source, quarter), level))
        setError(null)
      } catch (e) {
        setResult(null)
        setError(e instanceof SignatureImportError ? e.message : 'Ce fichier n’a pas pu être traité. Essayez un autre scan.')
      }
      setCrop(FULL_CROP)
      setCropping(false)
      setWorking(false)
    }, 30)
    return () => window.clearTimeout(id)
  }, [source, quarter, level])

  // Grand aperçu : l'image nettoyée entière (le cadre de rognage s'affiche par-dessus).
  useEffect(() => {
    const canvas = mainRef.current
    if (!canvas || !result) return
    canvas.width = result.image.width
    canvas.height = result.image.height
    const context = canvas.getContext('2d')!
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(result.image, 0, 0)
  }, [result])

  // Aperçu sur le document : la partie gardée seulement.
  useEffect(() => {
    const canvas = docRef.current
    if (!canvas || !result) return
    const { image } = result
    const sw = Math.max(1, Math.round(crop.w * image.width))
    const sh = Math.max(1, Math.round(crop.h * image.height))
    canvas.width = sw
    canvas.height = sh
    const context = canvas.getContext('2d')!
    context.clearRect(0, 0, sw, sh)
    context.drawImage(image, Math.round(crop.x * image.width), Math.round(crop.y * image.height), sw, sh, 0, 0, sw, sh)
  }, [result, crop])

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

  const confirm = async () => {
    if (!result) return
    try {
      onConfirm(await exportSignature(result.image, crop))
    } catch (e) {
      setError(e instanceof SignatureImportError ? e.message : 'La signature n’a pas pu être préparée.')
    }
  }

  const corner = (handle: Handle, style: React.CSSProperties) => (
    <span
      role="presentation"
      onPointerDown={onPointerDown(handle)}
      className="absolute h-[14px] w-[14px] touch-none"
      style={{
        ...style,
        background: '#ffffff',
        border: '2px solid var(--accent)',
        borderRadius: 2,
        cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize',
      }}
    />
  )

  const chip = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--action-primary)' : 'var(--surface-card)',
    color: active ? 'var(--action-primary-text)' : 'var(--text-secondary)',
    border: `1px solid ${active ? 'transparent' : 'var(--border-default)'}`,
  })

  const small = result !== null && result.inkWidth < SMALL_INK_WIDTH
  const cropped = crop.x !== 0 || crop.y !== 0 || crop.w !== 1 || crop.h !== 1

  return (
    <div className="max-w-[760px]">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px] md:items-start">
        {/* Résultat nettoyé, sur papier blanc */}
        <div className="min-w-0">
          <div
            className="relative flex min-h-[220px] items-center justify-center p-6"
            style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--card-ring)' }}
          >
            {working && (
              <div className="absolute inset-0 z-10 flex items-center justify-center text-[13px]" style={{ background: 'rgba(255,255,255,0.85)', color: '#4b4b63' }}>
                Nettoyage du scan…
              </div>
            )}
            {result ? (
              <div ref={stageRef} className="relative inline-block max-w-full select-none" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
                <canvas ref={mainRef} className="block h-auto max-h-[260px] w-auto max-w-full" />
                {cropping && (
                  <>
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div
                        className="absolute"
                        style={{
                          left: `${crop.x * 100}%`,
                          top: `${crop.y * 100}%`,
                          width: `${crop.w * 100}%`,
                          height: `${crop.h * 100}%`,
                          boxShadow: '0 0 0 9999px rgba(255,255,255,0.78)',
                        }}
                      />
                    </div>
                    <div
                      role="presentation"
                      onPointerDown={onPointerDown('move')}
                      className="absolute touch-none"
                      style={{
                        left: `${crop.x * 100}%`,
                        top: `${crop.y * 100}%`,
                        width: `${crop.w * 100}%`,
                        height: `${crop.h * 100}%`,
                        border: '1.5px solid var(--accent)',
                        cursor: 'move',
                      }}
                    >
                      {corner('nw', { left: -7, top: -7 })}
                      {corner('ne', { right: -7, top: -7 })}
                      {corner('sw', { left: -7, bottom: -7 })}
                      {corner('se', { right: -7, bottom: -7 })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              !working && (
                <p className="m-0 max-w-[380px] text-center text-[13px]" style={{ color: 'var(--danger-text)' }}>
                  {error}
                </p>
              )
            )}
          </div>

          {/* Réglages */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            <button
              type="button"
              onClick={() => setQuarter((q) => (q + 1) % 4)}
              disabled={working}
              className="flex cursor-pointer items-center gap-2 rounded-[3px] px-3 py-[7px]"
              style={chip(false)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 4v5h-5" />
              </svg>
              Pivoter
            </button>
            <button
              type="button"
              onClick={() => setCropping((c) => !c)}
              disabled={working || !result}
              aria-pressed={cropping}
              className="flex cursor-pointer items-center gap-2 rounded-[3px] px-3 py-[7px]"
              style={chip(cropping)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                <path d="M18 22V8a2 2 0 0 0-2-2H2" />
              </svg>
              {cropping ? 'Terminer le rognage' : 'Rogner'}
            </button>
            <div className="flex items-center gap-2" role="group" aria-label="Nettoyage du fond">
              <span>Nettoyage du fond</span>
              <div className="flex overflow-hidden rounded-[3px]" style={{ border: '1px solid var(--border-default)' }}>
                {LEVEL_LABELS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLevel(value)}
                    disabled={working}
                    aria-pressed={level === value}
                    className="cursor-pointer px-3 py-[6px] text-[12.5px]"
                    style={{
                      background: level === value ? 'var(--surface-card-alt)' : 'var(--surface-card)',
                      color: level === value ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: level === value ? 600 : 400,
                      border: 0,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {cropped && !cropping && (
              <button type="button" onClick={() => setCrop(FULL_CROP)} className="cursor-pointer" style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}>
                Annuler le rognage
              </button>
            )}
          </div>
          <p className="mb-0 mt-3 text-[12.5px] leading-[1.5]" style={{ color: 'var(--text-muted)' }}>
            {cropping
              ? 'Déplacez le cadre ou ses coins pour ne garder que la signature et le tampon.'
              : 'Woui retire le fond, les bords de la feuille et les poussières, puis recadre au plus près. Trait trop pâle : « Léger ». Fond gris ou taché : « Fort ».'}
          </p>
        </div>

        {/* Rendu final */}
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
            Sur vos documents
          </div>
          <SignatureDocPreview>{result && <canvas ref={docRef} className="block max-h-full max-w-full" style={{ objectFit: 'contain' }} />}</SignatureDocPreview>
          {result && (
            <ul className="m-0 mt-3 flex list-none flex-col gap-[6px] p-0 text-[12.5px] leading-[1.45]">
              {result.removed > 0 && (
                <li style={{ color: 'var(--text-secondary)' }}>
                  ✓ {result.removed} trace{result.removed > 1 ? 's' : ''} parasite{result.removed > 1 ? 's' : ''} retirée{result.removed > 1 ? 's' : ''}
                </li>
              )}
              <li style={{ color: small ? 'var(--warning-text, #b5651d)' : 'var(--text-secondary)' }}>
                {small
                  ? 'Signature petite sur ce scan : elle peut manquer de netteté. Signez plus grand ou photographiez de plus près.'
                  : '✓ Netteté suffisante pour les documents'}
              </li>
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={confirm} disabled={busy || working || !result}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <button type="button" onClick={onCancel} disabled={busy} className="cursor-pointer text-[13px]" style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}>
          Annuler
        </button>
      </div>
    </div>
  )
}
