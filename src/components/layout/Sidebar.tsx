import { NavLink, useNavigate } from 'react-router-dom'
import type { Doctor, Plan } from '../../types'
import { PLAN_LIMITS_LABEL, WOUI_LOGO_URL } from '../../lib/constants'

interface SidebarProps {
  doctor: Doctor
  plan: Plan
  consentsUsed: number
  onSignOut: () => void
}

const NAV = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/settings', icon: '⚙️', label: 'Paramètres' },
]

function getDoctorInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.trim()?.[0] ?? ''
  const last = lastName?.trim()?.[0] ?? ''
  const initials = `${first}${last}`.toUpperCase()
  return initials || '👨‍⚕️'
}

export function Sidebar({ doctor, plan, consentsUsed, onSignOut }: SidebarProps) {
  const navigate = useNavigate()
  const fullName = [doctor.first_name, doctor.last_name].filter(Boolean).join(' ') || doctor.email
  const limit = plan.limits.consents
  const pct = Math.min(100, (consentsUsed / (limit >= 999999 ? 100 : limit)) * 100)

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[230px] flex-shrink-0 flex-col p-[1.4rem_0.9rem] md:flex"
      style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-light)' }}
    >
      <div className="mb-9 flex items-center gap-[0.6rem] pl-[0.4rem]">
        <div
          className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] p-[6px]"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}
        >
          <img src={WOUI_LOGO_URL} alt="Woui" className="h-full w-full object-contain" />
        </div>
        <div>
          <div className="font-display text-base" style={{ color: 'var(--text-main)' }}>
            Woui
          </div>
          <div className="text-[0.67rem]" style={{ color: 'var(--text-dark)' }}>
            v1.0
          </div>
        </div>
      </div>

      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `mb-[0.22rem] flex w-full items-center gap-[0.7rem] rounded-[10px] px-[0.82rem] py-[0.62rem] text-[0.86rem] transition-all ${
              isActive ? 'text-[#38bdf8]' : 'text-[var(--text-muted)]'
            }`
          }
          style={({ isActive }) => ({
            background: isActive ? 'var(--hover-bg)' : 'none',
            border: `1px solid ${isActive ? 'rgba(14,165,233,0.25)' : 'transparent'}`,
          })}
        >
          <span>{item.icon}</span>
          {item.label}
        </NavLink>
      ))}

      <div className="mt-auto pt-4">
        <button
          onClick={() => navigate('/settings')}
          className="mb-[0.9rem] w-full cursor-pointer rounded-xl p-[0.8rem] text-left"
          style={{ background: `${plan.color}12`, border: `1px solid ${plan.color}30` }}
        >
          <div className="mb-[0.4rem] flex items-center justify-between">
            <span className="text-[0.78rem] font-semibold" style={{ color: plan.accent }}>
              Plan {plan.name}
            </span>
            <span className="text-[0.68rem]" style={{ color: 'var(--text-dark)' }}>
              {consentsUsed}/{PLAN_LIMITS_LABEL(limit)}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded" style={{ background: 'var(--bg-input)' }}>
            <div className="h-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${plan.color}, ${plan.accent})` }} />
          </div>
        </button>

        <div className="flex items-center gap-[0.6rem] rounded-[10px] p-[0.65rem_0.8rem]" style={{ background: 'var(--bg-input)' }}>
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[0.8rem] font-semibold tracking-widest text-white"
            style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}
          >
            {getDoctorInitials(doctor.first_name, doctor.last_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.76rem] font-medium" style={{ color: 'var(--text-muted)' }}>
              {fullName}
            </div>
          </div>
          <button
            onClick={onSignOut}
            title="Se déconnecter"
            className="flex-shrink-0 cursor-pointer rounded-md border-none bg-transparent p-1 text-[0.9rem]"
            style={{ color: 'var(--text-dark)' }}
          >
            ⎋
          </button>
        </div>
      </div>
    </aside>
  )
}
