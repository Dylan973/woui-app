import type { ConsentStatus, Plan } from '../types'

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 35,
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
    locked: ['Notifications SMS', 'Multi-praticiens', 'Branding personnalisé', 'Archivage illimité', 'Statistiques avancées'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 50,
    color: '#0ea5e9',
    accent: '#38bdf8',
    popular: true,
    limits: { consents: 100, templates: 5 },
    features: [
      '100 consentements / mois',
      '5 modèles vidéo',
      'Notifications SMS/email',
      'Archivage 2 ans',
      '3 praticiens',
      'Statistiques avancées',
      'Support prioritaire',
    ],
    locked: ['Branding personnalisé', 'Praticiens illimités', 'API accès', 'Archivage illimité'],
  },
  {
    id: 'clinic',
    name: 'Clinique',
    price: 160,
    color: '#a855f7',
    accent: '#c084fc',
    limits: { consents: 999999, templates: 999 },
    features: [
      'Consentements illimités',
      'Modèles illimités',
      'Branding personnalisé',
      'Praticiens illimités',
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
  sent: { label: 'Envoyé', bg: 'var(--stone-100)', fg: 'var(--stone-600)', dot: 'var(--stone-400)' },
  opened: { label: 'Lien ouvert', bg: 'var(--amber-50)', fg: 'var(--amber-700)', dot: 'var(--amber-500)' },
  viewed: { label: 'Visionné', bg: 'var(--blue-50)', fg: 'var(--blue-700)', dot: 'var(--blue-500)' },
  signed: { label: 'Signé', bg: 'var(--green-50)', fg: 'var(--green-700)', dot: 'var(--green-500)' },
}

export const PLAN_LIMITS_LABEL = (n: number) => (n >= 999999 ? '∞' : String(n))

// Logo blanc (asset local, cf. /public) — lisible sur les fonds sombres du dashboard.
export const WOUI_LOGO_URL = '/logo-mark-white.png'

export const SURECART_PORTAL_URL = 'https://darkseagreen-aardvark-351969.hostingersite.com/customer-dashboard/'
