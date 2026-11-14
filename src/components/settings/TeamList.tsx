import { ProfileAvatar } from '../profiles/ProfileAvatar'
import { RppsBadge } from '../profiles/RppsBadge'
import { profileName } from '../../lib/profiles'
import type { Profile } from '../../types'

/** Paramètres > Équipe : profils déjà créés et places restantes (ex. « 3 / 4 »). */
export function TeamList({ profiles, total }: { profiles: Profile[]; total: number }) {
  const used = profiles.length
  const left = Math.max(total - used, 0)
  return (
    <div className="mb-7 max-w-[700px]">
      <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-1">
        <span className="font-display text-[34px] leading-none tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {used}
          <span style={{ color: 'var(--text-muted)' }}> / {total}</span>
        </span>
        <span className="pb-[3px] text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
          profil{used > 1 ? 's' : ''} créé{used > 1 ? 's' : ''} ·{' '}
          {left > 0 ? `${left} encore possible${left > 1 ? 's' : ''}` : 'toutes les places sont prises'}
        </span>
      </div>
      <div className="mb-5 flex h-[6px] overflow-hidden rounded-full" style={{ background: 'var(--surface-card-alt)' }} aria-hidden="true">
        <div style={{ width: `${total ? Math.min(100, (used / total) * 100) : 0}%`, background: 'var(--accent)' }} />
      </div>
      <ul className="m-0 flex flex-col p-0" style={{ listStyle: 'none' }}>
        {profiles.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <ProfileAvatar profile={p} className="h-9 w-9 rounded-[6px] text-[13px]" />
            <div className="min-w-[180px] flex-1">
              <div className="text-[0.9375rem] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {profileName(p)}
              </div>
              <div className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                {p.specialty || '—'}
                {p.isMain ? ' · titulaire' : ''}
                {p.signature_path ? ' · signature et tampon ✓' : ' · signature et tampon à importer'}
              </div>
            </div>
            {p.rpps && <RppsBadge status={p.rpps_status} identity={p.rpps_identity} />}
          </li>
        ))}
        {Array.from({ length: Math.min(left, 6) }).map((_, i) => (
          <li
            key={`free-${i}`}
            className="flex items-center gap-3 py-3 text-[0.875rem]"
            style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[6px]" style={{ border: '1px dashed var(--border-default)' }}>
              +
            </span>
            Place libre
          </li>
        ))}
      </ul>
    </div>
  )
}
