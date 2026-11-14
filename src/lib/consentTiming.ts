import type { Consent } from '../types'

const DAY = 24 * 3600 * 1000

/** Nombre de jours calendaires entre deux dates (heure locale), sans arrondi sur les heures. */
function calendarDays(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.round((b - a) / DAY)
}

/** « à l'instant », « il y a 12 min », « il y a 3 h », « hier », « il y a 4 j » (jours du calendrier). */
export function formatRelative(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const min = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const days = calendarDays(date, now)
  if (days <= 0) return `il y a ${Math.max(1, Math.round(min / 60))} h`
  if (days === 1) return 'hier'
  return `il y a ${days} j`
}

/** Date de l'étape actuelle de l'envoi (celle affichée à côté du statut). */
export function statusDate(c: Consent): string {
  switch (c.status) {
    case 'signed':
      return c.signed_at ?? c.sent_at
    case 'viewed':
      return c.viewed_at ?? c.sent_at
    case 'opened':
      return c.opened_at ?? c.sent_at
    default:
      // Relance : date du dernier e-mail (le premier envoi enregistre aussi last_sent_at, quelques secondes après).
      return c.last_sent_at && new Date(c.last_sent_at).getTime() > new Date(c.sent_at).getTime() ? c.last_sent_at : c.sent_at
  }
}

/** « Mar. 18 nov. · 09:30 » */
export function formatAppointment(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`
}

/** Il reste quelque chose à signer (les conseils post-opératoires seuls ne se signent pas). */
export function awaitsSignature(c: Consent): boolean {
  return c.status !== 'signed' && c.kind !== 'postop'
}

/**
 * Alerte : le rendez-vous est dans 2 jours ou moins (ou vient de passer) et le patient
 * n'a encore rien signé.
 */
export function appointmentAlert(c: Consent, now = new Date()): boolean {
  if (!c.appointment_at || !awaitsSignature(c)) return false
  const at = new Date(c.appointment_at)
  const days = calendarDays(now, at)
  return days <= 2 && at.getTime() > now.getTime() - DAY
}

/** « aujourd'hui », « demain », « dans 2 j », « passé » */
export function appointmentLabel(iso: string, now = new Date()): string {
  const at = new Date(iso)
  if (at.getTime() < now.getTime()) return 'passé'
  const days = calendarDays(now, at)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'demain'
  return `dans ${days} j`
}
