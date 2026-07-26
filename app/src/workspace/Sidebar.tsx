import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cx } from '../ui/cx'
import { useWorkspace } from './workspace-context'

const NAV = [
  { to: '/decision', label: 'Current Decision', dot: true },
  { to: '/knowledge', label: 'Knowledge', badge: '9' },
  { to: '/simulation', label: 'Simulations', badge: '31' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/memory', label: 'Memory', badge: '14' },
]

function NavRow({
  to,
  label,
  badge,
  dot,
  onNavigate,
}: {
  to: string
  label: string
  badge?: string
  dot?: boolean
  onNavigate: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(
          'flex items-center justify-between rounded-lg px-[11px] py-[9px] transition-colors hover:bg-field-hi',
          isActive ? 'bg-accent-soft text-paper' : 'text-muted',
        )
      }
    >
      <span>{label}</span>
      {dot && (
        <span className="h-[5px] w-[5px] animate-chpulse rounded-full bg-chronos" aria-hidden />
      )}
      {badge && <span className="font-mono text-[10px] text-faint">{badge}</span>}
    </NavLink>
  )
}

function SecondaryRow({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="cursor-pointer rounded-lg px-[11px] py-[9px] text-left text-muted transition-colors hover:bg-field-hi hover:text-paper"
    >
      {children}
    </button>
  )
}

export function Sidebar() {
  const { stateLabel, navOpen, setNavOpen } = useWorkspace()
  const close = () => setNavOpen(false)

  return (
    <>
      {navOpen && (
        <div
          className="fixed inset-0 top-[62px] z-40 bg-black/60 lg:hidden"
          onClick={close}
          aria-hidden
        />
      )}
      <nav
        className={cx(
          'fixed top-[62px] bottom-0 left-0 z-50 flex w-[236px] flex-none flex-col gap-[3px] overflow-y-auto border-r border-line bg-void px-3.5 py-[22px] transition-transform duration-200',
          'lg:static lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="px-2.5 pb-3 font-mono text-[9.5px] tracking-[0.2em] text-faint">
          WORKSPACE
        </div>

        {NAV.map((item) => (
          <NavRow key={item.to} {...item} onNavigate={close} />
        ))}

        <div className="mx-2.5 my-4 h-px bg-line" />
        <SecondaryRow>Reports</SecondaryRow>
        <SecondaryRow>Settings</SecondaryRow>

        <div className="mt-auto rounded-xl border border-line bg-field p-3.5">
          <div className="mb-[9px] font-mono text-[9px] tracking-[0.18em] text-faint">
            ACTIVE DECISION
          </div>
          <div className="mb-3.5 font-serif text-[18px] leading-[1.25] text-paper">
            Launch Chronos Public&nbsp;Beta
          </div>
          <div className="flex flex-col gap-[7px] text-[12px]">
            <div className="flex justify-between">
              <span className="text-muted">State</span>
              <span className="text-chronos">{stateLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Confidence</span>
              <span>72%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Window</span>
              <span>17 days left</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-[9px] px-2.5 pt-4 pb-0.5">
          <img src="/favicon.svg" alt="" className="block h-4 w-4 flex-none opacity-[0.85]" />
          <div>
            <div className="text-[11px] text-sand">Chronos Lab</div>
            <div className="font-mono text-[9px] tracking-[0.04em] text-muted">
              Decision infrastructure
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
