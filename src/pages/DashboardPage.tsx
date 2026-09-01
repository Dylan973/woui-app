import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Topbar } from '../components/layout/Topbar'
import { StatsGrid } from '../components/dashboard/StatsGrid'
import { FilterBar, type FilterKey } from '../components/dashboard/FilterBar'
import { ConsentsTable } from '../components/dashboard/ConsentsTable'
import { Button } from '../components/ui/Button'
import type { DashboardOutletContext } from '../components/layout/AppLayout'

function TutorialModal({ onClose, doctorFirstName }: { onClose: () => void; doctorFirstName: string }) {
  const steps = [
    { n: 1, text: <>Cliquez sur <b>+ Nouveau consentement</b></> },
    { n: 2, text: "Renseignez l'e-mail du patient et l'acte prévu" },
    { n: 3, text: 'Suivez le statut de lecture et de signature ici-même' },
  ]
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div
        className="max-w-[480px] rounded-[24px] p-[3rem_2.5rem] text-center animate-[fadeIn_0.4s_ease]"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
      >
        <div className="mb-4 text-[55px]">👋</div>
        <h2 className="font-display mb-2 text-[1.8rem]" style={{ color: 'var(--text-main)' }}>
          Bienvenue sur Woui, {doctorFirstName || 'Docteur'} !
        </h2>
        <p className="mb-8 text-[0.95rem] leading-[1.5]" style={{ color: 'var(--text-muted)' }}>
          Simplifiez la signature de vos actes médicaux. Voici comment envoyer votre premier consentement en 3 clics :
        </p>
        <div className="mb-10 rounded-2xl p-6 text-left" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
          {steps.map((s) => (
            <div key={s.n} className="mb-4 flex items-center gap-4 last:mb-0">
              <div
                className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full font-bold"
                style={{ background: 'rgba(14,165,233,0.15)', color: 'var(--accent)' }}
              >
                {s.n}
              </div>
              <div className="text-[0.9rem]" style={{ color: 'var(--text-main)' }}>
                {s.text}
              </div>
            </div>
          ))}
        </div>
        <Button onClick={onClose} className="w-full justify-center">
          J'ai compris, c'est parti ! 🚀
        </Button>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { doctor, consents, consentsLoading, openSendModal } = useOutletContext<DashboardOutletContext>()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('woui_tutorial_seen')) setShowTutorial(true)
  }, [])

  const closeTutorial = () => {
    localStorage.setItem('woui_tutorial_seen', 'true')
    setShowTutorial(false)
  }

  const filtered = useMemo(() => (filter === 'all' ? consents : consents.filter((c) => c.status === filter)), [consents, filter])

  return (
    <>
      <Topbar
        title="Tableau de bord"
        consents={consents}
        action={<Button onClick={openSendModal}>+ Nouveau consentement</Button>}
      />

      <StatsGrid consents={consents} />
      <FilterBar consents={consents} filter={filter} onChange={setFilter} />
      <ConsentsTable consents={filtered} loading={consentsLoading} />

      {showTutorial && <TutorialModal onClose={closeTutorial} doctorFirstName={doctor.first_name ?? ''} />}
    </>
  )
}
