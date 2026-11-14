import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { RppsBadge } from '../profiles/RppsBadge'
import { CabinetIdentity } from './CabinetIdentity'
import { PRACTITIONER_FUNCTIONS } from '../../lib/profiles'
import { supabase } from '../../lib/supabase'
import type { Doctor, Profile } from '../../types'
import type { DashboardOutletContext } from '../layout/AppLayout'

const card = { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }

/** Gestion du cabinet > Profil : coordonnées du cabinet (SIRET, adresse, téléphone), nom et logo. */
export function CabinetInfoCard({
  doctor,
  refetchDoctor,
  showToast,
  onSeePlans,
}: {
  doctor: Doctor
  refetchDoctor: () => Promise<void>
  showToast: DashboardOutletContext['showToast']
  onSeePlans: () => void
}) {
  const [address, setAddress] = useState(doctor.address ?? '')
  const [phone, setPhone] = useState(doctor.phone ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('doctors')
      .update({ address: address.trim() || null, phone: phone.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', doctor.id)
    if (!error) await refetchDoctor()
    setSaving(false)
    showToast(error ? 'Les coordonnées n’ont pas pu être enregistrées.' : 'Coordonnées du cabinet enregistrées', error ? 'warning' : 'success')
  }

  return (
    <div className="p-[clamp(1.5rem,4vw,36px)]" style={{ ...card, animation: 'nb-rise 0.35s var(--ease-standard) both' }}>
      <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
        Informations de l’établissement
      </h2>
      <p className="mb-[26px] mt-[6px] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
        L’abonnement et les factures sont au nom du cabinet. Le téléphone est celui affiché aux patients pour tous les praticiens.
      </p>
      <div className="mb-6 flex flex-wrap gap-x-10 gap-y-3 text-[0.9375rem]">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
            SIRET
          </div>
          <div className="mt-1 font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {doctor.siret ? doctor.siret.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, '$1 $2 $3 $4') : '—'}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
            E-mail du compte
          </div>
          <div className="mt-1 font-semibold" style={{ color: 'var(--text-primary)' }}>
            {doctor.email}
          </div>
        </div>
      </div>
      <div className="grid max-w-[700px] gap-x-[26px] md:grid-cols-2">
        <Input label="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={240} placeholder="12 rue des Lilas, 31000 Toulouse" />
        <Input label="Téléphone du cabinet" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05 61 00 00 00" />
      </div>
      <Button variant="primary" onClick={save} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Sauvegarder'}
      </Button>
      <CabinetIdentity doctor={doctor} refetchDoctor={refetchDoctor} showToast={showToast} onSeePlans={onSeePlans} establishment />
    </div>
  )
}

/** Profil d'un praticien (compte cabinet) : nom, fonction et numéro RPPS. */
export function PractitionerInfoCard({
  doctor,
  profile,
  practitionersApi,
  showToast,
}: {
  doctor: Doctor
  profile: Profile
  practitionersApi: DashboardOutletContext['practitionersApi']
  showToast: DashboardOutletContext['showToast']
}) {
  const [form, setForm] = useState({ first_name: profile.first_name, last_name: profile.last_name, specialty: profile.specialty })
  const [rpps, setRpps] = useState(profile.rpps ?? '')
  const [saving, setSaving] = useState(false)
  const [rppsBusy, setRppsBusy] = useState(false)
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    const { error } = await practitionersApi.updatePractitioner(profile.id, { ...form, color: profile.color })
    setSaving(false)
    showToast(error ? `Erreur : ${error}` : 'Profil enregistré', error ? 'warning' : 'success')
  }

  const verify = async () => {
    if (!/^[0-9]{11}$/.test(rpps)) {
      showToast('Le numéro RPPS contient 11 chiffres.', 'warning')
      return
    }
    setRppsBusy(true)
    const result = await practitionersApi.verifyRpps(profile.id, rpps)
    setRppsBusy(false)
    if (result.error) showToast(result.error, 'warning')
    else
      showToast(
        result.status === 'verified'
          ? 'Numéro RPPS vérifié'
          : result.status === 'not_found'
            ? 'Ce numéro est introuvable dans l’Annuaire Santé.'
            : result.status === 'mismatch'
              ? `Dans l’Annuaire Santé, ce numéro est au nom de « ${result.identity ?? '—'} ».`
              : 'Numéro enregistré. La vérification sera faite prochainement.',
        result.status === 'verified' || result.status === 'unverified' ? 'success' : 'warning'
      )
  }

  return (
    <div className="p-[clamp(1.5rem,4vw,36px)]" style={{ ...card, animation: 'nb-rise 0.35s var(--ease-standard) both' }}>
      <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
        Votre profil praticien
      </h2>
      <p className="mb-[30px] mt-[6px] text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
        Votre nom figure sur vos envois et vos documents signés. Les patients voient le téléphone du cabinet
        {doctor.phone ? ` (${doctor.phone})` : ''}.
      </p>
      <div className="grid max-w-[700px] gap-x-[26px] md:grid-cols-2">
        <Input label="Prénom" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
        <Input label="Nom" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
        <Input label="Fonction" value={form.specialty} onChange={(e) => set('specialty', e.target.value)} list="woui-fonctions-settings" />
      </div>
      <datalist id="woui-fonctions-settings">
        {PRACTITIONER_FUNCTIONS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <Button variant="primary" onClick={save} disabled={saving || !form.first_name.trim() || !form.last_name.trim()}>
        {saving ? 'Enregistrement…' : 'Sauvegarder'}
      </Button>

      <div className="mt-9 max-w-[700px] pt-7" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-[18px]" style={{ color: 'var(--text-primary)' }}>
            Numéro RPPS
          </h3>
          {profile.rpps && <RppsBadge status={profile.rpps_status} identity={profile.rpps_identity} />}
        </div>
        <p className="mb-4 mt-[6px] text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
          Votre identifiant national de professionnel de santé (11 chiffres), vérifié dans l’Annuaire Santé. Il n’apparaît pas sur les documents des
          patients.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-[220px] [&>label]:mb-0">
            <Input
              label="Numéro RPPS"
              value={rpps}
              onChange={(e) => setRpps(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
              maxLength={12}
              inputMode="numeric"
              placeholder="10001234567"
            />
          </div>
          <Button variant="ghost" onClick={verify} disabled={rppsBusy}>
            {rppsBusy ? 'Vérification…' : profile.rpps ? 'Vérifier à nouveau' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
