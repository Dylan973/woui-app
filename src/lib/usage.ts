import type { Consent } from '../types'

/** Nombre de consentements envoyés depuis le 1er du mois en cours (quota du plan). */
export function countThisMonth(consents: Consent[]): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return consents.filter((c) => new Date(c.sent_at).getTime() >= start).length
}
