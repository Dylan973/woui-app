import type { Doctor, Practitioner, Profile } from '../types'

/** Identifiant du profil du titulaire du compte (les autres profils ont l'id de leur ligne). */
export const MAIN_PROFILE = 'main'

export const PROFILE_COLORS = ['#6c5ce7', '#0ea5e9', '#3fc79a', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#64748b']

/** Les profils praticiens sont réservés à l'offre Clinique en cours. */
export const canUseProfiles = (doctor: Doctor) =>
  doctor.plan === 'clinic' && (doctor.plan_status === 'active' || doctor.plan_status === 'trialing')

/** Le code à 4 chiffres par profil est proposé aux offres Pro et Clinique en cours. */
export const canUsePin = (doctor: Doctor) =>
  (doctor.plan === 'pro' || doctor.plan === 'clinic') && (doctor.plan_status === 'active' || doctor.plan_status === 'trialing')

/** Titulaire du compte en premier, puis les profils actifs. */
export function buildProfiles(doctor: Doctor, practitioners: Practitioner[]): Profile[] {
  const main: Profile = {
    id: MAIN_PROFILE,
    first_name: doctor.first_name ?? '',
    last_name: doctor.last_name ?? '',
    specialty: doctor.specialty ?? '',
    color: PROFILE_COLORS[0],
    isMain: true,
    photo_path: doctor.photo_path ?? null,
  }
  if (!canUseProfiles(doctor)) return [main]
  return [
    main,
    ...practitioners
      .filter((p) => !p.archived_at)
      .map((p) => ({ id: p.id, first_name: p.first_name, last_name: p.last_name, specialty: p.specialty, color: p.color, isMain: false, photo_path: p.photo_path ?? null })),
  ]
}

export function profileName(p: Pick<Profile, 'first_name' | 'last_name'>): string {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return name ? `Dr ${name}` : 'Mon profil'
}

export function profileInitials(p: Pick<Profile, 'first_name' | 'last_name'>): string {
  return (`${p.first_name.trim()[0] ?? ''}${p.last_name.trim()[0] ?? ''}`.toUpperCase() || 'DR').slice(0, 2)
}

// Le profil choisi vaut pour la session du navigateur : à chaque nouvelle ouverture,
// l'écran « Qui utilise Woui ? » revient (poste partagé au cabinet).
const key = (doctorId: string) => `woui-profile-${doctorId}`

export function readActiveProfile(doctorId: string): string | null {
  try {
    return sessionStorage.getItem(key(doctorId))
  } catch {
    return null
  }
}

export function writeActiveProfile(doctorId: string, profileId: string) {
  try {
    sessionStorage.setItem(key(doctorId), profileId)
  } catch {
    // stockage indisponible : le choix vaut pour la page en cours
  }
}

const welcomeKey = (doctorId: string) => `woui-clinic-welcome-${doctorId}`

export function clinicWelcomeSeen(doctorId: string): boolean {
  try {
    return localStorage.getItem(welcomeKey(doctorId)) === '1'
  } catch {
    return true
  }
}

export function markClinicWelcomeSeen(doctorId: string) {
  try {
    localStorage.setItem(welcomeKey(doctorId), '1')
  } catch {
    // sans stockage, le message pourra réapparaître
  }
}
