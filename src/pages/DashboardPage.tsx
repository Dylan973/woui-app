import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import type { DashboardOutletContext } from '../components/layout/AppLayout'
import type { Consent, ConsentStatus } from '../types'

type FilterKey = 'all' | ConsentStatus

const FILTERS: [FilterKey, string][] = [
  ['all', 'Tous'],
  ['sent', 'Envoyés'],
  ['opened', 'Ouverts'],
  ['viewed', 'Visionnés'],
  ['signed', 'Signés'],
]

/** Étape 1→4 dans le cycle de vie d'un consentement, pour la timeline de la carte. */
function statusStep(status: ConsentStatus): number {
  return { sent: 1, opened: 2, viewed: 3, signed: 4 }[status]
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return (
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    ' · ' +
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  )
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.round(diffMs / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'hier' : `il y a ${d} j`
}

function lastEventDate(c: Consent): string {
  return c.signed_at ?? c.viewed_at ?? c.opened_at ?? c.sent_at
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

export function DashboardPage() {
  const { consents, consentsLoading, showToast } = useOutletContext<DashboardOutletContext>()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sortDesc, setSortDesc] = useState(true)
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('woui_tutorial_seen')) setShowTutorial(true)
  }, [])

  const closeTutorial = () => {
    localStorage.setItem('woui_tutorial_seen', 'true')
    setShowTutorial(false)
  }

  const pending = useMemo(() => consents.filter((c) => c.status === 'sent' || c.status === 'opened'), [consents])
  const overdue = useMemo(
    () => pending.filter((c) => Date.now() - new Date(c.sent_at).getTime() > 48 * 3600 * 1000).length,
    [pending]
  )
  const viewedOrMore = useMemo(() => consents.filter((c) => c.status === 'viewed' || c.status === 'signed'), [consents])
  const signedCount = consents.filter((c) => c.status === 'signed').length
  const viewRate = consents.length > 0 ? Math.round((viewedOrMore.length / consents.length) * 100) : 0
  const signRate = consents.length > 0 ? Math.round((signedCount / consents.length) * 100) : 0
  const medianSignMinutes = useMemo(() => {
    const durations = consents
      .filter((c) => c.signed_at)
      .map((c) => (new Date(c.signed_at!).getTime() - new Date(c.sent_at).getTime()) / 60000)
    return median(durations)
  }, [consents])

  const stats = [
    { label: 'Envoyés', value: consents.length, sub: 'consentements au total' },
    { label: 'En attente', value: pending.length, sub: overdue > 0 ? `dont ${overdue} > 48 h` : 'tout est à jour', accent: true },
    { label: 'Visionnés', value: viewedOrMore.length, sub: `${viewRate} % de lecture` },
    { label: 'Signés', value: signedCount, sub: signRate > 0 ? `${signRate} % de signature` : '—' },
  ]

  const filtered = useMemo(() => (filter === 'all' ? consents : consents.filter((c) => c.status === filter)), [consents, filter])
  const rows = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const ta = new Date(a.sent_at).getTime()
        const tb = new Date(b.sent_at).getTime()
        return sortDesc ? tb - ta : ta - tb
      }),
    [filtered, sortDesc]
  )

  return (
    <div style={{ animation: 'nb-rise 0.5s var(--ease-standard) both' }}>
      {/* ── Hero + stats ── */}
      <div className="grid gap-[26px] lg:grid-cols-[1.35fr_1fr]">
        <div
          className="relative overflow-hidden p-[clamp(1.5rem,4vw,36px)]"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
        >
          <div
            className="pointer-events-none absolute -right-[60px] -top-[80px] h-[260px] w-[260px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(108,92,231,0.18), transparent 70%)' }}
          />
          <div
            className="flex items-center gap-[10px] text-[0.8125rem] font-semibold uppercase"
            style={{ color: 'var(--text-accent)', letterSpacing: 'var(--tracking-eyebrow)' }}
          >
            <span className="h-px w-[18px]" style={{ background: 'currentColor' }} />
            À traiter maintenant
          </div>
          <h1
            className="font-display mt-[18px] max-w-[18ch] text-[clamp(1.6rem,3.5vw,40px)]"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
          >
            {pending.length > 0 ? `${pending.length} patient${pending.length > 1 ? 's' : ''} attendent votre relance` : 'Tout est à jour, aucune relance à faire'}
          </h1>
          <p className="my-4 max-w-[46ch] text-[1.0625rem] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
            {pending.length > 0
              ? `${overdue > 0 ? `${overdue} d'entre eux ont reçu leur lien il y a plus de 48 heures. ` : ''}Une relance groupée part en un clic.`
              : 'Tous les consentements envoyés ont été ouverts ou signés.'}
          </p>
          {pending.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={() => showToast('La relance groupée par email arrive prochainement.', 'info')}
              >
                Relancer les {pending.length} patient{pending.length > 1 ? 's' : ''}
              </Button>
              <Button variant="ghost" onClick={() => setFilter('sent')}>
                Voir le détail
              </Button>
            </div>
          )}
        </div>

        <div
          className="grid grid-cols-2 gap-px overflow-hidden"
          style={{ background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
        >
          {stats.map((s) => (
            <div key={s.label} className="p-[26px_26px_22px]" style={{ background: 'var(--surface-card)' }}>
              <div
                className="font-mono text-[11px] uppercase tracking-[0.1em]"
                style={{ color: s.accent ? 'var(--text-accent)' : 'var(--text-muted)' }}
              >
                {s.label}
              </div>
              <div
                className="font-display tabular-nums my-[10px] text-[44px] font-semibold"
                style={{ color: s.accent ? 'var(--text-accent)' : 'var(--text-primary)' }}
              >
                {s.value}
              </div>
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {medianSignMinutes !== null && (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Délai médian entre l'envoi et la signature :{' '}
          <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
            {medianSignMinutes < 60 ? `${medianSignMinutes} min` : `${Math.round(medianSignMinutes / 60)} h`}
          </span>
        </p>
      )}

      {/* ── Filtres + tri ── */}
      <div className="my-[28px] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([key, label]) => {
            const active = filter === key
            const count = key === 'all' ? consents.length : consents.filter((c) => c.status === key).length
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="font-mono cursor-pointer rounded-[3px] px-[14px] py-[6px] text-[12px]"
                style={{
                  background: active ? 'var(--action-primary)' : 'transparent',
                  color: active ? 'var(--action-primary-text)' : 'var(--text-muted)',
                  border: active ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                {label} {count}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setSortDesc((v) => !v)}
          className="flex items-center gap-2 text-[0.8125rem]"
          style={{ background: 'none', border: 0, color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M7 4v16M7 20l-3-3M17 20V4M17 4l3 3" />
          </svg>
          {sortDesc ? 'Plus récents' : 'Plus anciens'}
        </button>
      </div>

      {/* ── Liste des consentements ── */}
      {consentsLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div
          className="p-12 text-center"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-muted)' }}
        >
          Aucun consentement trouvé. Cliquez sur « + Nouveau consentement » pour commencer.
        </div>
      ) : (
        <div className="grid gap-[18px] md:grid-cols-2">
          {rows.map((c) => {
            const step = statusStep(c.status)
            return (
              <article
                key={c.id}
                className="grid grid-cols-[26px_1fr] gap-5 p-[24px_26px] transition-colors"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
              >
                <div className="flex flex-col items-center pt-[6px]">
                  {[0, 1, 2, 3].map((i) => {
                    const done = i < step
                    const isLast = i === step - 1
                    const dotColor = done ? (isLast ? 'var(--mint)' : 'var(--text-primary)') : 'transparent'
                    const ringColor = done ? (isLast ? 'var(--mint)' : 'var(--text-primary)') : 'var(--border-default)'
                    const railColor = i < step - 1 ? 'var(--text-primary)' : 'var(--border-subtle)'
                    return (
                      <div key={i} className="flex flex-col items-center">
                        <span
                          className="h-[9px] w-[9px] rounded-full"
                          style={{ border: `1px solid ${ringColor}`, background: dotColor }}
                        />
                        {i < 3 && <span className="w-px" style={{ height: 26, background: railColor }} />}
                      </div>
                    )
                  })}
                </div>

                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[17px] font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                        {c.patient}
                      </div>
                      <div className="mt-[3px] text-[13px]" style={{ color: 'var(--text-muted)' }}>
                        {c.email}
                      </div>
                    </div>
                    <Badge status={c.status} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-[26px] text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                    <div>
                      <div className="font-mono mb-[5px] text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                        Acte
                      </div>
                      {c.procedure}
                    </div>
                    <div>
                      <div className="font-mono mb-[5px] text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                        Envoyé
                      </div>
                      <span className="font-mono">{formatShortDate(c.sent_at)}</span>
                    </div>
                    <div className="ml-auto min-w-[90px]">
                      <div className="font-mono mb-2 text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                        Vidéo {c.video_progress}%
                      </div>
                      <div className="h-[2px]" style={{ background: 'var(--border-subtle)' }}>
                        <div className="h-full" style={{ width: `${c.video_progress}%`, background: 'var(--mint)' }} />
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-5 flex items-center gap-[18px] pt-4"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  >
                    {c.status === 'signed' ? (
                      c.pdf_url ? (
                        <a
                          href={c.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[0.8125rem]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Télécharger le PDF
                        </a>
                      ) : (
                        <span className="text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>
                          PDF en préparation
                        </span>
                      )
                    ) : (
                      <button
                        onClick={() => showToast(`Relance envoyée à ${c.patient} (fonctionnalité à venir).`, 'info')}
                        className="cursor-pointer text-[0.8125rem]"
                        style={{ background: 'none', border: 0, color: 'var(--text-secondary)' }}
                      >
                        Relancer
                      </button>
                    )}
                    <span className="font-mono ml-auto text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {c.status === 'signed' ? 'signé ' : c.status === 'viewed' ? 'vu ' : c.status === 'opened' ? 'ouvert ' : 'envoyé '}
                      {formatRelative(lastEventDate(c))}
                    </span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {showTutorial && <TutorialModal onClose={closeTutorial} />}
    </div>
  )
}

function TutorialModal({ onClose }: { onClose: () => void }) {
  const steps = [
    { n: 1, text: <>Cliquez sur <b>+ Nouveau consentement</b></> },
    { n: 2, text: "Renseignez l'e-mail du patient et l'acte prévu" },
    { n: 3, text: 'Suivez le statut de lecture et de signature ici-même' },
  ]
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'var(--surface-overlay)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="max-w-[480px] p-[3rem_2.5rem] text-center"
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--accent)',
          borderRadius: 4,
          boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
          animation: 'nb-rise 0.4s var(--ease-standard) both',
        }}
      >
        <div
          className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full"
          style={{ background: 'var(--surface-card-alt)' }}
        >
          <span className="text-2xl">👋</span>
        </div>
        <h2 className="font-display mb-2 text-[1.6rem]" style={{ color: 'var(--text-primary)' }}>
          Bienvenue sur Woui !
        </h2>
        <p className="mb-8 text-[0.9375rem] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
          Simplifiez la signature de vos actes médicaux. Voici comment envoyer votre premier consentement en 3 clics :
        </p>
        <div
          className="mb-9 p-6 text-left"
          style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
        >
          {steps.map((s) => (
            <div key={s.n} className="mb-4 flex items-center gap-4 last:mb-0">
              <div
                className="font-mono flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[12px]"
                style={{ background: 'var(--action-accent)', color: 'var(--action-accent-text)' }}
              >
                {s.n}
              </div>
              <div className="text-[0.9375rem]" style={{ color: 'var(--text-primary)' }}>
                {s.text}
              </div>
            </div>
          ))}
        </div>
        <Button variant="primary" onClick={onClose} className="w-full justify-center">
          J'ai compris, c'est parti
        </Button>
      </div>
    </div>
  )
}
