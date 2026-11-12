import { useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { ProfileEditModal } from '../components/profiles/ProfileEditModal'
import { ClinicUpsellModal } from '../components/profiles/ClinicModals'
import { supabase } from '../lib/supabase'
import { WOUI_LOGO_URL } from '../lib/constants'
import { profileInitials, profileName } from '../lib/profiles'
import type { DashboardOutletContext } from '../components/layout/AppLayout'
import type { Profile, ProfileForm } from '../types'

const TILE = 'flex h-[clamp(96px,22vw,132px)] w-[clamp(96px,22vw,132px)] items-center justify-center rounded-[16px] transition-transform duration-150'

/**
 * Écran « Qui utilise Woui ? » : sélection et gestion des profils praticiens.
 * - Offre Clinique : choix du profil, ajout, modification, retrait.
 * - Starter / Pro : le profil du titulaire, et l'ajout affiché grisé (réservé à Clinique).
 */
export function ProfilesPage() {
  const { doctor, profiles, activeProfile, profileChosen, profilesEnabled, selectProfile, practitionersApi, refetchDoctor, showToast } =
    useOutletContext<DashboardOutletContext>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [managing, setManaging] = useState(searchParams.get('gerer') === '1')
  const [editing, setEditing] = useState<Profile | 'new' | null>(null)
  const [upsell, setUpsell] = useState(false)

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
    if (!error) await refetchDoctor()
    return { error: error ? error.message : null }
  }

  const save = async (form: ProfileForm) => {
    const result =
      editing === 'new'
        ? await practitionersApi.createPractitioner(form)
        : editing && editing.isMain
          ? await saveMain(form)
          : editing
            ? await practitionersApi.updatePractitioner(editing.id, form)
            : { error: null }
    if (!result.error) showToast(editing === 'new' ? 'Profil créé' : 'Profil enregistré')
    return result
  }

  const onTile = (profile: Profile) => {
    if (managing) setEditing(profile)
    else selectProfile(profile.id)
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-6 pb-16 pt-[clamp(2.5rem,9vh,96px)]" style={{ background: 'var(--surface-page)' }}>
      <div className="mb-[clamp(1.5rem,5vh,48px)] flex h-10 w-10 items-center justify-center rounded-[4px] p-2" style={{ background: 'var(--action-accent)' }}>
        <img src={WOUI_LOGO_URL} alt="Woui" className="h-full w-full object-contain" />
      </div>

      <h1 className="font-display text-center text-[clamp(1.7rem,4.5vw,44px)]" style={{ color: 'var(--text-primary)' }}>
        {managing ? 'Gérer les profils' : 'Qui utilise Woui ?'}
      </h1>
      <p className="mt-3 max-w-[520px] text-center text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
        {managing
          ? 'Cliquez sur un profil pour modifier son nom, sa spécialité ou sa couleur.'
          : profilesEnabled
            ? 'Choisissez votre profil : chaque praticien retrouve ses propres consentements.'
            : 'Votre cabinet compte plusieurs praticiens ? Donnez un profil à chacun avec l’abonnement Clinique.'}
      </p>

      <div className="mt-[clamp(2rem,6vh,56px)] flex max-w-[900px] flex-wrap justify-center gap-[clamp(1rem,3vw,32px)]">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => onTile(profile)}
            className="group flex cursor-pointer flex-col items-center gap-3"
            style={{ background: 'none', border: 0 }}
          >
            <span
              className={`${TILE} relative text-[clamp(1.6rem,5vw,40px)] font-semibold text-white group-hover:scale-[1.05]`}
              style={{
                background: profile.color,
                outline: !managing && profileChosen && profile.id === activeProfile.id ? '3px solid var(--text-primary)' : 'none',
                outlineOffset: 4,
              }}
            >
              {profileInitials(profile)}
              {managing && (
                <span className="absolute inset-0 flex items-center justify-center rounded-[16px]" style={{ background: 'rgba(0,0,0,0.45)' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
        ))}

        {profilesEnabled ? (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="group flex cursor-pointer flex-col items-center gap-3"
            style={{ background: 'none', border: 0 }}
          >
            <span
              className={`${TILE} text-[44px] font-light group-hover:scale-[1.05]`}
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
            <span className={`${TILE} opacity-55`} style={{ border: '2px dashed var(--border-default)', color: 'var(--text-muted)' }}>
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
        {profilesEnabled && (
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            className="cursor-pointer rounded-[3px] px-5 py-[10px] text-[0.875rem] font-semibold uppercase tracking-[0.08em]"
            style={{ background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {managing ? 'Terminé' : 'Gérer les profils'}
          </button>
        )}
        {(profileChosen || !profilesEnabled) && !managing && (
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

      {upsell && (
        <ClinicUpsellModal
          onClose={() => setUpsell(false)}
          onSeePlans={() => navigate('/settings?tab=plan')}
        />
      )}
    </div>
  )
}
