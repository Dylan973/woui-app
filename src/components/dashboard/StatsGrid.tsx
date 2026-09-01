import type { Consent } from '../../types'

interface StatsGridProps {
  consents: Consent[]
}

export function StatsGrid({ consents }: StatsGridProps) {
  const stats = [
    { label: 'Envoyés', value: consents.length, icon: '📤', color: 'var(--text-muted)' },
    { label: 'En attente', value: consents.filter((c) => ['sent', 'opened'].includes(c.status)).length, icon: '⏳', color: '#f59e0b' },
    { label: 'Visionnés', value: consents.filter((c) => c.status === 'viewed').length, icon: '▶', color: '#3b82f6' },
    { label: 'Signés', value: consents.filter((c) => c.status === 'signed').length, icon: '✅', color: '#10b981' },
  ]

  return (
    <div className="mb-7 grid grid-cols-2 gap-[0.9rem] md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl p-[1.1rem]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="mb-[0.45rem] text-2xl">{s.icon}</div>
          <div className="font-display text-[1.85rem] font-bold" style={{ color: s.color }}>
            {s.value}
          </div>
          <div className="mt-[0.18rem] text-[0.76rem]" style={{ color: 'var(--text-dark)' }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}
