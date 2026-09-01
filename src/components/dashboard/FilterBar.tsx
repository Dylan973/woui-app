import type { Consent, ConsentStatus } from '../../types'

export type FilterKey = 'all' | ConsentStatus

interface FilterBarProps {
  consents: Consent[]
  filter: FilterKey
  onChange: (f: FilterKey) => void
}

const FILTERS: [FilterKey, string][] = [
  ['all', 'Tous'],
  ['sent', 'Envoyés'],
  ['opened', 'Ouverts'],
  ['viewed', 'Visionnés'],
  ['signed', 'Signés'],
]

export function FilterBar({ consents, filter, onChange }: FilterBarProps) {
  return (
    <div className="mb-[1.1rem] flex flex-wrap gap-[0.45rem]">
      {FILTERS.map(([key, label]) => {
        const active = filter === key
        const count = key === 'all' ? consents.length : consents.filter((c) => c.status === key).length
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="cursor-pointer rounded-lg px-[0.85rem] py-[0.38rem] text-[0.8rem]"
            style={{
              background: active ? 'var(--hover-bg)' : 'none',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--border-color)'}`,
              color: active ? '#38bdf8' : 'var(--text-dark)',
            }}
          >
            {label}{' '}
            <span
              className="ml-1 rounded px-[0.38rem] text-[0.7rem]"
              style={{ background: active ? 'rgba(14,165,233,0.15)' : 'var(--border-color)' }}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
