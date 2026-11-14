export type PlanId = 'starter' | 'pro' | 'clinic'
export type ConsentStatus = 'sent' | 'opened' | 'viewed' | 'signed'
export type BillingInterval = 'monthly' | 'yearly'
export type ConsentKind = 'consent' | 'quote' | 'both'
export type PlanStatus = 'incomplete' | 'trialing' | 'active' | 'past_due' | 'cancelled'

export interface Doctor {
  id: string
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  specialty: string
  phone: string | null
  /** Chemin de la photo dans le stockage privé `avatars`. */
  photo_path?: string | null
  /** Signature ou tampon du praticien (stockage privé `documents`). */
  signature_path?: string | null
  /** Numéro RPPS (11 chiffres) et résultat de sa vérification dans l'Annuaire Santé. */
  rpps?: string | null
  rpps_status?: 'unverified' | 'verified' | 'mismatch' | 'not_found'
  rpps_identity?: string | null
  /** Nom du cabinet (toutes les offres) et logo (offre Clinique), affichés aux patients. */
  cabinet_name?: string | null
  logo_path?: string | null
  /** 'practitioner' : compte d'un dentiste (Starter, Pro). 'cabinet' : compte du cabinet (Clinique). */
  account_type?: 'practitioner' | 'cabinet'
  /** Compte cabinet : SIRET (14 chiffres) et adresse. */
  siret?: string | null
  address?: string | null
  /** Offre Clinique : praticiens payés en plus des 3 compris. */
  extra_seats?: number
  plan: PlanId
  plan_status: PlanStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  billing_interval: BillingInterval | null
  consents_used_this_month: number
  subscribed_at: string
  plan_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface Consent {
  id: string
  doctor_id: string
  patient: string
  email: string
  procedure: string
  status: ConsentStatus
  token: string
  video_progress: number
  sent_at: string
  opened_at: string | null
  viewed_at: string | null
  signed_at: string | null
  signature_data: string | null
  /** Chemin du PDF signé dans le stockage privé `consents`. */
  pdf_url: string | null
  signed_ip: string | null
  signed_user_agent: string | null
  /** Empreinte SHA-256 du PDF signé. */
  document_hash: string | null
  /** Profil praticien qui a envoyé le consentement (null = titulaire du compte). */
  practitioner_id: string | null
  /** Contenu de l'envoi : consentement, devis, ou les deux. */
  kind?: ConsentKind
  /** Formulaire de consentement du cabinet joint à l'envoi. */
  template_path?: string | null
  quote_path?: string | null
  quote_name?: string | null
  quote_opened_at?: string | null
  quote_signed_at?: string | null
  /** Devis signé (stockage privé `consents`). */
  quote_pdf_url?: string | null
  /** Le lien patient n'est plus valable après cette date (prolongée à chaque relance). */
  link_expires_at?: string
  last_sent_at?: string | null
  created_at: string
}

/** Ce que la page patient reçoit (fonctions par jeton) : rien de plus que ce qu'elle affiche. */
export interface PatientConsent {
  id: string
  patient: string
  procedure: string
  status: ConsentStatus
  kind: ConsentKind
  video_progress: number
  sent_at: string
  opened_at: string | null
  viewed_at: string | null
  signed_at: string | null
  quote_name: string | null
  quote_opened_at: string | null
  /** Le cabinet a joint son formulaire de consentement. */
  has_template: boolean
  /** Lien expiré (30 jours sans signature). */
  expired: boolean
  cabinet_name: string | null
  practitioner_name: string | null
  /** Logo du cabinet disponible (offre Clinique). */
  has_logo: boolean
}

/** Formulaire de consentement du cabinet (PDF) pour un acte. */
export interface ConsentTemplate {
  id: string
  doctor_id: string
  procedure: string
  file_path: string
  file_name: string
  updated_at: string
}

/** Profil praticien ajouté à un compte Clinique. */
export interface Practitioner {
  id: string
  doctor_id: string
  first_name: string
  last_name: string
  specialty: string
  color: string
  photo_path?: string | null
  signature_path?: string | null
  rpps?: string | null
  rpps_status?: 'unverified' | 'verified' | 'mismatch' | 'not_found'
  rpps_identity?: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

/** Profil affiché dans l'app : le titulaire du compte (id « main ») ou un praticien ajouté. */
export interface Profile {
  id: string
  first_name: string
  last_name: string
  specialty: string
  color: string
  isMain: boolean
  /** Compte cabinet (Clinique) : le profil « main » est l'espace « Gestion du cabinet ». */
  kind?: 'cabinet' | 'practitioner'
  photo_path: string | null
  signature_path: string | null
  rpps?: string | null
  rpps_status?: 'unverified' | 'verified' | 'mismatch' | 'not_found'
  rpps_identity?: string | null
  /** Lien temporaire vers la photo, s'il y en a une. */
  photoUrl?: string | null
}

export interface ProfileForm {
  first_name: string
  last_name: string
  specialty: string
  color: string
  /** Offre Clinique : numéro RPPS du praticien (11 chiffres). */
  rpps?: string
}

export interface Plan {
  id: PlanId
  name: string
  price: number
  /** Prix annuel (−20 %), en euros. */
  yearlyPrice: number
  color: string
  accent: string
  popular?: boolean
  limits: { consents: number; templates: number }
  features: string[]
  locked: string[]
}

/** Shape of the form used by SendModal / useConsents.sendConsent */
export interface NewConsentForm {
  patient: string
  email: string
  procedure: string
  kind: ConsentKind
  /** Devis au format PDF (envois « devis » et « les deux »). */
  quoteFile: File | null
}
