import { cx } from '../ui/cx'
import { DECISION_STATES } from './decision-states'
import { useWorkspace } from './workspace-context'

/** The persistent decision timeline: every decision advances through these six
 *  states, and the band is on every screen. */
export function StepperBand() {
  const { step, setStep } = useWorkspace()

  return (
    <div className="flex-none border-b border-line bg-void px-5 pt-5 pb-[18px] md:px-10">
      <div className="flex items-start overflow-x-auto">
        {DECISION_STATES.map((state, i) => {
          const isCurrent = i === step
          const isPast = i < step
          return (
            <button
              key={state.name}
              type="button"
              onClick={() => setStep(i)}
              aria-current={isCurrent ? 'step' : undefined}
              className={cx(
                'min-w-[150px] flex-1 shrink-0 cursor-pointer border-t-2 pt-3 pr-3 text-left transition-opacity last:pr-0 md:min-w-0 md:shrink',
                isCurrent
                  ? 'border-chronos opacity-100'
                  : isPast
                    ? 'border-accent-line opacity-[0.72]'
                    : 'border-line opacity-40',
              )}
            >
              <div className="mb-[5px] flex items-center gap-[7px]">
                <span className="font-mono text-[9.5px] tracking-[0.16em] text-faint">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[13.5px]">{state.name}</span>
              </div>
              <div className="text-[11.5px] text-muted">{state.sub}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
