import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { PROFILE_COLORS, profileInitials } from '../../lib/profiles'
import type { Profile, ProfileForm } from '../../types'

interface ProfileEditModalProps {
  /** Profil à modifier ; null = création d'un nouveau profil. */
  profile: Profile | null
  onClose: () => void
  onSave: (form: ProfileForm) => Promise<{ error: string | null }>
  /** Retrait du profil (absent pour le titulaire du compte et à la création). */
  onArchive?: () => Promise<{ error: string | null }>
}

export function ProfileEditModal({ profile, onClose, onSave, onArchive }: ProfileEditModalProps) {
  const [form, setForm] = useState<ProfileForm>({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    specialty: profile?.specialty || 'Chirurgien-dentiste',
    color: profile?.color ?? PROFILE_COLORS[1],
  })
  const [busy, setBusy] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof ProfileForm>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const valid = form.first_name.trim() !== '' && form.last_name.trim() !== '' && !busy

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
        <div
          className="flex h-14 w-14 flex-none items-center justify-center rounded-[12px] text-[20px] font-semibold text-white"
          style={{ background: form.color }}
          aria-hidden="true"
        >
          {profileInitials(form)}
        </div>
        <div>
          <h2 className="font-display text-[22px]" style={{ color: 'var(--text-primary)' }}>
            {profile ? 'Modifier le profil' : 'Nouveau profil'}
          </h2>
          <p className="text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
            Ce nom apparaît sur les emails et les consentements signés.
          </p>
        </div>
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Input label="Prénom" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="Claire" autoFocus />
        <Input label="Nom" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Morel" />
      </div>
      <Input label="Spécialité" value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="Chirurgien-dentiste" />

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
        <Button variant="primary" size="sm" disabled={!valid} onClick={() => run(() => onSave(form))}>
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
