import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { Consent, Doctor } from '../../types'
import { WOUI_LOGO_URL } from '../../lib/constants'
import { Button } from '../ui/Button'

interface HeaderProps {
  doctor: Doctor
  consents: Consent[]
  onOpenSendModal: () => void
  onSignOut: () => void
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('woui_theme') === 'dark' ? 'dark' : 'light'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('woui_theme', theme)
  }, [theme])

  return { theme, toggle: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')) }
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.trim()?.[0] ?? ''
  const last = lastName?.trim()?.[0] ?? ''
  return (`${first}${last}`.toUpperCase() || 'DR').slice(0, 2)
}

const NAV_ITEM =
  'border-0 bg-transparent px-4 py-2 rounded-[3px] cursor-pointer text-[0.8125rem] tracking-[0.06em] whitespace-nowrap transition-colors'

export function Header({ doctor, consents, onOpenSendModal, onSignOut }: HeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [notifOpen, setNotifOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)

  const isDashboard = location.pathname === '/dashboard'

  const signedRecently = useMemo(
    () =>
      consents
        .filter((c) => c.status === 'signed' && c.signed_at)
        .sort((a, b) => new Date(b.signed_at!).getTime() - new Date(a.signed_at!).getTime())
        .slice(0, 4),
    [consents]
  )
  const lastSeenAt = useRef(Number(localStorage.getItem('woui_notifs_seen') || 0))
  const unread = signedRecently.filter((c) => new Date(c.signed_at!).getTime() > lastSeenAt.current).length

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const openNotifs = () => {
    setNotifOpen((v) => !v)
    lastSeenAt.current = Date.now()
    localStorage.setItem('woui_notifs_seen', String(lastSeenAt.current))
  }

  return (
    <header
      className="sticky top-0 z-40 flex min-h-[68px] flex-wrap items-center gap-3 px-[clamp(1rem,4vw,34px)] py-2 sm:gap-7 sm:py-0"
      style={{ background: 'var(--surface-page)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center gap-[11px]">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[3px] p-[6px]"
          style={{ background: 'var(--action-accent)' }}
        >
          <img src={WOUI_LOGO_URL} alt="Woui" className="h-full w-full object-contain" />
        </div>
        <span className="font-display text-[19px]" style={{ color: 'var(--text-primary)' }}>
          Woui
        </span>
      </div>

      <nav className="flex items-center gap-1 sm:ml-[18px]">
        <NavLink
          to="/dashboard"
          className={NAV_ITEM}
          style={({ isActive }) => ({
            background: isActive ? 'var(--surface-card-alt)' : 'transparent',
            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
          })}
        >
          Tableau de bord
        </NavLink>
        <button
          disabled
          title="Bientôt disponible"
          className={`${NAV_ITEM} cursor-not-allowed opacity-45`}
          style={{ color: 'var(--text-muted)' }}
        >
          Statistiques
        </button>
        <NavLink
          to="/settings"
          className={NAV_ITEM}
          style={({ isActive }) => ({
            background: isActive ? 'var(--surface-card-alt)' : 'transparent',
            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
          })}
        >
          Paramètres
        </NavLink>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div
          className="hidden items-center gap-[9px] rounded-[3px] px-[14px] py-2 text-[13px] md:flex"
          style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', minWidth: 220 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          Rechercher un patient
          <span className="font-mono ml-auto text-[11px] opacity-70">⌘K</span>
        </div>

        <button
          onClick={toggle}
          title="Changer de thème"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[3px]"
          style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', background: 'none' }}
        >
          {theme === 'light' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9 6.3 6.3M17.7 17.7l1.4 1.4M19.1 4.9 17.7 6.3M6.3 17.7l-1.4 1.4" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
            </svg>
          )}
        </button>

        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotifs}
            title="Notifications"
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[3px]"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', background: 'none' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {unread > 0 && (
              <span
                className="absolute right-[7px] top-[7px] h-[5px] w-[5px] rounded-full"
                style={{ background: 'var(--garnet-400)' }}
              />
            )}
          </button>
          {notifOpen && (
            <div
              className="absolute right-0 top-[calc(100%+10px)] z-[60] w-80 animate-[nb-rise_0.22s_var(--ease-standard)_both] p-2"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 4, boxShadow: 'var(--shadow-lg)' }}
            >
              <div className="flex items-center justify-between px-3 py-[10px_12px]">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                  Signatures récentes
                </span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--text-accent)' }}>
                  {unread}
                </span>
              </div>
              {signedRecently.length === 0 ? (
                <div className="px-3 py-4 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  Aucune signature récente
                </div>
              ) : (
                signedRecently.map((c) => (
                  <div key={c.id} className="px-3 py-[11px]" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                      {c.patient} a signé son consentement
                    </div>
                    <div className="font-mono mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {c.procedure} — {new Date(c.signed_at!).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {isDashboard && (
          <Button variant="accent" size="sm" onClick={onOpenSendModal}>
            <span className="hidden sm:inline">+ Nouveau consentement</span>
            <span className="sm:hidden">+ Nouveau</span>
          </Button>
        )}

        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => setAvatarOpen((v) => !v)}
            className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full text-[12px]"
            style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            {getInitials(doctor.first_name, doctor.last_name)}
          </button>
          {avatarOpen && (
            <div
              className="absolute right-0 top-[calc(100%+10px)] z-[60] w-44 animate-[nb-rise_0.22s_var(--ease-standard)_both] p-1"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 4, boxShadow: 'var(--shadow-lg)' }}
            >
              <button
                onClick={() => {
                  setAvatarOpen(false)
                  navigate('/settings')
                }}
                className="w-full cursor-pointer rounded-[3px] px-3 py-2 text-left text-[13px]"
                style={{ background: 'none', border: 0, color: 'var(--text-primary)' }}
              >
                Paramètres
              </button>
              <button
                onClick={onSignOut}
                className="w-full cursor-pointer rounded-[3px] px-3 py-2 text-left text-[13px]"
                style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
