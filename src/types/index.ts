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
  created_at: string
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
  photo_path: string | null
  signature_path: string | null
  /** Lien temporaire vers la photo, s'il y en a une. */
  photoUrl?: string | null
}

export interface ProfileForm {
  first_name: string
  last_name: string
  specialty: string
  color: string
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
