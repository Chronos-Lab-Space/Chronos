import { FUTURES, RANKED_FUTURES } from '../data/futures'
import { cx } from '../ui/cx'
import { Eyebrow } from '../ui/Eyebrow'
import { pillBase, pillGhost, pillPrimary } from '../ui/pill'
import { Screen } from '../ui/Screen'
import { useWorkspace } from '../workspace/workspace-context'
import { FutureGraph } from './FutureGraph'

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.14em] text-faint">{label}</div>
      <div className="font-serif text-[22px]">{value}</div>
    </div>
  )
}

export function SimulationScreen() {
  const { selected, selectFuture, setStep } = useWorkspace()
  const future = FUTURES[selected]

  return (
    <Screen>
      <Eyebrow className="mb-[18px]">SIMULATION · RUN 31</Eyebrow>
      <h1 className="mb-3.5 font-serif text-[30px] leading-[1.15] font-normal lg:text-[38px]">
        Ranked futures
      </h1>
      <p className="mb-[38px] max-w-[60ch] font-serif text-[18px] leading-[1.55] text-sand">
        Every branch is a path the launch could take. Select one to read its narrative, its cost,
        and where it breaks.
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] items-start gap-12">
        <div>
          <Eyebrow className="mb-4">FUTURE GRAPH</Eyebrow>
          <div className="rounded-2xl border border-line bg-field p-2">
            <FutureGraph />
          </div>
          <div className="mt-3.5 flex flex-wrap gap-5 font-mono text-[10px] tracking-[0.12em] text-faint">
            <span>CLICK A NODE TO INSPECT</span>
            <span>31 RUNS · SEED 4471</span>
          </div>
        </div>

        <div>
          <Eyebrow className="mb-4">SELECTED FUTURE</Eyebrow>
          <div className="rounded-2xl border border-line-strong bg-field p-[26px]">
            <div className="mb-3 font-mono text-[10px] tracking-[0.16em] text-chronos">
              {future.badge}
            </div>
            <h3 className="mb-3.5 font-serif text-[27px] leading-[1.25] font-normal">
              {future.title}
            </h3>
            <p className="mb-6 font-serif text-[17px] leading-[1.6] text-pretty text-sand">
              {future.body}
            </p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-[18px] border-t border-line-soft pt-[22px] sm:grid-cols-2">
              <Metric label="COST / MO" value={future.cost} />
              <Metric label="SIGNUPS D+30" value={future.signups} />
              <Metric label="RETENTION" value={future.ret} />
              <div>
                <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.14em] text-faint">
                  FAILS WHEN
                </div>
                <div className="text-[13px] leading-[1.4] text-sand">{future.risk}</div>
              </div>
            </div>
            <div className="mt-[26px] flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setStep(3)}
                className={cx(pillBase, pillPrimary, 'px-4 py-2.5')}
              >
                Collapse to this future
              </button>
              <button type="button" className={cx(pillBase, pillGhost, 'px-4 py-2.5')}>
                Re-simulate branch
              </button>
            </div>
          </div>

          <Eyebrow className="mt-[34px] mb-3.5">ALL BRANCHES</Eyebrow>
          <div className="flex flex-col">
            {RANKED_FUTURES.map((branch, i) => (
              <button
                key={branch.key}
                type="button"
                onClick={() => selectFuture(branch.key)}
                className={cx(
                  'flex cursor-pointer items-center gap-4 border-t border-line-soft px-2.5 py-[13px] text-left transition-colors hover:bg-field-hi',
                  i === RANKED_FUTURES.length - 1 && 'border-b',
                  selected === branch.key && 'bg-accent-soft',
                )}
              >
                <span className="font-mono text-[11px] text-faint">{branch.rank}</span>
                <span className="min-w-0 flex-1 truncate">{branch.shortLabel}</span>
                <span
                  className={cx(
                    'font-serif text-[19px]',
                    branch.recommended ? 'text-chronos' : 'text-sand',
                  )}
                >
                  {branch.pct}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Screen>
  )
}
