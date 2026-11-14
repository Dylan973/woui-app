import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { ProfileAvatar } from './ProfileAvatar'
import { PRACTITIONER_FUNCTIONS, PROFILE_COLORS } from '../../lib/profiles'
import { RppsBadge } from './RppsBadge'
import type { Profile, ProfileForm } from '../../types'

interface ProfileEditModalProps {
  /** Profil à modifier ; null = création d'un nouveau profil. */
  profile: Profile | null
  onClose: () => void
  /** photo : nouveau fichier, 'remove' pour retirer la photo, null pour ne rien changer. */
  onSave: (form: ProfileForm, photo: File | 'remove' | null) => Promise<{ error: string | null }>
  /** Retrait du profil (absent pour le titulaire du compte et à la création). */
  onArchive?: () => Promise<{ error: string | null }>
  /** Offre Clinique (compte cabinet) : numéro RPPS du praticien, obligatoire. */
  withRpps?: boolean
}

export function ProfileEditModal({ profile, onClose, onSave, onArchive, withRpps = false }: ProfileEditModalProps) {
  const [form, setForm] = useState<ProfileForm>({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    specialty: profile?.specialty || 'Chirurgien-dentiste',
    color: profile?.color ?? PROFILE_COLORS[1],
    rpps: profile?.rpps ?? '',
  })
  const [photo, setPhoto] = useState<File | 'remove' | null>(null)
  const preview = useMemo(() => (photo instanceof File ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  const shownPhoto = preview ?? (photo === 'remove' ? null : (profile?.photoUrl ?? null))
  const [busy, setBusy] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof ProfileForm>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const rppsOk = !withRpps || /^[0-9]{11}$/.test(form.rpps ?? '')
  const valid = form.first_name.trim() !== '' && form.last_name.trim() !== '' && rppsOk && !busy

  const run = async (action: () => Promise<{ error: string | null }>) => {
    setBusy(true)
    setError(null)
    const { error: actionError } = await action()
    setBusy(false)
    if (actionError) setError(actionError)
    else onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div className="mb-6 flex items-center gap-4">
        <ProfileAvatar profile={{ ...form, photoUrl: shownPhoto }} className="h-16 w-16 rounded-[14px] text-[22px]" />
        <div>
          <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
            {profile ? 'Modifier le profil' : 'Nouveau profil'}
          </h2>
          <p className="text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
            Ce nom apparaît sur les emails et les consentements signés.
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label
          className="cursor-pointer rounded-[3px] px-[14px] py-[6px] text-[0.8125rem] font-semibold"
          style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {shownPhoto ? 'Changer la photo' : 'Ajouter une photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setPhoto(file)
              e.target.value = ''
            }}
          />
        </label>
        {shownPhoto && (
          <button
            type="button"
            onClick={() => setPhoto('remove')}
            className="cursor-pointer text-[13px]"
            style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
          >
            Retirer la photo
          </button>
        )}
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Input label="Prénom" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="Claire" autoFocus />
        <Input label="Nom" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Morel" />
      </div>
      <Input
        label="Spécialité"
        value={form.specialty}
        onChange={(e) => set('specialty', e.target.value)}
        placeholder="Chirurgien-dentiste"
        list="woui-fonctions"
      />
      <datalist id="woui-fonctions">
        {PRACTITIONER_FUNCTIONS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      {withRpps && (
        <div className="mb-5">
          <div className="[&>label]:mb-1">
            <Input
              label="Numéro RPPS"
              value={form.rpps ?? ''}
              onChange={(e) => set('rpps', e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
              maxLength={12}
              inputMode="numeric"
              placeholder="10001234567"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
            {profile?.rpps && profile.rpps === form.rpps ? (
              <RppsBadge status={profile.rpps_status} identity={profile.rpps_identity} />
            ) : (
              <span>11 chiffres, vérifié dans l’Annuaire Santé. Il n’apparaît pas sur les documents des patients.</span>
            )}
          </div>
        </div>
      )}

      {!profile?.isMain && (
        <div className="mb-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
            Couleur
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROFILE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => set('color', color)}
                aria-label={`Couleur ${color}`}
                aria-pressed={form.color === color}
                className="h-8 w-8 cursor-pointer rounded-[8px]"
                style={{
                  background: color,
                  border: 'none',
                  outline: form.color === color ? '2px solid var(--text-primary)' : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
            {/* Couleur personnalisée : nuancier libre */}
            <label
              title="Couleur personnalisée"
              className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px]"
              style={{
                background: PROFILE_COLORS.includes(form.color)
                  ? 'conic-gradient(from 180deg, #ef4444, #f59e0b, #84cc16, #22c55e, #0ea5e9, #6c5ce7, #d946ef, #ef4444)'
                  : form.color,
                outline: PROFILE_COLORS.includes(form.color) ? 'none' : '2px solid var(--text-primary)',
                outlineOffset: 2,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.45))' }}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              <input
                type="color"
                value={form.color}
                onChange={(e) => set('color', e.target.value)}
                aria-label="Couleur personnalisée"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>
      )}

      {error && (
        <div
          className="mb-4 p-3 text-[0.875rem]"
          style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 3 }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {onArchive &&
          (confirmArchive ? (
            <Button variant="danger" size="sm" disabled={busy} onClick={() => run(onArchive)}>
              Confirmer le retrait
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmArchive(true)}
              className="cursor-pointer text-[13px]"
              style={{ background: 'none', border: 0, color: 'var(--danger-text)' }}
            >
              Retirer ce profil
            </button>
          ))}
        <span className="ml-auto" />
        <Button variant="ghost" size="sm" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" size="sm" disabled={!valid} onClick={() => run(() => onSave(form, photo))}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
      {confirmArchive && (
        <p className="mt-3 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
          Le profil disparaît de la sélection. Ses consentements restent conservés à son nom et s'affichent dans le profil principal.
        </p>
      )}
    </Modal>
  )
}
