import { MEMORY, MEMORY_STATS } from '../data/memory'
import { cx } from '../ui/cx'
import { Eyebrow } from '../ui/Eyebrow'
import { Screen } from '../ui/Screen'

export function MemoryScreen() {
  return (
    <Screen className="max-w-[900px]">
      <Eyebrow className="mb-[18px]">MEMORY · 14 CLOSED DECISIONS</Eyebrow>
      <h1 className="mb-3.5 font-serif text-[30px] leading-[1.15] font-normal lg:text-[38px]">
        What Chronos has learned
      </h1>
      <p className="mb-11 max-w-[58ch] font-serif text-[18px] leading-[1.55] text-sand">
        Each closed decision leaves a correction behind. These are the priors now shaping the launch
        recommendation.
      </p>

      <div className="mb-2 flex flex-wrap gap-x-11 gap-y-7 border-b border-line-soft pb-10">
        {MEMORY_STATS.map((stat) => (
          <div key={stat.label}>
            <div className="mb-2 font-mono text-[9.5px] tracking-[0.14em] text-faint">
              {stat.label}
            </div>
            <div className={cx('font-serif text-[34px]', stat.accent && 'text-chronos')}>
              {stat.value}
            </div>
            <div className="text-[11.5px] text-muted">{stat.caption}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col">
        {MEMORY.map((entry) => (
          <div key={entry.title} className="border-b border-line-soft px-1 py-[26px]">
            <div className="mb-[9px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <div className="font-serif text-[23px]">{entry.title}</div>
              <div
                className={cx(
                  'font-mono text-[10px] tracking-[0.14em]',
                  entry.hit ? 'text-chronos' : 'text-muted',
                )}
              >
                {entry.band}
              </div>
            </div>
            <div
              className={cx(
                'max-w-[62ch] leading-[1.65] text-sand',
                entry.footnote && 'mb-2.5',
              )}
            >
              {entry.lead} <span className="text-paper">Learned:</span> {entry.learned}
            </div>
            {entry.footnote && (
              <div
                className={cx(
                  'font-mono text-[10px] tracking-[0.12em]',
                  entry.footnote.accent ? 'text-chronos' : 'text-faint',
                )}
              >
                {entry.footnote.text}
              </div>
            )}
          </div>
        ))}
      </div>
    </Screen>
  )
}
