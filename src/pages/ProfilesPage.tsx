import { useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { ProfileEditModal } from '../components/profiles/ProfileEditModal'
import { ProfileAvatar } from '../components/profiles/ProfileAvatar'
import { PinDialog } from '../components/profiles/PinDialog'
import { ClinicUpsellModal } from '../components/profiles/ClinicModals'
import { supabase } from '../lib/supabase'
import { removeAvatar, uploadAvatar } from '../lib/avatar'
import { WOUI_LOGO_URL } from '../lib/constants'
import { profileName } from '../lib/profiles'
import type { DashboardOutletContext } from '../components/layout/AppLayout'
import type { Profile, ProfileForm } from '../types'

const TILE = 'h-[clamp(96px,22vw,132px)] w-[clamp(96px,22vw,132px)] rounded-[16px] transition-transform duration-150'

/**
 * Écran « Qui utilise Woui ? » : sélection et gestion des profils praticiens.
 * - Offre Clinique : choix du profil, ajout, modification, retrait.
 * - Starter / Pro : le profil du titulaire, et l'ajout affiché grisé (réservé à Clinique).
 * - Un profil protégé par un code à 4 chiffres le demande avant de s'ouvrir.
 */
export function ProfilesPage() {
  const {
    doctor,
    profiles,
    activeProfile,
    profileChosen,
    profilesEnabled,
    selectProfile,
    practitionersApi,
    pinApi,
    refetchDoctor,
    showToast,
    signOut,
  } = useOutletContext<DashboardOutletContext>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [managing, setManaging] = useState(searchParams.get('gerer') === '1')
  const [editing, setEditing] = useState<Profile | 'new' | null>(null)
  const [unlocking, setUnlocking] = useState<Profile | null>(null)
  const [resetNote, setResetNote] = useState<string | null>(null)
  const [upsell, setUpsell] = useState(false)

  // Lien « code oublié » reçu par e-mail : supprime le code du profil concerné.
  const resetToken = searchParams.get('reset')
  const resetHandled = useRef(false)
  const { confirmReset } = pinApi
  useEffect(() => {
    if (!resetToken || resetHandled.current) return
    resetHandled.current = true
    void confirmReset(resetToken).then((profileId) => {
      showToast(
        profileId
          ? 'Code supprimé. Vous pouvez en créer un nouveau dans Paramètres > Sécurité.'
          : 'Ce lien n’est plus valable. Demandez un nouvel e-mail depuis « Code oublié ? ».',
        profileId ? 'success' : 'warning'
      )
      setSearchParams({}, { replace: true })
    })
  }, [resetToken, confirmReset, showToast, setSearchParams])

  const saveMain = async (form: ProfileForm) => {
    const { error } = await supabase
      .from('doctors')
      .update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        specialty: form.specialty.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', doctor.id)
    return { error: error ? error.message : null }
  }

  const savePhotoPath = async (profileId: string, isMain: boolean, path: string | null) => {
    if (isMain) {
      const { error } = await supabase.from('doctors').update({ photo_path: path, updated_at: new Date().toISOString() }).eq('id', doctor.id)
      return { error: error ? error.message : null }
    }
    return practitionersApi.setPractitionerPhoto(profileId, path)
  }

  const save = async (form: ProfileForm, photo: File | 'remove' | null) => {
    const target = editing === 'new' ? null : editing
    let profileId = target?.id ?? null
    const isMain = target?.isMain ?? false

    if (!target) {
      const created = await practitionersApi.createPractitioner(form)
      if (created.error || !created.id) return { error: created.error ?? 'Profil non créé.' }
      profileId = created.id
    } else {
      const result = isMain ? await saveMain(form) : await practitionersApi.updatePractitioner(target.id, form)
      if (result.error) return result
    }

    if (photo && profileId) {
      let path: string | null = null
      if (photo instanceof File) {
        const uploaded = await uploadAvatar(doctor.id, profileId, photo)
        if (uploaded.error) return { error: uploaded.error }
        path = uploaded.path
      }
      const result = await savePhotoPath(profileId, isMain, path)
      if (result.error) return { error: 'Profil enregistré, mais la photo n’a pas pu être mise à jour.' }
      void removeAvatar(target?.photo_path)
    }
    if (isMain) await refetchDoctor()
    showToast(target ? 'Profil enregistré' : 'Profil créé')
    return { error: null }
  }

  const onTile = (profile: Profile) => {
    if (managing) setEditing(profile)
    else if (pinApi.pins[profile.id]?.hasPin) {
      setResetNote(null)
      setUnlocking(profile)
    } else selectProfile(profile.id)
  }

  const forgotPin = async () => {
    if (!unlocking) return
    setResetNote('Envoi en cours…')
    const { error, sentTo } = await pinApi.requestReset(unlocking.id)
    setResetNote(error ?? `E-mail envoyé${sentTo ? ` à ${sentTo}` : ''}. Ouvrez le lien pour supprimer le code.`)
  }

  const canManage = profilesEnabled || profiles.length === 1

  return (
    <div className="flex min-h-screen flex-col items-center px-6 pb-16 pt-[clamp(2.5rem,9vh,96px)]" style={{ background: 'var(--surface-page)' }}>
      <div className="mb-[clamp(1.5rem,5vh,48px)] flex h-10 w-10 items-center justify-center rounded-[4px] p-2" style={{ background: 'var(--action-accent)' }}>
        <img src={WOUI_LOGO_URL} alt="Woui" className="h-full w-full object-contain" />
      </div>

      <h1 className="font-display text-center text-[clamp(1.7rem,4.5vw,44px)]" style={{ color: 'var(--text-primary)' }}>
        {managing ? (profilesEnabled ? 'Gérer les profils' : 'Modifier mon profil') : 'Qui utilise Woui ?'}
      </h1>
      <p className="mt-3 max-w-[520px] text-center text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
        {managing
          ? 'Cliquez sur un profil pour modifier son nom, sa spécialité, sa photo ou sa couleur.'
          : profilesEnabled
            ? 'Choisissez votre profil : chaque praticien retrouve ses propres consentements.'
            : 'Votre cabinet compte plusieurs praticiens ? Donnez un profil à chacun avec l’abonnement Clinique.'}
      </p>

      <div className="mt-[clamp(2rem,6vh,56px)] flex max-w-[900px] flex-wrap justify-center gap-[clamp(1rem,3vw,32px)]">
        {profiles.map((profile) => {
          const locked = pinApi.pins[profile.id]?.hasPin ?? false
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onTile(profile)}
              className="group flex cursor-pointer flex-col items-center gap-3"
              style={{ background: 'none', border: 0 }}
              aria-label={`${profileName(profile)}${locked ? ', protégé par un code' : ''}`}
            >
              <span
                className="relative rounded-[16px] transition-transform duration-150 group-hover:scale-[1.05]"
                style={{
                  outline: !managing && profileChosen && profile.id === activeProfile.id ? '3px solid var(--text-primary)' : 'none',
                  outlineOffset: 4,
                }}
              >
                <ProfileAvatar profile={profile} className={`${TILE} text-[clamp(1.6rem,5vw,40px)]`} />
                {managing && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-[16px]" style={{ background: 'rgba(0,0,0,0.45)' }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </span>
                )}
                {locked && !managing && (
                  <span
                    className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    aria-hidden="true"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  </span>
                )}
              </span>
              <span className="text-center">
                <span className="block text-[0.9375rem] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {profileName(profile)}
                </span>
                <span className="block text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                  {profile.isMain ? 'Titulaire du compte' : profile.specialty}
                </span>
              </span>
            </button>
          )
        })}

        {profilesEnabled ? (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="group flex cursor-pointer flex-col items-center gap-3"
            style={{ background: 'none', border: 0 }}
          >
            <span
              className={`${TILE} flex items-center justify-center text-[44px] font-light group-hover:scale-[1.05]`}
              style={{ border: '2px dashed var(--border-default)', color: 'var(--text-muted)' }}
            >
              +
            </span>
            <span className="text-[0.9375rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Ajouter un profil
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setUpsell(true)}
            className="flex cursor-pointer flex-col items-center gap-3"
            style={{ background: 'none', border: 0 }}
            aria-label="Ajouter un profil : disponible uniquement avec l'abonnement Clinique"
          >
            <span
              className={`${TILE} flex items-center justify-center opacity-55`}
              style={{ border: '2px dashed var(--border-default)', color: 'var(--text-muted)' }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <span className="text-center">
              <span className="block text-[0.9375rem] font-semibold opacity-60" style={{ color: 'var(--text-secondary)' }}>
                Ajouter un profil
              </span>
              <span className="block max-w-[150px] text-[12px] leading-[1.35]" style={{ color: 'var(--text-accent)' }}>
                Disponible uniquement avec l'abonnement Clinique
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="mt-[clamp(2rem,6vh,56px)] flex flex-wrap items-center justify-center gap-3">
        {canManage && (
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            className="cursor-pointer rounded-[3px] px-5 py-[10px] text-[0.875rem] font-semibold uppercase tracking-[0.08em]"
            style={{ background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {managing ? 'Terminé' : profilesEnabled ? 'Gérer les profils' : 'Modifier mon profil'}
          </button>
        )}
        {profileChosen && !managing && (
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="cursor-pointer px-3 py-[10px] text-[0.875rem]"
            style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
          >
            ← Retour au tableau de bord
          </button>
        )}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={signOut}
          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[0.8125rem]"
          style={{ background: 'none', border: 0, color: 'var(--text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Se déconnecter
        </button>
      </div>

      {editing && (
        <ProfileEditModal
          profile={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={save}
          onArchive={
            editing !== 'new' && !editing.isMain
              ? async () => {
                  const result = await practitionersApi.archivePractitioner(editing.id)
                  if (!result.error) showToast('Profil retiré')
                  return result
                }
              : undefined
          }
        />
      )}

      {unlocking && (
        <PinDialog
          steps={[{ key: 'current', title: profileName(unlocking), hint: 'Saisissez votre code à 4 chiffres' }]}
          avatar={<ProfileAvatar profile={unlocking} className="h-[72px] w-[72px] rounded-[16px] text-[24px]" />}
          onClose={() => setUnlocking(null)}
          onComplete={async (values) => {
            const message = await pinApi.verifyPin(unlocking.id, values.current ?? '')
            if (!message) selectProfile(unlocking.id)
            return message
          }}
          footer={
            resetNote ? (
              <p className="text-[12.5px] leading-[1.45]" style={{ color: 'var(--text-secondary)' }} aria-live="polite">
                {resetNote}
              </p>
            ) : (
              <button
                type="button"
                onClick={forgotPin}
                className="cursor-pointer text-[13px] font-semibold"
                style={{ background: 'none', border: 0, color: 'var(--text-accent)' }}
              >
                Code oublié ?
              </button>
            )
          }
        />
      )}

      {upsell && <ClinicUpsellModal onClose={() => setUpsell(false)} onSeePlans={() => navigate('/settings?tab=plan')} />}
    </div>
  )
}
