import type { Consent } from '../../types'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'

interface ConsentsTableProps {
  consents: Consent[]
  loading: boolean
}

const GRID_COLS = '2fr 2fr 1.4fr 70px 115px 1.4fr'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR') + ' ' + new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function ConsentsTable({ consents, loading }: ConsentsTableProps) {
  return (
    <div className="min-h-[300px] overflow-hidden rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      <div
        className="hidden overflow-x-auto p-[0.65rem_1.1rem] text-[0.7rem] uppercase tracking-[0.8px] md:grid"
        style={{ gridTemplateColumns: GRID_COLS, borderBottom: '1px solid var(--border-color)', color: 'var(--text-dark)' }}
      >
        <span>Patient</span>
        <span>Acte</span>
        <span>Envoyé</span>
        <span>Vidéo</span>
        <span>Statut</span>
        <span>Signé le</span>
      </div>

      {loading ? (
        <Spinner />
      ) : consents.length === 0 ? (
        <div className="p-12 text-center" style={{ color: 'var(--text-dark)' }}>
          Aucun consentement trouvé. Cliquez sur « + Nouveau consentement » pour commencer.
        </div>
      ) : (
        consents.map((c, i) => (
          <div
            key={c.id}
            className="flex flex-col gap-2 p-[0.85rem_1.1rem] md:grid md:items-center md:gap-0"
            style={{
              gridTemplateColumns: GRID_COLS,
              borderBottom: i < consents.length - 1 ? '1px solid var(--bg-input)' : 'none',
            }}
          >
            <div>
              <div className="text-[0.86rem] font-medium" style={{ color: 'var(--text-main)' }}>
                {c.patient}
              </div>
              <div className="text-[0.71rem]" style={{ color: 'var(--text-dark)' }}>
                {c.email}
              </div>
            </div>
            <div className="text-[0.8rem]" style={{ color: 'var(--text-muted)' }}>
              {c.procedure}
            </div>
            <div className="text-[0.78rem]" style={{ color: 'var(--text-dark)' }}>
              {formatDate(c.sent_at)}
            </div>
            <div>
              <div className="h-[5px] w-12 overflow-hidden rounded" style={{ background: 'var(--border-color)' }}>
                <div
                  className="h-full"
                  style={{ background: c.video_progress === 100 ? '#10b981' : '#3b82f6', width: `${c.video_progress}%` }}
                />
              </div>
              <div className="mt-[0.18rem] text-[0.66rem]" style={{ color: 'var(--text-dark)' }}>
                {c.video_progress}%
              </div>
            </div>
            <Badge status={c.status} />
            <div className="text-[0.78rem]" style={{ color: c.signed_at ? '#10b981' : 'var(--border-color)' }}>
              {formatDate(c.signed_at)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
