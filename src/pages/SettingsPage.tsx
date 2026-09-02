import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { PLANS, PLAN_LIMITS_LABEL, SURECART_PORTAL_URL } from '../lib/constants'
import type { DashboardOutletContext } from '../components/layout/AppLayout'

type TabId = 'profile' | 'documents' | 'plan' | 'notifications' | 'security'

const TABS: { id: TabId; label: string; soon?: boolean }[] = [
  { id: 'profile', label: 'Profil' },
  { id: 'documents', label: 'Documents PDF', soon: true },
  { id: 'plan', label: 'Abonnement' },
  { id: 'notifications', label: 'Notifications', soon: true },
  { id: 'security', label: 'Sécurité', soon: true },
]

function SoonTag() {
  return (
    <span
      className="font-mono text-[9px] uppercase tracking-[0.1em]"
      style={{ color: 'var(--text-muted)' }}
    >
      Bientôt
    </span>
  )
}

function Eyebrow({ children }: { children: string }) {
  return (
    <div
      className="flex items-center gap-[10px] text-[0.8125rem] font-semibold uppercase"
      style={{ color: 'var(--text-accent)', letterSpacing: 'var(--tracking-eyebrow)' }}
    >
      <span className="h-px w-[18px]" style={{ background: 'currentColor' }} />
      {children}
    </div>
  )
}

export function SettingsPage() {
  const { doctor, consents, showToast } = useOutletContext<DashboardOutletContext>()
  const [tab, setTab] = useState<TabId>('profile')
  const [form, setForm] = useState({
    first_name: doctor.first_name ?? '',
    last_name: doctor.last_name ?? '',
    specialty: doctor.specialty ?? '',
    phone: doctor.phone ?? '',
  })
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('doctors')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', doctor.id)
    setSaving(false)
    showToast(error ? `Erreur : ${error.message}` : 'Profil enregistré', error ? 'warning' : 'success')
  }

  const plan = PLANS.find((p) => p.id === doctor.plan) ?? PLANS[0]
  const limit = plan.limits.consents
  const pct = Math.min(100, Math.round((consents.length / (limit >= 999999 ? 100 : limit)) * 100))

  const soonTitle = { documents: 'Documents PDF', notifications: 'Notifications', security: 'Sécurité' }[tab as string]

  return (
    <section className="max-w-[1100px]" style={{ animation: 'nb-rise 0.5s var(--ease-standard) both' }}>
      <Eyebrow>Compte</Eyebrow>
      <h1 className="font-display my-4 text-[clamp(1.6rem,3.5vw,40px)]" style={{ color: 'var(--text-primary)' }}>
        Paramètres
      </h1>

      <div className="mb-9 flex flex-wrap gap-1">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex flex-shrink-0 items-center gap-[9px] px-4 py-[10px] text-[0.9375rem]"
              style={{
                background: active ? 'var(--surface-card-alt)' : 'none',
                border: 'none',
                borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                borderRadius: 3,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {t.label}
              {t.soon && <SoonTag />}
            </button>
          )
        })}
      </div>

      {tab === 'profile' && (
        <div
          className="p-[clamp(1.5rem,4vw,36px)]"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4, animation: 'nb-rise 0.35s var(--ease-standard) both' }}
        >
          <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
            Informations du praticien
          </h2>
          <p className="mb-[30px] mt-[6px] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            Ces informations apparaissent sur chaque consentement envoyé.
          </p>
          <div className="grid max-w-[700px] gap-x-[26px] md:grid-cols-2">
            <Input label="Prénom" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="Bernard" />
            <Input label="Nom" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Lefèvre" />
            <Input
              label="Spécialité"
              value={form.specialty}
              onChange={(e) => set('specialty', e.target.value)}
              placeholder="Chirurgien-dentiste"
            />
            <Input label="Téléphone" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+33 5 58 00 00 00" />
          </div>
          <div className="mt-[10px] flex items-center gap-5">
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Sauvegarder'}
            </Button>
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              {doctor.email} — non modifiable
            </span>
          </div>
        </div>
      )}

      {tab === 'plan' && (
        <div style={{ animation: 'nb-rise 0.35s var(--ease-standard) both' }}>
          <div
            className="mb-[22px] p-[28px_32px]"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                  Plan actuel
                </div>
                <div className="font-display mt-2 text-[26px]" style={{ color: 'var(--text-primary)' }}>
                  {plan.name} — {plan.price} € / mois
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-[26px]" style={{ color: 'var(--text-primary)' }}>
                  {consents.length} <span className="text-[17px]" style={{ color: 'var(--text-muted)' }}>/ {PLAN_LIMITS_LABEL(limit)}</span>
                </div>
                <div className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  consentements ce mois
                </div>
              </div>
            </div>
            <div className="mt-5 h-[3px]" style={{ background: 'var(--border-subtle)' }}>
              <div
                className="h-full origin-left"
                style={{ width: `${pct}%`, background: 'var(--action-accent)', animation: 'nb-grow 1s var(--ease-standard) 0.2s both' }}
              />
            </div>
          </div>

          <div className="grid gap-[22px] sm:grid-cols-3">
            {PLANS.map((p) => {
              const isCurrent = p.id === doctor.plan
              return (
                <div
                  key={p.id}
                  className="relative flex flex-col gap-[18px] p-[28px]"
                  style={{
                    background: 'var(--surface-card)',
                    border: `1px solid ${isCurrent ? 'var(--action-accent)' : 'var(--border-subtle)'}`,
                    borderRadius: 4,
                  }}
                >
                  {isCurrent && (
                    <span
                      className="font-mono absolute right-0 top-0 px-[10px] py-[5px] text-[10px] uppercase tracking-[0.12em]"
                      style={{ background: 'var(--action-accent)', color: 'var(--action-accent-text)' }}
                    >
                      Actuel
                    </span>
                  )}
                  <div>
                    <div
                      className="font-mono text-[11px] uppercase tracking-[0.1em]"
                      style={{ color: isCurrent ? 'var(--text-accent)' : 'var(--text-muted)' }}
                    >
                      {p.name}
                    </div>
                    <div className="font-display mt-[10px] text-[38px]" style={{ color: 'var(--text-primary)' }}>
                      {p.price} €
                    </div>
                    <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      par mois
                    </div>
                  </div>
                  <div
                    className="flex flex-col gap-2 pt-[18px] text-[0.9375rem]"
                    style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                  >
                    {p.features.slice(0, 5).map((f) => (
                      <span key={f}>{f}</span>
                    ))}
                  </div>
                  <div className="mt-auto">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full cursor-not-allowed rounded-[3px] py-[10px] text-[0.8125rem]"
                        style={{ background: 'var(--surface-card-alt)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                      >
                        Plan actuel
                      </button>
                    ) : (
                      <a
                        href={SURECART_PORTAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full rounded-[3px] py-[10px] text-center text-[0.8125rem] font-semibold"
                        style={{ background: 'var(--action-primary)', color: 'var(--action-primary-text)' }}
                      >
                        Changer →
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-5 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
            La gestion de l'abonnement se fait via le portail client SureCart.
          </p>
        </div>
      )}

      {soonTitle && (
        <div
          className="p-[64px_40px] text-center"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4, animation: 'nb-rise 0.35s var(--ease-standard) both' }}
        >
          <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-accent)' }}>
            Bientôt
          </div>
          <h2 className="font-display my-[14px] text-[24px]" style={{ color: 'var(--text-primary)' }}>
            {soonTitle}
          </h2>
          <p className="text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            Cette section arrive dans une prochaine version de Woui.
          </p>
        </div>
      )}
    </section>
  )
}
