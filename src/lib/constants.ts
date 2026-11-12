import type { ConsentStatus, Plan } from '../types'

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 35,
    yearlyPrice: 336,
    color: '#64748b',
    accent: '#94a3b8',
    limits: { consents: 10, templates: 1 },
    features: [
      '10 consentements / mois',
      '1 modèle vidéo',
      'Signature électronique',
      'Archivage 3 mois',
      'Support email',
    ],
    locked: ['Notifications SMS', 'Profils praticiens', 'Branding personnalisé', 'Archivage illimité', 'Statistiques avancées'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 50,
    yearlyPrice: 480,
    color: '#0ea5e9',
    accent: '#38bdf8',
    popular: true,
    limits: { consents: 100, templates: 5 },
    features: [
      '100 consentements / mois',
      '5 modèles vidéo',
      'Notifications SMS/email',
      'Archivage 2 ans',
      'Statistiques avancées',
      'Support prioritaire',
    ],
    locked: ['Profils praticiens', 'Branding personnalisé', 'API accès', 'Archivage illimité'],
  },
  {
    id: 'clinic',
    name: 'Clinique',
    price: 160,
    yearlyPrice: 1536,
    color: '#a855f7',
    accent: '#c084fc',
    limits: { consents: 999999, templates: 999 },
    features: [
      'Consentements illimités',
      'Modèles illimités',
      'Branding personnalisé',
      'Un profil par praticien',
      'Archivage illimité',
      'API accès',
      'Manager dédié',
      'Onboarding personnalisé',
    ],
    locked: [],
  },
]

export const PROCEDURES = [
  'Extraction dentaire',
  'Implant dentaire',
  'Blanchiment',
  'Couronne céramique',
  'Traitement de canal',
  'Détartrage profond',
  'Chirurgie parodontale',
  'Bridge dentaire',
]

export const STATUS_CONFIG: Record<ConsentStatus, { label: string; bg: string; fg: string; dot: string }> = {
  sent: { label: 'Envoyé', bg: 'var(--status-sent-bg)', fg: 'var(--status-sent-text)', dot: 'var(--status-sent-dot)' },
  opened: { label: 'Lien ouvert', bg: 'var(--status-opened-bg)', fg: 'var(--status-opened-text)', dot: 'var(--status-opened-dot)' },
  viewed: { label: 'Visionné', bg: 'var(--status-viewed-bg)', fg: 'var(--status-viewed-text)', dot: 'var(--status-viewed-dot)' },
  signed: { label: 'Signé', bg: 'var(--status-signed-bg)', fg: 'var(--status-signed-text)', dot: 'var(--status-signed-dot)' },
}

export const PLAN_LIMITS_LABEL = (n: number) => (n >= 999999 ? '∞' : String(n))

// Logo blanc (asset local, cf. /public) — lisible sur les fonds sombres du dashboard.
export const WOUI_LOGO_URL = '/logo-mark-white.png'


// Pages légales du site vitrine (à créer côté vitrine avant le lancement).
// TODO : remplacer par le domaine définitif de la vitrine.
export const LEGAL_URLS = {
  cgu: 'https://woui.fr/cgu',
  confidentialite: 'https://woui.fr/confidentialite',
}
