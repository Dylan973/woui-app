import type { Doctor, Practitioner, Profile } from '../types'

/** Identifiant du profil du titulaire du compte (les autres profils ont l'id de leur ligne). */
export const MAIN_PROFILE = 'main'

export const PROFILE_COLORS = ['#6c5ce7', '#0ea5e9', '#3fc79a', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#64748b']

/**
 * Profils praticiens : Starter 1 (le titulaire seul), Pro 2 (le titulaire + 1 praticien),
 * Clinique 4 praticiens compris + places supplémentaires.
 */
export const canUseProfiles = (doctor: Doctor) =>
  (doctor.plan === 'pro' || doctor.plan === 'clinic') && (doctor.plan_status === 'active' || doctor.plan_status === 'trialing')

/** Offre Clinique : le compte est celui du cabinet ; les dentistes associés y ont leur profil. */
export const isCabinetAccount = (doctor: Doctor) => doctor.plan === 'clinic' && doctor.account_type === 'cabinet'

/** Praticiens compris dans l'offre Clinique, puis places payées en plus. */
export const INCLUDED_PRACTITIONERS = 4
export const EXTRA_SEAT_PRICE = 40
/** Profils praticiens possibles en plus du titulaire (Pro) ou de « Gestion du cabinet » (Clinique). */
export const practitionerPlaces = (doctor: Doctor) =>
  doctor.plan === 'clinic' ? INCLUDED_PRACTITIONERS + Math.max(doctor.extra_seats ?? 0, 0) : doctor.plan === 'pro' ? 1 : 0
/** Nombre total de profils de l'offre, titulaire compris (hors « Gestion du cabinet »). */
export const PLAN_PROFILES: Record<Doctor['plan'], number> = { starter: 1, pro: 2, clinic: INCLUDED_PRACTITIONERS }

/** Fonctions proposées pour un praticien (saisie libre possible). */
export const PRACTITIONER_FUNCTIONS = [
  'Chirurgien-dentiste',
  'Orthodontiste',
  'Chirurgien oral',
  'Parodontiste',
  'Implantologue',
  'Pédodontiste',
  'Endodontiste',
]

/** Le code à 4 chiffres par profil est proposé aux offres Pro et Clinique en cours. */
export const canUsePin = (doctor: Doctor) =>
  (doctor.plan === 'pro' || doctor.plan === 'clinic') && (doctor.plan_status === 'active' || doctor.plan_status === 'trialing')

/** L'envoi de devis à signer est réservé aux offres Pro et Clinique. */
export const canSendQuotes = (doctor: Doctor) => doctor.plan === 'pro' || doctor.plan === 'clinic'

/** Titulaire du compte (ou « Gestion du cabinet ») en premier, puis les profils actifs. */
export function buildProfiles(doctor: Doctor, practitioners: Practitioner[]): Profile[] {
  const others = practitioners
    .filter((p) => !p.archived_at)
    .map(
      (p): Profile => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        specialty: p.specialty,
        color: p.color,
        isMain: false,
        kind: 'practitioner',
        photo_path: p.photo_path ?? null,
        signature_path: p.signature_path ?? null,
        rpps: p.rpps ?? null,
        rpps_status: p.rpps_status,
        rpps_identity: p.rpps_identity ?? null,
      })
    )
  if (isCabinetAccount(doctor)) {
    const cabinet: Profile = {
      id: MAIN_PROFILE,
      first_name: doctor.cabinet_name ?? '',
      last_name: '',
      specialty: 'Gestion du cabinet',
      color: '#171734',
      isMain: true,
      kind: 'cabinet',
      photo_path: null,
      signature_path: null,
    }
    return [cabinet, ...others]
  }
  const main: Profile = {
    id: MAIN_PROFILE,
    first_name: doctor.first_name ?? '',
    last_name: doctor.last_name ?? '',
    specialty: doctor.specialty ?? '',
    color: PROFILE_COLORS[0],
    isMain: true,
    photo_path: doctor.photo_path ?? null,
    signature_path: doctor.signature_path ?? null,
    kind: 'practitioner',
    rpps: doctor.rpps ?? null,
    rpps_status: doctor.rpps_status,
    rpps_identity: doctor.rpps_identity ?? null,
  }
  if (!canUseProfiles(doctor)) return [main]
  return [main, ...others]
}

export function profileName(p: Pick<Profile, 'first_name' | 'last_name'> & { kind?: Profile['kind'] }): string {
  if (p.kind === 'cabinet') return 'Gestion du cabinet'
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

// Session « Gestion du cabinet » (jeton remis après le code) : exigée par Woui pour gérer l'abonnement.
// Même préfixe que le profil choisi : elle est oubliée à la déconnexion.
const cabinetKey = (doctorId: string) => `woui-profile-cabinet-${doctorId}`

export function readCabinetSession(doctorId: string): string | null {
  try {
    return sessionStorage.getItem(cabinetKey(doctorId))
  } catch {
    return null
  }
}

export function writeCabinetSession(doctorId: string, token: string | null) {
  try {
    if (token) sessionStorage.setItem(cabinetKey(doctorId), token)
    else sessionStorage.removeItem(cabinetKey(doctorId))
  } catch {
    // stockage indisponible : le code sera redemandé
  }
}

/** Déconnexion : on oublie le profil choisi, l'écran « Qui utilise Woui ? » revient à la connexion suivante. */
export function clearActiveProfiles() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('woui-profile-')) sessionStorage.removeItem(k)
  } catch {
    // stockage indisponible : rien à effacer
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

const signatureKey = (doctorId: string, profileId: string) => `woui-signature-prompt-${doctorId}-${profileId}`

export function signaturePromptSeen(doctorId: string, profileId: string): boolean {
  try {
    return localStorage.getItem(signatureKey(doctorId, profileId)) === '1'
  } catch {
    return true
  }
}

export function markSignaturePromptSeen(doctorId: string, profileId: string) {
  try {
    localStorage.setItem(signatureKey(doctorId, profileId), '1')
  } catch {
    // sans stockage, la proposition pourra réapparaître
  }
}
