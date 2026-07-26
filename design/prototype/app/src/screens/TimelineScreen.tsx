import { TIMELINE } from '../data/timeline'
import { cx } from '../ui/cx'
import { Eyebrow } from '../ui/Eyebrow'
import { Screen } from '../ui/Screen'
import { useWorkspace } from '../workspace/workspace-context'

export function TimelineScreen() {
  const { setStep } = useWorkspace()

  return (
    <Screen className="max-w-[860px]">
      <Eyebrow className="mb-[18px]">TIMELINE</Eyebrow>
      <h1 className="mb-3.5 font-serif text-[30px] leading-[1.15] font-normal lg:text-[38px]">
        How this decision got here
      </h1>
      <p className="mb-11 max-w-[58ch] font-serif text-[18px] leading-[1.55] text-sand">
        A decision doesn't end at "run simulation". Everything below is replayable — and the last
        two states haven't happened yet.
      </p>

      <div className="flex flex-col">
        {TIMELINE.map((entry) => (
          <div key={entry.date} className="flex">
            <div className="w-[52px] flex-none pt-px text-right font-mono text-[10.5px] tracking-[0.1em] text-faint md:w-[69px]">
              {entry.date}
            </div>
            <div
              className={cx(
                'ml-3 flex-1 border-l pb-[30px] pl-5 md:ml-[21px] md:pl-7',
                entry.current ? 'border-line-strong' : 'border-line',
              )}
            >
              <div
                className={cx(
                  'mb-[7px] font-mono text-[9.5px] tracking-[0.16em]',
                  entry.current ? 'text-chronos' : 'text-muted',
                )}
              >
                {entry.state}
              </div>
              <div className="mb-[7px] font-serif text-[22px]">{entry.headline}</div>
              <div className="max-w-[54ch] leading-[1.6] text-muted">{entry.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-[26px] flex flex-wrap items-center gap-x-[30px] gap-y-5 rounded-2xl border border-dashed border-line-strong px-5 py-[26px] md:px-[30px]">
        <div className="min-w-[240px] flex-1">
          <div className="mb-2 font-mono text-[9.5px] tracking-[0.16em] text-faint">
            AHEAD · OBSERVED, THEN LEARNED
          </div>
          <div className="mb-1.5 font-serif text-[21px]">Log the real outcome after 12 Aug</div>
          <div className="max-w-[52ch] leading-[1.6] text-muted">
            Chronos compares what happened to what it predicted, then re-weights the model that got
            it wrong.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setStep(4)}
          className="flex-none cursor-pointer rounded-full border border-accent-line px-[18px] py-[11px] text-[13px] text-paper transition-colors hover:border-chronos hover:text-chronos"
        >
          Log outcome →
        </button>
      </div>
    </Screen>
  )
}
