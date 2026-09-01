export type PlanId = 'starter' | 'pro' | 'clinic'
export type ConsentStatus = 'sent' | 'opened' | 'viewed' | 'signed'
export type PlanStatus = 'active' | 'cancelled' | 'past_due' | 'trialing'

export interface Doctor {
  id: string
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  specialty: string
  phone: string | null
  plan: PlanId
  plan_status: PlanStatus
  surecart_customer_id: string | null
  surecart_subscription_id: string | null
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
  pdf_url: string | null
  created_at: string
}

export interface Plan {
  id: PlanId
  name: string
  price: number
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
}
