import { useState } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Header } from './Header'
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
  const navigate = useNavigate()
  const [showSend, setShowSend] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null)

  const { consents, loading: consentsLoading, sendConsent, refetch } = useConsents(doctor?.id ?? null)

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--surface-page)' }}>
        <Spinner />
      </div>
    )
  }

  if (!doctor) {
    // Authentifié côté Supabase Auth mais aucune fiche `doctors` associée.
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
        style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}
      >
        <div className="text-5xl">🩺</div>
        <h1 className="font-display text-xl">Profil praticien introuvable</h1>
        <p className="max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
          Votre compte est authentifié mais aucune fiche praticien n'est associée. Contactez le support Woui.
        </p>
        <button
          onClick={() => onSignOut().then(() => navigate('/login'))}
          className="cursor-pointer rounded-[3px] px-4 py-2 text-sm"
          style={{ background: 'var(--action-accent)', color: 'var(--action-accent-text)', border: 'none' }}
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', color: 'var(--text-primary)' }}>
      <Header doctor={doctor} consents={consents} onOpenSendModal={() => setShowSend(true)} onSignOut={() => onSignOut().then(() => navigate('/login'))} />

      <main style={{ padding: '40px 34px 90px', maxWidth: 1520, margin: '0 auto' }} className="!px-[clamp(1rem,4vw,34px)]">
        <Outlet context={outletContext} />
      </main>

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
