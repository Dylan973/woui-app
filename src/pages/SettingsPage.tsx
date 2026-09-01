import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Topbar } from '../components/layout/Topbar'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { PLANS, PLAN_LIMITS_LABEL, SURECART_PORTAL_URL } from '../lib/constants'
import type { DashboardOutletContext } from '../components/layout/AppLayout'

type TabId = 'profile' | 'documents' | 'plan' | 'notifications' | 'security'

const TABS: { id: TabId; label: string; icon: string; soon?: boolean }[] = [
  { id: 'profile', label: 'Profil', icon: '👤' },
  { id: 'documents', label: 'Documents PDF', icon: '📄', soon: true },
  { id: 'plan', label: 'Abonnement', icon: '⭐' },
  { id: 'notifications', label: 'Notifications', icon: '🔔', soon: true },
  { id: 'security', label: 'Sécurité', icon: '🔒', soon: true },
]

function SoonBadge() {
  return (
    <span
      className="ml-auto rounded-full px-[0.4rem] py-[0.1rem] text-[0.62rem] font-bold uppercase tracking-wide"
      style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}
    >
      Bientôt
    </span>
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
    showToast(error ? `Erreur : ${error.message}` : 'Profil enregistré ✅', error ? 'warning' : 'success')
  }

  const plan = PLANS.find((p) => p.id === doctor.plan) ?? PLANS[0]
  const limit = plan.limits.consents
  const pct = Math.min(100, Math.round((consents.length / (limit >= 999999 ? 100 : limit)) * 100))

  return (
    <div className="mx-auto max-w-[900px]">
      <Topbar title="Paramètres" />

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Tab sidebar */}
        <div className="flex gap-2 overflow-x-auto md:w-[195px] md:flex-shrink-0 md:flex-col md:gap-1 md:overflow-visible">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex flex-shrink-0 items-center gap-[0.6rem] rounded-[10px] px-[0.85rem] py-[0.65rem] text-left text-[0.86rem] transition-all"
                style={{
                  background: active ? 'var(--hover-bg)' : 'none',
                  border: `1px solid ${active ? 'rgba(14,165,233,0.3)' : 'transparent'}`,
                  color: active ? '#38bdf8' : 'var(--text-dark)',
                }}
              >
                <span>{t.icon}</span>
                {t.label}
                {t.soon && <SoonBadge />}
              </button>
            )
          })}
        </div>

        {/* Content panel */}
        <div className="flex-1">
          {tab === 'profile' && (
            <div className="rounded-[18px] p-7" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <h3 className="font-display mb-6 text-[1.15rem]" style={{ color: 'var(--text-main)' }}>
                Informations du praticien
              </h3>
              <div className="grid gap-x-5 md:grid-cols-2">
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
              <div className="mb-[1.1rem] text-[0.75rem]" style={{ color: 'var(--text-dark)' }}>
                Email : {doctor.email} (non modifiable)
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Enregistrement...' : '💾 Sauvegarder'}
              </Button>
            </div>
          )}

          {tab === 'documents' && (
            <div className="rounded-[18px] p-7 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              📄 Gestion des modèles PDF disponible prochainement.
            </div>
          )}

          {tab === 'plan' && (
            <div>
              <div className="mb-5 rounded-[18px] p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="mb-4 flex justify-between">
                  <div>
                    <div className="text-[0.72rem] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Plan actuel
                    </div>
                    <div className="font-display mt-1 text-[1.3rem]" style={{ color: plan.accent }}>
                      {plan.name} — {plan.price}€/mois
                    </div>
                  </div>
                </div>
                <div className="mb-2 flex justify-between">
                  <span className="text-[0.8rem]" style={{ color: 'var(--text-muted)' }}>
                    Consentements ce mois
                  </span>
                  <span className="text-[0.8rem] font-semibold" style={{ color: pct > 80 ? '#ef4444' : 'var(--text-main)' }}>
                    {consents.length} / {PLAN_LIMITS_LABEL(limit)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-md" style={{ background: 'var(--border-color)' }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${pct}%`,
                      background: pct > 80 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : `linear-gradient(90deg,${plan.color},${plan.accent})`,
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {PLANS.map((p) => {
                  const isCurrent = p.id === doctor.plan
                  return (
                    <div
                      key={p.id}
                      className="relative rounded-[18px] p-6"
                      style={{ background: isCurrent ? `${p.color}0e` : 'var(--bg-card)', border: `2px solid ${isCurrent ? p.color : 'var(--border-color)'}` }}
                    >
                      {isCurrent && (
                        <div
                          className="absolute left-1/2 top-[-11px] -translate-x-1/2 rounded-full px-3 py-[0.18rem] text-[0.68rem] font-bold text-white"
                          style={{ background: p.color }}
                        >
                          ✓ ACTUEL
                        </div>
                      )}
                      <div className="font-display mb-1 text-[1.1rem]" style={{ color: p.accent }}>
                        {p.name}
                      </div>
                      <div className="mb-4">
                        <span className="text-[1.9rem] font-bold" style={{ color: 'var(--text-main)' }}>
                          {p.price}€
                        </span>
                      </div>
                      <div className="mb-4 flex flex-col gap-2">
                        {p.features.map((f) => (
                          <div key={f} className="text-[0.77rem]" style={{ color: 'var(--text-muted)' }}>
                            <span style={{ color: p.accent }}>✓</span> {f}
                          </div>
                        ))}
                      </div>
                      {isCurrent ? (
                        <button
                          disabled
                          className="w-full cursor-not-allowed rounded-[10px] py-[0.6rem] text-[0.82rem]"
                          style={{ background: `${p.color}20`, border: `1px solid ${p.color}40`, color: p.accent }}
                        >
                          Plan actuel
                        </button>
                      ) : (
                        <a
                          href={SURECART_PORTAL_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full rounded-[10px] py-[0.6rem] text-center text-[0.82rem] font-semibold text-white"
                          style={{ background: `linear-gradient(135deg,${p.color},${p.accent})` }}
                        >
                          Changer →
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-4 text-center text-[0.78rem]" style={{ color: 'var(--text-dark)' }}>
                La gestion de l'abonnement se fait via le portail client SureCart.
              </p>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="rounded-[18px] p-7" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              Préférences de notifications disponibles prochainement.
            </div>
          )}
          {tab === 'security' && (
            <div className="rounded-[18px] p-7" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              Options de sécurité disponibles prochainement.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
