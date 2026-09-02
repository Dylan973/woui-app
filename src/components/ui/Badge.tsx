import { STATUS_CONFIG } from '../../lib/constants'
import type { ConsentStatus } from '../../types'

export function Badge({ status }: { status: ConsentStatus }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.sent
  return (
    <span
      className="font-mono inline-flex items-center gap-[6px] whitespace-nowrap px-[10px] py-1 text-[11px] uppercase tracking-[0.08em]"
      style={{ background: s.bg, color: s.fg, borderRadius: 999 }}
    >
      <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}
