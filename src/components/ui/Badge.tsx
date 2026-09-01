import { STATUS_CONFIG } from '../../lib/constants'
import type { ConsentStatus } from '../../types'

export function Badge({ status }: { status: ConsentStatus }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.sent
  return (
    <span
      className="inline-flex items-center gap-[0.4rem] rounded-full px-[0.65rem] py-[0.22rem] text-[0.73rem] whitespace-nowrap"
      style={{ background: `${s.dot}22`, border: `1px solid ${s.dot}55`, color: s.color }}
    >
      <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}
