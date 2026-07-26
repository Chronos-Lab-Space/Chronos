import { KNOWLEDGE } from '../data/knowledge'
import { cx } from '../ui/cx'
import { Eyebrow } from '../ui/Eyebrow'
import { Screen } from '../ui/Screen'

export function KnowledgeScreen() {
  return (
    <Screen className="max-w-[900px]">
      <Eyebrow className="mb-[18px]">KNOWLEDGE · 9 SOURCES</Eyebrow>
      <h1 className="mb-3.5 font-serif text-[30px] leading-[1.15] font-normal lg:text-[38px]">
        Everything this decision is standing on
      </h1>
      <p className="mb-10 max-w-[58ch] font-serif text-[18px] leading-[1.55] text-sand">
        Sources are weighted by recency and how often the simulations actually leaned on them.
      </p>

      <div className="flex flex-col">
        {KNOWLEDGE.map((row, i) => (
          <div
            key={row.name}
            className={cx(
              'flex flex-col gap-1 border-t border-line-soft px-1 py-4',
              'md:grid md:grid-cols-[1fr_130px_90px_120px] md:items-center md:gap-5',
              i === KNOWLEDGE.length - 1 && 'border-b',
            )}
          >
            <div className="flex items-baseline justify-between gap-4 md:contents">
              <span className="md:order-1">{row.name}</span>
              <span
                className={cx(
                  'flex-none font-mono text-[10.5px] md:order-4 md:text-right',
                  row.leaned ? 'text-chronos' : 'text-muted',
                )}
              >
                {row.cited}
              </span>
            </div>
            <div className="flex gap-3 text-[12px] text-muted md:contents">
              <span className="md:order-2">{row.source}</span>
              <span className="md:order-3">{row.age}</span>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  )
}
