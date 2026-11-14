type RppsStatus = 'unverified' | 'verified' | 'mismatch' | 'not_found'

const LABELS: Record<RppsStatus, string> = {
  verified: 'RPPS vérifié',
  unverified: 'RPPS en attente de vérification',
  mismatch: 'RPPS : nom à contrôler',
  not_found: 'RPPS introuvable',
}

/** État de la vérification du numéro RPPS dans l'Annuaire Santé. */
export function RppsBadge({ status = 'unverified', identity }: { status?: RppsStatus; identity?: string | null }) {
  const ok = status === 'verified'
  const neutral = status === 'unverified'
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        className="font-mono rounded-[3px] px-2 py-[3px] text-[10px] uppercase tracking-[0.1em]"
        style={{
          background: ok ? 'var(--mint-soft)' : neutral ? 'var(--surface-card-alt)' : 'var(--danger-bg)',
          color: ok ? 'var(--status-signed-text)' : neutral ? 'var(--text-muted)' : 'var(--danger-text)',
        }}
      >
        {LABELS[status]}
      </span>
      {status === 'mismatch' && identity && <span>Annuaire : « {identity} »</span>}
      {status === 'not_found' && <span>Les envois de ce praticien sont bloqués tant qu’il n’est pas corrigé.</span>}
    </span>
  )
}
