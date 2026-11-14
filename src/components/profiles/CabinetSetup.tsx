import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { PinDialog } from './PinDialog'
import { ProfileAvatar } from './ProfileAvatar'
import { RppsBadge } from './RppsBadge'
import { PractitionerSignature } from './PractitionerSignature'
import { supabase } from '../../lib/supabase'
import { callFunction } from '../../lib/functions'
import { uploadAvatar } from '../../lib/avatar'
import { WOUI_LOGO_URL } from '../../lib/constants'
import { EXTRA_SEAT_PRICE, PRACTITIONER_FUNCTIONS, PROFILE_COLORS, isCabinetAccount, practitionerPlaces, profileName } from '../../lib/profiles'
import type { Doctor, Profile, ProfileForm } from '../../types'
import type { useProfilePins } from '../../hooks/useProfilePins'
import type { usePractitioners } from '../../hooks/usePractitioners'

type Step = 'cabinet' | 'code' | 'team'

interface CabinetSetupProps {
  doctor: Doctor
  /** Profils praticiens actifs. */
  practitioners: Profile[]
  pinApi: ReturnType<typeof useProfilePins>
  practitionersApi: Pick<ReturnType<typeof usePractitioners>, 'createPractitioner' | 'verifyRpps' | 'setPractitionerPhoto' | 'refetch'>
  refetchDoctor: () => Promise<void>
  onDone: () => void
  onSignOut: () => void
}

interface SiretCheck {
  found: boolean | null
  valid: boolean
  active?: boolean
  name?: string | null
  address?: string | null
}

/**
 * Configuration de l'offre Clinique, lancée après l'achat :
 * 1. le cabinet (nom, SIRET) si le compte était celui d'un dentiste ;
 * 2. le code obligatoire de « Gestion du cabinet » ;
 * 3. les profils des praticiens (nom, fonction, RPPS, signature ; photo facultative).
 */
export function CabinetSetup({ doctor, practitioners, pinApi, practitionersApi, refetchDoctor, onDone, onSignOut }: CabinetSetupProps) {
  const hasCode = pinApi.pins.main?.hasPin ?? false
  // L'étape « Votre cabinet » reste affichée (cochée) après la conversion du compte.
  const [withCabinetStep] = useState(doctor.account_type !== 'cabinet')
  const step: Step = !isCabinetAccount(doctor) ? 'cabinet' : !hasCode ? 'code' : 'team'
  const steps: { id: Step; label: string }[] = [
    ...(withCabinetStep ? [{ id: 'cabinet' as Step, label: 'Votre cabinet' }] : []),
    { id: 'code', label: 'Code de gestion' },
    { id: 'team', label: 'Praticiens' },
  ]

  return (
    <div className="flex min-h-screen flex-col items-center px-5 pb-16 pt-[clamp(2rem,7vh,72px)]" style={{ background: 'var(--surface-page)', color: 'var(--text-primary)' }}>
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-[4px] p-2" style={{ background: 'var(--action-accent)' }}>
        <img src={WOUI_LOGO_URL} alt="Woui" className="h-full w-full object-contain" />
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-accent)' }}>
        Offre Clinique
      </div>
      <h1 className="font-display mt-2 text-center text-[clamp(1.6rem,4vw,38px)]">Configurons votre cabinet</h1>

      <ol className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Étapes">
        {steps.map((s, i) => {
          const current = s.id === step
          const done = steps.findIndex((x) => x.id === step) > i
          return (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-full px-3 py-[6px] text-[13px]"
              style={{
                background: current ? 'var(--action-accent)' : 'var(--surface-card)',
                color: current ? 'var(--action-accent-text)' : done ? 'var(--text-primary)' : 'var(--text-muted)',
                border: current ? '1px solid transparent' : '1px solid var(--border-subtle)',
              }}
              aria-current={current ? 'step' : undefined}
            >
              <span className="font-semibold">{done ? '✓' : i + 1}</span> {s.label}
            </li>
          )
        })}
      </ol>

      <div className="mt-8 w-full max-w-[640px]">
        {step === 'cabinet' && <CabinetStep doctor={doctor} refetchDoctor={async () => { await Promise.all([refetchDoctor(), practitionersApi.refetch()]) }} />}
        {step === 'code' && <CodeStep pinApi={pinApi} />}
        {step === 'team' && (
          <TeamStep doctor={doctor} practitioners={practitioners} practitionersApi={practitionersApi} onDone={onDone} />
        )}
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="mt-10 cursor-pointer text-[0.8125rem]"
        style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
      >
        Se déconnecter
      </button>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-[clamp(1.25rem,4vw,32px)]" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
      {children}
    </div>
  )
}

/** Vérifie un SIRET dans l'annuaire des entreprises (réutilisé à l'inscription). */
export async function checkSiret(siret: string): Promise<SiretCheck> {
  const { data } = await callFunction<SiretCheck>('verify-siret', { siret })
  return data ?? { found: null, valid: true }
}

/** Compte d'un dentiste passé en Clinique : il devient le compte du cabinet. */
function CabinetStep({ doctor, refetchDoctor }: { doctor: Doctor; refetchDoctor: () => Promise<void> }) {
  const [name, setName] = useState(doctor.cabinet_name ?? '')
  const [siret, setSiret] = useState('')
  const [address, setAddress] = useState(doctor.address ?? '')
  const [phone, setPhone] = useState(doctor.phone ?? '')
  const [keepOwner, setKeepOwner] = useState(Boolean(doctor.last_name))
  const [check, setCheck] = useState<SiretCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verify = async (value: string) => {
    setCheck(null)
    if (value.length !== 14) return
    const result = await checkSiret(value)
    setCheck(result)
    if (result.found && result.name && !name.trim()) setName(result.name)
    if (result.found && result.address && !address.trim()) setAddress(result.address)
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('convert_to_cabinet', {
      p_cabinet_name: name.trim(),
      p_siret: siret,
      p_address: address.trim(),
      p_phone: phone.trim(),
      p_keep_owner: keepOwner,
    })
    if (rpcError) {
      setBusy(false)
      setError(rpcError.message)
      return
    }
    await refetchDoctor()
    setBusy(false)
  }

  const valid = name.trim() !== '' && siret.length === 14 && check?.valid !== false && check?.found !== false && !busy

  return (
    <Card>
      <h2 className="font-display text-[22px]">Votre cabinet</h2>
      <p className="mb-6 mt-2 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
        Avec l’offre Clinique, le compte Woui est celui de l’établissement. Chaque praticien du cabinet y a ensuite son profil.
      </p>
      <Input
        label="SIRET du cabinet"
        value={siret}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 14)
          setSiret(v)
          void verify(v)
        }}
        inputMode="numeric"
        placeholder="14 chiffres"
      />
      <SiretNote check={check} length={siret.length} />
      <Input label="Établissement" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Cabinet dentaire des Lilas" />
      <Input label="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={240} placeholder="12 rue des Lilas, 31000 Toulouse" />
      <Input label="Téléphone du cabinet" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05 61 00 00 00" />
      {doctor.last_name && (
        <label className="mb-5 flex cursor-pointer items-start gap-3 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={keepOwner} onChange={(e) => setKeepOwner(e.target.checked)} className="mt-1" />
          <span>
            Créer le profil praticien de <b style={{ color: 'var(--text-primary)' }}>{profileName({ first_name: doctor.first_name ?? '', last_name: doctor.last_name })}</b> à
            partir de ce compte (RPPS, signature et envois déjà faits repris).
          </span>
        </label>
      )}
      {error && (
        <p className="mb-4 text-[0.875rem]" style={{ color: 'var(--danger-text)' }}>
          {error}
        </p>
      )}
      <Button variant="primary" onClick={submit} disabled={!valid}>
        {busy ? 'Enregistrement…' : 'Continuer'}
      </Button>
    </Card>
  )
}

export function SiretNote({ check, length }: { check: SiretCheck | null; length: number }) {
  const style = { marginTop: -10, marginBottom: 18, fontSize: 12.5 }
  if (length > 0 && length < 14) return <p style={{ ...style, color: 'var(--text-muted)' }}>Le SIRET contient 14 chiffres.</p>
  if (!check) return null
  if (!check.valid) return <p style={{ ...style, color: 'var(--danger-text)' }}>Ce numéro SIRET n’est pas valide. Vérifiez-le.</p>
  if (check.found === false) return <p style={{ ...style, color: 'var(--danger-text)' }}>Ce SIRET est introuvable dans l’annuaire des entreprises.</p>
  if (check.found === null) return <p style={{ ...style, color: 'var(--text-muted)' }}>Numéro valide. L’annuaire des entreprises ne répond pas, il sera vérifié plus tard.</p>
  return (
    <p style={{ ...style, color: check.active ? 'var(--status-signed-text)' : 'var(--danger-text)' }}>
      {check.active ? '✓ ' : ''}
      {check.name}
      {check.active ? '' : ' — établissement fermé'}
    </p>
  )
}

/** Code obligatoire de « Gestion du cabinet ». */
function CodeStep({ pinApi }: { pinApi: CabinetSetupProps['pinApi'] }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <h2 className="font-display text-[22px]">Le code de Gestion du cabinet</h2>
      <p className="mb-6 mt-2 text-[0.9375rem] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
        « Gestion du cabinet » regroupe l’abonnement, les factures, l’équipe et l’activité de tous les praticiens. Elle est protégée par un code
        à 4 chiffres, obligatoire : donnez-le seulement aux personnes qui gèrent le cabinet.
      </p>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Créer le code
      </Button>
      {open && (
        <PinDialog
          steps={[
            { key: 'new', title: 'Code de Gestion du cabinet', hint: 'Choisissez un code à 4 chiffres' },
            { key: 'confirm', title: 'Confirmez le code', hint: 'Saisissez-le une seconde fois' },
          ]}
          onClose={() => setOpen(false)}
          onComplete={async (values) => {
            const message = (await pinApi.setPin('main', values.new ?? '')) ?? (await pinApi.openCabinetSession(values.new ?? ''))
            if (!message) setOpen(false)
            return message
          }}
        />
      )}
    </Card>
  )
}

/** Profils des praticiens, un par un. */
function TeamStep({
  doctor,
  practitioners,
  practitionersApi,
  onDone,
}: {
  doctor: Doctor
  practitioners: Profile[]
  practitionersApi: CabinetSetupProps['practitionersApi']
  onDone: () => void
}) {
  const places = practitionerPlaces(doctor)
  const [adding, setAdding] = useState(practitioners.length === 0)
  const [signing, setSigning] = useState<string | null>(null)
  const full = practitioners.length >= places
  const signingProfile = practitioners.find((p) => p.id === signing) ?? null

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[22px]">Les praticiens du cabinet</h2>
          <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {practitioners.length} / {places} profils
          </span>
        </div>
        <p className="mb-5 mt-2 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
          Chaque praticien a son profil : son nom, sa signature et son tampon figurent sur ses envois. Le téléphone affiché aux patients est celui du
          cabinet.
        </p>

        {practitioners.length > 0 && (
          <ul className="mb-5 flex flex-col gap-2">
            {practitioners.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 px-3 py-3"
                style={{ border: '1px solid var(--border-subtle)', borderRadius: 6 }}
              >
                <ProfileAvatar profile={p} className="h-10 w-10 rounded-[10px] text-[14px]" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{profileName(p)}</div>
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                    {p.specialty}
                    {p.rpps && <RppsBadge status={p.rpps_status} identity={p.rpps_identity} />}
                  </div>
                </div>
                {p.signature_path ? (
                  <span className="text-[12.5px]" style={{ color: 'var(--status-signed-text)' }}>
                    ✓ Signature et tampon
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSigning(p.id)}
                    className="cursor-pointer text-[13px] font-semibold"
                    style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}
                  >
                    Importer signature et tampon
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {signingProfile && (
          <div className="mb-5 p-4" style={{ background: 'var(--surface-card-alt)', borderRadius: 6 }}>
            <div className="mb-2 font-semibold">Signature et tampon de {profileName(signingProfile)}</div>
            <PractitionerSignature
              doctorId={doctor.id}
              profile={signingProfile}
              compact
              onSaved={async () => {
                await practitionersApi.refetch()
                setSigning(null)
              }}
            />
            <button
              type="button"
              onClick={() => setSigning(null)}
              className="mt-3 cursor-pointer text-[13px]"
              style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
            >
              Plus tard
            </button>
          </div>
        )}

        {adding && !full ? (
          <NewPractitioner
            doctorId={doctor.id}
            colorIndex={practitioners.length + 1}
            practitionersApi={practitionersApi}
            onCreated={(id) => {
              setAdding(false)
              setSigning(id)
            }}
            onCancel={practitioners.length > 0 ? () => setAdding(false) : undefined}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {!full && (
              <Button variant="ghost" onClick={() => setAdding(true)}>
                + Ajouter un praticien
              </Button>
            )}
            {full && (
              <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                Les {places} profils sont créés. Un praticien supplémentaire coûte {EXTRA_SEAT_PRICE} € par mois, à ajouter depuis Gestion du
                cabinet.
              </span>
            )}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {practitioners.length === 0 && (
          <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Ajoutez au moins un praticien pour envoyer des consentements.
          </span>
        )}
        <Button variant="primary" disabled={practitioners.length === 0} onClick={onDone}>
          Terminer
        </Button>
      </div>
    </div>
  )
}

function NewPractitioner({
  doctorId,
  colorIndex,
  practitionersApi,
  onCreated,
  onCancel,
}: {
  doctorId: string
  colorIndex: number
  practitionersApi: CabinetSetupProps['practitionersApi']
  onCreated: (id: string) => void
  onCancel?: () => void
}) {
  const [form, setForm] = useState<ProfileForm>({
    first_name: '',
    last_name: '',
    specialty: 'Chirurgien-dentiste',
    color: PROFILE_COLORS[colorIndex % PROFILE_COLORS.length],
    rpps: '',
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof ProfileForm>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const valid = form.first_name.trim() !== '' && form.last_name.trim() !== '' && /^[0-9]{11}$/.test(form.rpps ?? '') && !busy

  const submit = async () => {
    setBusy(true)
    setError(null)
    const created = await practitionersApi.createPractitioner(form)
    if (created.error || !created.id) {
      setBusy(false)
      setError(created.error ?? 'Le profil n’a pas pu être créé.')
      return
    }
    if (photo) {
      const uploaded = await uploadAvatar(doctorId, created.id, photo)
      if (!uploaded.error) await practitionersApi.setPractitionerPhoto(created.id, uploaded.path)
    }
    // Le résultat (vérifié, nom à contrôler, introuvable) s'affiche ensuite dans la liste.
    await practitionersApi.verifyRpps(created.id, form.rpps ?? '')
    setBusy(false)
    onCreated(created.id)
  }

  return (
    <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className="mb-4 font-semibold">Nouveau praticien</div>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Input label="Prénom" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="Claire" autoFocus />
        <Input label="Nom" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Morel" />
        <Input label="Spécialité" value={form.specialty} onChange={(e) => set('specialty', e.target.value)} list="woui-fonctions-setup" />
        <Input
          label="Numéro RPPS"
          value={form.rpps ?? ''}
          onChange={(e) => set('rpps', e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
          maxLength={12}
          inputMode="numeric"
          placeholder="11 chiffres"
        />
      </div>
      <datalist id="woui-fonctions-setup">
        {PRACTITIONER_FUNCTIONS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <label className="mb-5 inline-flex cursor-pointer items-center gap-2 text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
        <span className="rounded-[3px] px-3 py-[6px] text-[0.8125rem] font-semibold" style={{ border: '1px solid var(--border-default)' }}>
          {photo ? 'Changer la photo' : 'Photo (facultatif)'}
        </span>
        {photo && <span className="text-[12.5px]">{photo.name}</span>}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            setPhoto(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </label>
      {error && (
        <p className="mb-4 text-[0.875rem]" style={{ color: 'var(--danger-text)' }}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={submit} disabled={!valid}>
          {busy ? 'Création…' : 'Créer le profil'}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </div>
  )
}
