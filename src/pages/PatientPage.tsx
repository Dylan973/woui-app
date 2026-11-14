import { useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { supabase } from '../lib/supabase'
import { formatBirthDate } from '../hooks/usePatients'
import { formatAppointment } from '../lib/consentTiming'
import { profileName } from '../lib/profiles'
import type { DashboardOutletContext } from '../components/layout/AppLayout'
import type { Consent } from '../types'

const card = { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }

const KIND_TAGS = (c: Consent) =>
  [
    c.kind === 'consent' || c.kind === 'both' ? 'Consentement' : null,
    c.kind === 'quote' || c.kind === 'both' ? 'Devis' : null,
    c.kind === 'postop' || c.with_postop ? 'Conseils post-op' : null,
  ].filter(Boolean) as string[]

const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/** Fiche patient : coordonnées et tous les envois du patient (plusieurs interventions dans l'année). */
export function PatientPage() {
  const { id } = useParams<{ id: string }>()
  const { patients, consents, openSendModal, showToast, profileOf, profilesEnabled } = useOutletContext<DashboardOutletContext>()
  const patient = patients.find((p) => p.id === id) ?? null
  const sends = useMemo(
    () => consents.filter((c) => c.patient_id === id).sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()),
    [consents, id]
  )
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ birth_date: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [local, setLocal] = useState<typeof form | null>(null)

  if (!patient) {
    return (
      <section className="max-w-[900px]">
        <Link to="/dashboard" className="text-[0.875rem]" style={{ color: 'var(--text-accent)' }}>
          ← Tableau de bord
        </Link>
        <p className="mt-6 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
          Fiche patient introuvable.
        </p>
      </section>
    )
  }

  const info = { birth_date: patient.birth_date ?? '', email: patient.email ?? '', phone: patient.phone ?? '', ...(local ?? {}) }

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('patients')
      .update({ birth_date: form.birth_date || null, email: form.email.trim() || null, phone: form.phone.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', patient.id)
    setSaving(false)
    if (error) {
      showToast('La fiche n’a pas pu être enregistrée.', 'warning')
      return
    }
    setLocal(form)
    setEditing(false)
    showToast('Fiche patient enregistrée', 'success')
  }

  const download = async (c: Consent, doc: 'consent' | 'quote') => {
    const path = doc === 'quote' ? c.quote_pdf_url : c.pdf_url
    if (!path) return
    const { data, error } = await supabase.storage.from('consents').createSignedUrl(path, 60, {
      download: `${doc === 'quote' ? 'devis' : 'consentement'}-${c.patient.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    })
    if (error || !data?.signedUrl) {
      showToast('Le PDF est momentanément indisponible. Réessayez dans un instant.', 'warning')
      return
    }
    window.location.assign(data.signedUrl)
  }

  return (
    <section className="max-w-[1000px]" style={{ animation: 'nb-rise 0.4s var(--ease-standard) both' }}>
      <Link to="/dashboard" className="text-[0.875rem]" style={{ color: 'var(--text-accent)' }}>
        ← Tableau de bord
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-accent)' }}>
            Fiche patient
          </div>
          <h1 className="font-display mt-2 text-[clamp(1.6rem,3.5vw,36px)]" style={{ color: 'var(--text-primary)' }}>
            {patient.full_name}
          </h1>
        </div>
        <Button variant="primary" onClick={() => openSendModal({ ...patient, ...{ birth_date: info.birth_date || null, email: info.email || null, phone: info.phone || null } })}>
          + Nouvel envoi pour ce patient
        </Button>
      </div>

      <div className="mt-6 p-[clamp(1.25rem,3vw,28px)]" style={card}>
        {editing ? (
          <>
            <div className="grid gap-x-5 md:grid-cols-3">
              <Input label="Date de naissance" type="date" value={form.birth_date} onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <Input label="Téléphone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.slice(0, 24) }))} />
            </div>
            <div className="flex gap-3">
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            {[
              ['Date de naissance', info.birth_date ? formatBirthDate(info.birth_date) : 'À compléter'],
              ['Email', info.email || '—'],
              ['Téléphone', info.phone || '—'],
              ['Envois', String(sends.length)],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </div>
                <div className="mt-1 text-[0.9375rem] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {label === 'Téléphone' && info.phone ? (
                    <a href={`tel:${info.phone.replace(/[^0-9+]/g, '')}`} style={{ color: 'inherit' }}>
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setForm(info)
                setEditing(true)
              }}
              className="ml-auto cursor-pointer text-[13px]"
              style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}
            >
              Modifier
            </button>
          </div>
        )}
      </div>

      <h2 className="font-display mb-4 mt-9 text-[22px]" style={{ color: 'var(--text-primary)' }}>
        Envois
      </h2>
      {sends.length === 0 ? (
        <p className="text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
          Aucun envoi visible avec ce profil.
        </p>
      ) : (
        <ul className="m-0 flex flex-col gap-3 p-0" style={{ listStyle: 'none' }}>
          {sends.map((c) => {
            const partial = c.status !== 'signed' && c.kind === 'both' && (c.quote_signed_at || c.consent_signed_at)
            return (
              <li key={c.id} className="p-[18px_22px]" style={card}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[0.9375rem] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {c.kind === 'quote' ? (c.quote_name ?? 'Devis') : c.procedure}
                  </span>
                  {KIND_TAGS(c).map((t) => (
                    <span key={t} className="rounded-[3px] px-[6px] py-[2px] text-[11px]" style={{ background: 'var(--surface-card-alt)', color: 'var(--text-accent)' }}>
                      {t}
                    </span>
                  ))}
                  <span className="ml-auto">
                    {partial ? (
                      <span
                        className="inline-flex items-center rounded-full px-[10px] py-1 text-[11px] font-medium"
                        style={{ background: 'var(--status-signed-bg, rgba(63,199,154,.14))', color: 'var(--status-signed-text)' }}
                      >
                        {c.quote_signed_at ? 'Devis signé' : 'Consentement signé'}
                      </span>
                    ) : (
                      <Badge status={c.status} />
                    )}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  <span>Envoyé le {date(c.sent_at)}</span>
                  {c.appointment_at && <span>RDV {formatAppointment(c.appointment_at)}</span>}
                  {c.quote_signed_at && <span>Devis signé le {date(c.quote_signed_at)}</span>}
                  {c.consent_signed_at && <span>Consentement signé le {date(c.consent_signed_at)}</span>}
                  {profilesEnabled && <span>Par {profileName(profileOf(c.practitioner_id))}</span>}
                </div>
                {(c.pdf_url || c.quote_pdf_url) && (
                  <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
                    {c.pdf_url && (
                      <button type="button" onClick={() => download(c, 'consent')} className="cursor-pointer" style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}>
                        ↓ Consentement signé
                      </button>
                    )}
                    {c.quote_pdf_url && (
                      <button type="button" onClick={() => download(c, 'quote')} className="cursor-pointer" style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}>
                        ↓ Devis signé
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
