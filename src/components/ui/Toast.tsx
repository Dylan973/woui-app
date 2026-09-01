import { useEffect } from 'react'

export type ToastType = 'success' | 'info' | 'warning'

interface ToastProps {
  msg: string
  type?: ToastType
  onDone: () => void
}

const COLORS: Record<ToastType, string> = {
  success: '#10b981',
  info: '#0ea5e9',
  warning: '#f59e0b',
}

const ICONS: Record<ToastType, string> = {
  success: '✅',
  info: 'ℹ️',
  warning: '⚠️',
}

export function Toast({ msg, type = 'success', onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])

  const c = COLORS[type]

  return (
    <div
      className="toast-enter fixed bottom-6 right-6 z-[9999] flex max-w-[320px] items-start gap-[0.65rem] rounded-2xl p-[0.9rem_1.2rem]"
      style={{ background: 'var(--bg-card)', border: `1px solid ${c}55`, boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}
    >
      <span className="text-lg">{ICONS[type]}</span>
      <span className="text-[0.85rem] leading-[1.5] text-[var(--text-muted)]">{msg}</span>
    </div>
  )
}
