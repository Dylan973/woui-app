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

export const STATUS_CONFIG: Record<ConsentStatus, { label: string; color: string; dot: string }> = {
  sent: { label: 'Envoyé', color: '#94a3b8', dot: '#475569' },
  opened: { label: 'Lien ouvert', color: '#f59e0b', dot: '#d97706' },
  viewed: { label: 'Visionné', color: '#3b82f6', dot: '#2563eb' },
  signed: { label: 'Signé ✓', color: '#10b981', dot: '#059669' },
}

export const PLAN_LIMITS_LABEL = (n: number) => (n >= 999999 ? '∞' : String(n))

// Logo blanc (asset local, cf. /public) — lisible sur les fonds sombres du dashboard.
export const WOUI_LOGO_URL = '/logo-mark-white.png'

export const SURECART_PORTAL_URL = 'https://darkseagreen-aardvark-351969.hostingersite.com/customer-dashboard/'
