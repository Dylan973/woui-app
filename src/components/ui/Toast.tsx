import { useEffect } from 'react'

export type ToastType = 'success' | 'info' | 'warning'

interface ToastProps {
  msg: string
  type?: ToastType
  onDone: () => void
}

const DOT_COLOR: Record<ToastType, string> = {
  success: 'var(--garnet-400)',
  info: 'var(--blue-500)',
  warning: 'var(--amber-500)',
}

export function Toast({ msg, type = 'success', onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 5000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className="toast-enter fixed bottom-7 right-[30px] z-50 flex items-center gap-4 px-5 py-4"
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 4,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <span className="relative h-2 w-2 flex-shrink-0 rounded-full" style={{ background: DOT_COLOR[type] }}>
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: DOT_COLOR[type], animation: 'nb-halo 2s ease-in-out infinite' }}
        />
      </span>
      <span className="text-[0.9375rem]" style={{ color: 'var(--text-primary)' }}>
        {msg}
      </span>
      <button
        onClick={onDone}
        className="cursor-pointer text-base leading-none"
        style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
      >
        ×
      </button>
    </div>
  )
}
