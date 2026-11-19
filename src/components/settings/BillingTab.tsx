import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { callFunction } from '../../lib/functions'
import { openBillingPortal, openCancelSubscription } from '../../lib/billing'
import { PLANS, VAT_NOTE } from '../../lib/constants'
import type { Doctor } from '../../types'
import type { ToastType } from '../ui/Toast'

interface Subscription {
  status: string
  plan: string | null
  interval: 'monthly' | 'yearly' | null
  seats: number
  amount: number
  currency: string
  current_period_end: number | null
  trial_end: number | null
  cancel_at_period_end: boolean
  cancel_at: number | null
  card: { brand: string; last4: string; exp_month: number; exp_year: number } | null
}

interface Invoice {
  id: string
  number: string | null
  created: number
  total: number
  currency: string
  status: 'open' | 'paid' | 'uncollectible' | 'void' | null
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  subtotal: number
  tax: number
  billing_reason: string | null
  lines: { amount: number; quantity: number | null; proration: boolean; lookup_key: string | null; period_start: number | null; period_end: number | null }[]
}

interface Upcoming {
  amount_due: number
  subtotal: number
  tax: number
  date: number | null
}

type BillingData = { subscription: Subscription | null; upcoming: Upcoming | null; invoices: Invoice[] }

const shortDay = (unix: number | null) => (unix ? new Date(unix * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')

const isSeat = (key: string | null) => /^woui_clinic_seat_/.test(key ?? '')

/** Objet de la facture, lisible : ce que le cabinet a payé et pour quelle période. */
function invoiceSubject(inv: Invoice): string {
  const prorated = inv.lines.filter((l) => l.proration && l.amount > 0)
  if (prorated.length > 0) {
    const seats = prorated.filter((l) => isSeat(l.lookup_key))
    const l = seats[0] ?? prorated[0]
    const what = seats.length > 0 ? 'Praticien en plus' : 'Changement d’offre'
    return `${what}, au prorata du ${shortDay(l.period_start)} au ${shortDay(l.period_end)}`
  }
  if (inv.total === 0 && inv.billing_reason === 'subscription_create') return 'Début de l’essai gratuit'
  const l = inv.lines[0]
  const seats = inv.lines.filter((x) => isSeat(x.lookup_key)).reduce((n, x) => n + (x.quantity ?? 0), 0)
  const period = l?.period_start ? ` du ${shortDay(l.period_start)} au ${shortDay(l.period_end)}` : ''
  return `Abonnement${seats ? ` + ${seats} praticien${seats > 1 ? 's' : ''} en plus` : ''}${period}`
}

const card = { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--card-ring)' }

const money = (cents: number, currency = 'eur') =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: cents % 100 ? 2 : 0 })

const day = (unix: number | null) =>
  unix ? new Date(unix * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

const BRANDS: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', cartes_bancaires: 'CB' }

const INVOICE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: 'Payée', color: 'var(--status-signed-text)', bg: 'var(--status-signed-bg, rgba(63,199,154,.14))' },
  open: { label: 'À régler', color: 'var(--danger-text)', bg: 'color-mix(in srgb, var(--danger-text) 12%, transparent)' },
  uncollectible: { label: 'Impayée', color: 'var(--danger-text)', bg: 'color-mix(in srgb, var(--danger-text) 12%, transparent)' },
  void: { label: 'Annulée', color: 'var(--text-muted)', bg: 'var(--surface-card-alt)' },
}

/** Paramètres > Facturation : abonnement payé en cours et factures Stripe, avec accès au portail Stripe. */
export function BillingTab({ doctor, showToast }: { doctor: Doctor; showToast: (msg: string, type?: ToastType) => void }) {
  const [data, setData] = useState<BillingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    let cancelled = false
    void callFunction<BillingData>('stripe-billing', {}, { cabinetOf: doctor.id }).then((r) => {
      if (cancelled) return
      if (r.error || !r.data) setError(r.error ?? 'La facturation est momentanément indisponible.')
      else setData(r.data)
    })
    return () => {
      cancelled = true
    }
  }, [doctor.id])

  const openPortal = async () => {
    setOpening(true)
    const err = await openBillingPortal(doctor.id)
    if (err) {
      setOpening(false)
      showToast(err, 'warning')
    }
  }

  const sub = data?.subscription ?? null
  const plan = PLANS.find((p) => p.id === sub?.plan)
  const upcoming = data?.upcoming ?? null
  // Les prix sont affichés comme Stripe les débite : « HT » seulement si une taxe s'y ajoute.
  const taxed = (upcoming?.tax ?? 0) > 0 || (data?.invoices ?? []).some((i) => i.tax > 0)
  const nextLine = !sub
    ? null
    : sub.cancel_at_period_end || sub.cancel_at
      ? { label: 'Fin de l’abonnement', value: day(sub.cancel_at ?? sub.current_period_end) }
      : {
          label: sub.status === 'trialing' ? 'Premier prélèvement' : 'Prochain prélèvement',
          value: upcoming
            ? `${money(upcoming.amount_due, sub.currency)} le ${day(upcoming.date ?? (sub.status === 'trialing' ? sub.trial_end : sub.current_period_end))}`
            : day(sub.status === 'trialing' ? sub.trial_end : sub.current_period_end),
        }

  return (
    <div className="flex flex-col gap-[22px]" style={{ animation: 'nb-rise 0.35s var(--ease-standard) both' }}>
      <div className="p-[clamp(1.5rem,4vw,32px)]" style={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
              Abonnement en cours
            </div>
            <div className="font-display mt-2 text-[26px]" style={{ color: 'var(--text-primary)' }}>
              {data === null && !error ? '…' : sub ? `Woui ${plan?.name ?? ''}` : 'Aucun abonnement payant'}
            </div>
          </div>
          {doctor.stripe_customer_id && (
            <Button variant="primary" onClick={openPortal} disabled={opening}>
              {opening ? 'Ouverture…' : 'Gérer sur Stripe ↗'}
            </Button>
          )}
        </div>

        {sub && (
          <dl className="m-0 mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Montant', `${money(sub.amount, sub.currency)}${taxed ? ' HT' : ''} / ${sub.interval === 'yearly' ? 'an' : 'mois'}`],
              ...(sub.seats > 0 ? [['Praticiens en plus', String(sub.seats)]] : []),
              ...(nextLine ? [[nextLine.label, nextLine.value]] : []),
              [
                'Moyen de paiement',
                sub.card ? `${BRANDS[sub.card.brand] ?? sub.card.brand} •••• ${sub.card.last4} · ${String(sub.card.exp_month).padStart(2, '0')}/${String(sub.card.exp_year).slice(-2)}` : 'À ajouter',
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </dt>
                <dd className="m-0 mt-1 text-[0.9375rem] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {sub && (sub.cancel_at_period_end || sub.cancel_at) && (
          <div
            className="mt-6 rounded-[12px] p-4 text-[0.875rem] leading-[1.55]"
            style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--text-primary)' }}
          >
            <b>Résiliation enregistrée.</b> Vos accès restent ouverts jusqu’au {day(sub.cancel_at ?? sub.current_period_end)}, fin de la période déjà payée. Ensuite,
            Woui sera verrouillé jusqu’à la reprise de l’abonnement. Vous avez changé d’avis ? « Gérer sur Stripe » puis « Renouveler l’abonnement ».
          </div>
        )}
        <p className="mb-0 mt-6 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Montants nets, {VAT_NOTE}. Ce sont ceux que Stripe débite, sans frais ajoutés. Sur Stripe : changer de carte (ou passer au prélèvement SEPA), d’offre ou
          de rythme de paiement, mettre à jour l’adresse de facturation.
        </p>
        {sub && sub.status !== 'canceled' && !sub.cancel_at_period_end && !sub.cancel_at && (
          <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {confirmCancel ? (
              <div className="flex flex-col gap-3">
                <p className="m-0 max-w-[620px] text-[0.875rem] leading-[1.55]" style={{ color: 'var(--text-secondary)' }}>
                  L’abonnement s’arrêtera le <b style={{ color: 'var(--text-primary)' }}>{day(sub.status === 'trialing' ? sub.trial_end : sub.current_period_end)}</b>,
                  à la fin de la période {sub.status === 'trialing' ? 'd’essai' : 'déjà payée'}, sans autre prélèvement. Après cette date, plus aucun envoi n’est possible et
                  le tableau de bord est verrouillé. Les documents signés restent téléchargeables (archive annuelle) pour vos obligations de conservation.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="danger"
                    disabled={cancelling}
                    onClick={async () => {
                      setCancelling(true)
                      const err = await openCancelSubscription(doctor.id)
                      if (err) {
                        setCancelling(false)
                        showToast(err, 'warning')
                      }
                    }}
                  >
                    {cancelling ? 'Ouverture…' : 'Continuer vers la résiliation'}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmCancel(false)} disabled={cancelling}>
                    Garder mon abonnement
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="cursor-pointer text-[13px] font-semibold"
                style={{ background: 'none', border: 0, padding: 0, color: 'var(--danger-text)' }}
              >
                Résilier mon abonnement
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-[clamp(1.5rem,4vw,32px)]" style={card}>
        <h2 className="font-display mb-5 text-[22px]" style={{ color: 'var(--text-primary)' }}>
          Factures
        </h2>
        {error ? (
          <p className="m-0 text-[0.9375rem]" style={{ color: 'var(--danger-text)' }}>
            {error}
          </p>
        ) : data === null ? (
          <p className="m-0 text-[0.9375rem]" style={{ color: 'var(--text-muted)' }}>
            Chargement des factures…
          </p>
        ) : data.invoices.length === 0 ? (
          <p className="m-0 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            Aucune facture pour l’instant. La première arrive au premier prélèvement.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[0.875rem]">
              <thead>
                <tr>
                  {['Date', 'Objet', taxed ? 'Montant TTC' : 'Montant', 'Statut', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`pb-3 font-mono text-[10px] font-normal uppercase tracking-[0.12em] ${i === 2 ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => {
                  const st = INVOICE_STATUS[inv.status ?? ''] ?? INVOICE_STATUS.void
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="py-3 pr-4" style={{ color: 'var(--text-primary)' }}>
                        {day(inv.created)}
                      </td>
                      <td className="py-3 pr-4" style={{ color: 'var(--text-secondary)' }}>
                        {invoiceSubject(inv)}
                        <span className="block font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {inv.number ?? ''}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {money(inv.total, inv.currency)}
                        {inv.tax > 0 && (
                          <span className="block text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
                            dont TVA {money(inv.tax, inv.currency)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-full px-[10px] py-[3px] text-[11px] font-medium" style={{ background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-flex gap-4 text-[13px]">
                          {inv.status === 'open' && inv.hosted_invoice_url ? (
                            <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-accent)', fontWeight: 600 }}>
                              Régler
                            </a>
                          ) : (
                            inv.hosted_invoice_url && (
                              <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-accent)' }}>
                                Voir
                              </a>
                            )
                          )}
                          {inv.invoice_pdf && (
                            <a href={inv.invoice_pdf} style={{ color: 'var(--text-accent)' }}>
                              ↓ PDF
                            </a>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
