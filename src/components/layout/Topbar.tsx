import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Consent } from '../../types'

interface TopbarProps {
  title: string
  action?: ReactNode
  consents?: Consent[]
}

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('woui_theme') === 'light' ? 'light' : 'dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('woui_theme', theme)
  }, [theme])

  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }
}

export function Topbar({ title, action, consents = [] }: TopbarProps) {
  const { theme, toggle } = useTheme()
  const [showNotifs, setShowNotifs] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const signedRecently = useMemo(
    () =>
      consents
        .filter((c) => c.status === 'signed' && c.signed_at)
        .sort((a, b) => new Date(b.signed_at!).getTime() - new Date(a.signed_at!).getTime())
        .slice(0, 5),
    [consents]
  )

  const lastSeenAt = useRef(Number(localStorage.getItem('woui_notifs_seen') || 0))
  const unread = signedRecently.filter((c) => new Date(c.signed_at!).getTime() > lastSeenAt.current).length

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setShowNotifs(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const openNotifs = () => {
    setShowNotifs((v) => !v)
    lastSeenAt.current = Date.now()
    localStorage.setItem('woui_notifs_seen', String(lastSeenAt.current))
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  }

  return (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-[1.6rem]" style={{ color: 'var(--text-main)' }}>
        {title}
      </h1>
      <div className="flex items-center gap-[0.65rem]">
        <button
          onClick={toggle}
          title="Changer de thème"
          className="cursor-pointer rounded-[10px] p-[0.58rem_0.72rem] text-[1rem]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
        <button
          onClick={toggleFullscreen}
          title="Plein écran"
          className="hidden cursor-pointer rounded-[10px] p-[0.58rem_0.72rem] text-[1rem] sm:inline-flex"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
        >
          ⛶
        </button>
        <div className="relative" ref={popoverRef}>
          <button
            onClick={openNotifs}
            className="relative cursor-pointer rounded-[10px] p-[0.58rem_0.82rem] text-[1rem]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
          >
            🔔
            {unread > 0 && (
              <span className="absolute right-[3px] top-[3px] flex h-[15px] w-[15px] items-center justify-center rounded-full bg-[#ef4444] text-[0.58rem] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          {showNotifs && (
            <div
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-2xl p-2"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            >
              {signedRecently.length === 0 ? (
                <div className="p-3 text-center text-[0.8rem]" style={{ color: 'var(--text-muted)' }}>
                  Aucune notification
                </div>
              ) : (
                signedRecently.map((c) => (
                  <div key={c.id} className="rounded-lg p-[0.6rem_0.7rem] text-[0.8rem]" style={{ color: 'var(--text-main)' }}>
                    <b>{c.patient}</b> a signé le consentement
                    <div style={{ color: 'var(--text-dark)', fontSize: '0.7rem' }}>
                      {new Date(c.signed_at!).toLocaleString('fr-FR')}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        {action}
      </div>
    </div>
  )
}
