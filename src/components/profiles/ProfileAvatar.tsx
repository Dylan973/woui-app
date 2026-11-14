import { profileInitials } from '../../lib/profiles'
import type { Profile } from '../../types'

interface ProfileAvatarProps {
  profile: Pick<Profile, 'first_name' | 'last_name' | 'color'> & { photoUrl?: string | null; kind?: Profile['kind'] }
  /** Classes de taille, d'arrondi et de texte. */
  className?: string
}

/** Photo du profil si elle existe, sinon ses initiales sur sa couleur. */
export function ProfileAvatar({ profile, className = '' }: ProfileAvatarProps) {
  return (
    <span
      className={`relative flex flex-none items-center justify-center overflow-hidden font-semibold text-white ${className}`}
      style={{ background: profile.color }}
      aria-hidden="true"
    >
      {profile.kind === 'cabinet' ? (
        // Espace « Gestion du cabinet » : un bâtiment plutôt que des initiales.
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '42%', height: '42%' }}>
          <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
          <path d="M15 10h4a1 1 0 0 1 1 1v10" />
          <path d="M3 21h18M8 8h3M8 12h3M8 16h3" />
        </svg>
      ) : profile.photoUrl ? (
        <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        profileInitials(profile)
      )}
    </span>
  )
}
