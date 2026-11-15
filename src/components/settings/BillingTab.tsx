import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { callFunction } from '../../lib/functions'
import { openBillingPortal } from '../../lib/billing'
import { PLANS } from '../../lib/constants'
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
  description: string | null
}

const card = { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }

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
  const [data, setData] = useState<{ subscription: Subscription | null; invoices: Invoice[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    let cancelled = false
    void callFunction<{ subscription: Subscription | null; invoices: Invoice[] }>('stripe-billing', {}, { cabinetOf: doctor.id }).then((r) => {
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
  const nextLine = !sub
    ? null
    : sub.cancel_at_period_end || sub.cancel_at
      ? { label: 'Fin de l’abonnement', value: day(sub.cancel_at ?? sub.current_period_end) }
      : sub.status === 'trialing'
        ? { label: 'Premier prélèvement', value: day(sub.trial_end) }
        : { label: 'Prochain prélèvement', value: day(sub.current_period_end) }

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
              ['Montant', `${money(sub.amount, sub.currency)} HT / ${sub.interval === 'yearly' ? 'an' : 'mois'}`],
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
        <p className="mb-0 mt-6 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Sur Stripe : changer de carte, d’offre ou de rythme de paiement, mettre à jour l’adresse de facturation, résilier.
        </p>
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
                  {['Date', 'Numéro', 'Montant TTC', 'Statut', ''].map((h, i) => (
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
                      <td className="py-3 pr-4 font-mono text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                        {inv.number ?? '—'}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {money(inv.total, inv.currency)}
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
