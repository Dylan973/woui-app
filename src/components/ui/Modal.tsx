import type { ReactNode } from 'react'

interface ModalProps {
  onClose: () => void
  children: ReactNode
  maxWidth?: number
  zIndex?: number
}

/** Wrapper générique : overlay flou + carte centrée. */
export function Modal({ onClose, children, maxWidth = 460, zIndex = 500 }: ModalProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: 'var(--surface-overlay)', backdropFilter: 'blur(8px)', zIndex }}
      onClick={onClose}
    >
      <div
        className="w-full animate-[nb-rise_0.24s_var(--ease-standard)_both] p-9"
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 4,
          boxShadow: 'var(--shadow-lg)',
          maxWidth,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
