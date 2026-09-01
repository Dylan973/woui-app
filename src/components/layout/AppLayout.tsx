import { useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { SendModal } from '../dashboard/SendModal'
import { Toast, type ToastType } from '../ui/Toast'
import { Spinner } from '../ui/Spinner'
import { useConsents } from '../../hooks/useConsents'
import { PLANS } from '../../lib/constants'
import type { Doctor } from '../../types'

export interface DashboardOutletContext {
  doctor: Doctor
  consents: ReturnType<typeof useConsents>['consents']
  consentsLoading: boolean
  refetchConsents: () => Promise<void>
  openSendModal: () => void
  showToast: (msg: string, type?: ToastType) => void
}

interface AppLayoutProps {
  doctor: Doctor | null
  authLoading: boolean
  onSignOut: () => Promise<void>
}

export function AppLayout({ doctor, authLoading, onSignOut }: AppLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [showSend, setShowSend] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null)

  const { consents, loading: consentsLoading, sendConsent, refetch } = useConsents(doctor?.id ?? null)

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <Spinner />
      </div>
    )
  }

  if (!doctor) {
    // Authentifié côté Supabase Auth mais aucune fiche `doctors` associée.
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
        <div className="text-5xl">🩺</div>
        <h1 className="font-display text-xl">Profil praticien introuvable</h1>
        <p className="max-w-sm text-sm" style={{ color: 'var(--text-muted)' }}>
          Votre compte est authentifié mais aucune fiche praticien n'est associée. Contactez le support Woui.
        </p>
        <button
          onClick={() => onSignOut().then(() => navigate('/login'))}
          className="cursor-pointer rounded-lg px-4 py-2 text-sm text-white"
          style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}
        >
          Se déconnecter
        </button>
      </div>
    )
  }

  const plan = PLANS.find((p) => p.id === doctor.plan) ?? PLANS[0]
  const showToast = (msg: string, type: ToastType = 'success') => setToast({ msg, type })

  const outletContext: DashboardOutletContext = {
    doctor,
    consents,
    consentsLoading,
    refetchConsents: refetch,
    openSendModal: () => setShowSend(true),
    showToast,
  }

  const bottomNav = [
    { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { to: '__new__', icon: '➕', label: 'Nouveau' },
    { to: '/settings', icon: '⚙️', label: 'Réglages' },
  ]

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar doctor={doctor} plan={plan} consentsUsed={consents.length} onSignOut={() => onSignOut().then(() => navigate('/login'))} />

      <main className="flex-1 overflow-y-auto p-7 pb-24 md:pb-7">
        <Outlet context={outletContext} />
      </main>

      {/* Bottom nav mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around p-2 md:hidden"
        style={{ background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border-light)' }}
      >
        {bottomNav.map((item) => {
          const isNew = item.to === '__new__'
          const active = !isNew && location.pathname === item.to
          return (
            <button
              key={item.label}
              onClick={() => (isNew ? setShowSend(true) : navigate(item.to))}
              className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[0.65rem]"
              style={{ color: active ? '#38bdf8' : 'var(--text-muted)' }}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      {showSend && (
        <SendModal
          onClose={() => setShowSend(false)}
          onSend={async (form) => {
            const result = await sendConsent(form)
            if (!result.error) showToast(`Lien envoyé à ${form.patient}`)
            return result
          }}
          planId={doctor.plan}
          used={consents.length}
          limit={plan.limits.consents}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}

/** Redirige vers /login si non authentifié — utilisé au niveau de la route parente. */
export function RequireAuthRedirect({ isAuthed }: { isAuthed: boolean }) {
  if (!isAuthed) return <Navigate to="/login" replace />
  return <Outlet />
}
