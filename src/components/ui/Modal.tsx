import type { ReactNode } from 'react'

interface ModalProps {
  onClose: () => void
  children: ReactNode
  maxWidth?: number
  zIndex?: number
}

/** Wrapper générique : fond sombre plein écran + carte centrée. */
export function Modal({ onClose, children, maxWidth = 450, zIndex = 500 }: ModalProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', zIndex }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-[20px] p-8 animate-[fadeIn_0.2s_ease]"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
