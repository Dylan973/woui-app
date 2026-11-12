import { profileInitials } from '../../lib/profiles'
import type { Profile } from '../../types'

interface ProfileAvatarProps {
  profile: Pick<Profile, 'first_name' | 'last_name' | 'color'> & { photoUrl?: string | null }
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
      {profile.photoUrl ? <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" /> : profileInitials(profile)}
    </span>
  )
}
