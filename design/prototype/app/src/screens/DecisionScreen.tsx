import { Link } from 'react-router-dom'
import { DECISION, EVIDENCE } from '../data/decision'
import { RANKED_FUTURES } from '../data/futures'
import { cx } from '../ui/cx'
import { Eyebrow } from '../ui/Eyebrow'
import { pillBase, pillGhost, pillPrimary } from '../ui/pill'
import { Screen } from '../ui/Screen'
import { useWorkspace } from '../workspace/workspace-context'

function ConfidenceStat({
  label,
  value,
  caption,
}: {
  label: string
  value: string
  caption: string
}) {
  return (
    <div>
      <div className="mb-2 font-mono text-[9.5px] tracking-[0.16em] text-faint">{label}</div>
      <div className="font-serif text-[28px]">{value}</div>
      <div className="text-[11.5px] text-muted">{caption}</div>
    </div>
  )
}

export function DecisionScreen() {
  const { selectFuture, go } = useWorkspace()

  return (
    <Screen className="max-w-[1000px]">
      <Eyebrow className="mb-[18px]">DECISION</Eyebrow>
      <h1 className="mb-[18px] font-serif text-[34px] leading-[1.1] font-normal tracking-[-0.01em] sm:text-[40px] lg:text-[46px]">
        {DECISION.title}
      </h1>
      <p className="mb-[22px] max-w-[62ch] font-serif text-[19px] leading-[1.55] text-pretty text-sand">
        {DECISION.objective}
      </p>
      <div className="flex flex-wrap gap-x-7 gap-y-2 border-b border-line-soft pb-10 text-[12px] text-muted">
        {DECISION.meta.map((item) => (
          <span key={item.label}>
            {item.label} <span className="text-sand">{item.value}</span>
          </span>
        ))}
      </div>

      <section className="border-b border-line-soft py-10 lg:py-[46px]">
        <Eyebrow className="mb-[26px]">RECOMMENDATION</Eyebrow>
        <div className="mb-3.5 font-mono text-[10px] tracking-[0.16em] text-chronos">
          {DECISION.recommendation.badge}
        </div>
        <h2 className="mb-5 max-w-[30ch] font-serif text-[26px] leading-[1.24] font-normal tracking-[-0.01em] sm:text-[30px] lg:text-[34px]">
          {DECISION.recommendation.headline}
        </h2>
        <p className="mb-[30px] max-w-[60ch] font-serif text-[18px] leading-[1.6] text-pretty text-sand">
          {DECISION.recommendation.body}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => go('/simulation')}
            className={cx(pillBase, pillPrimary, 'px-[18px] py-[11px]')}
          >
            Collapse to this future <span>→</span>
          </button>
          <button
            type="button"
            onClick={() => go('/simulation')}
            className={cx(pillBase, pillGhost, 'px-[18px] py-[11px]')}
          >
            Inspect the branch
          </button>
        </div>
      </section>

      <section className="border-b border-line-soft py-10 lg:py-[46px]">
        <Eyebrow className="mb-[30px]">CONFIDENCE</Eyebrow>
        <div className="flex flex-wrap items-start gap-x-14 gap-y-8">
          <div>
            <div className="font-serif text-[56px] leading-[0.9] font-normal text-chronos sm:text-[76px]">
              {DECISION.confidence.value}
            </div>
            <div className="mt-2.5 text-[12.5px] text-muted">{DECISION.confidence.caption}</div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-x-11 gap-y-7 pt-1.5 sm:grid-cols-3">
            {DECISION.confidence.stats.map((stat) => (
              <ConfidenceStat key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line-soft py-10 lg:py-[46px]">
        <div className="mb-[26px] flex items-baseline justify-between gap-4">
          <Eyebrow>EVIDENCE · 9 SOURCES</Eyebrow>
          <Link to="/knowledge">All knowledge →</Link>
        </div>
        <div className="flex flex-col">
          {EVIDENCE.map((row, i) => (
            <button
              key={row.name}
              type="button"
              onClick={() => go('/knowledge')}
              className={cx(
                'flex cursor-pointer flex-col gap-1 border-t border-line-soft px-1 py-3.5 text-left transition-colors hover:bg-field',
                'md:grid md:grid-cols-[1fr_150px_90px_70px] md:items-center md:gap-5',
                i === EVIDENCE.length - 1 && 'border-b',
              )}
            >
              <div className="flex items-baseline justify-between gap-4 md:contents">
                <span className="md:order-1">{row.name}</span>
                <span
                  className={cx(
                    'flex-none font-mono text-[11px] md:order-4 md:text-right',
                    row.weight === 'HIGH' ? 'text-chronos' : 'text-muted',
                  )}
                >
                  {row.weight}
                </span>
              </div>
              <div className="flex gap-3 text-[12px] text-muted md:contents">
                <span className="md:order-2">{row.kind}</span>
                <span className="md:order-3">{row.age}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="pt-10 lg:pt-[46px]">
        <div className="mb-[26px] flex items-baseline justify-between gap-4">
          <Eyebrow>RANKED FUTURES · 31 SIMULATED</Eyebrow>
          <Link to="/simulation">Open simulation →</Link>
        </div>
        <div className="flex flex-col gap-2.5">
          {RANKED_FUTURES.map((future) => (
            <button
              key={future.key}
              type="button"
              onClick={() => selectFuture(future.key)}
              className={cx(
                'flex cursor-pointer flex-wrap items-baseline gap-x-[22px] gap-y-2 rounded-xl border px-5 py-[18px] text-left transition-colors',
                future.recommended
                  ? 'border-line-strong bg-field hover:border-accent-line'
                  : 'border-line hover:border-muted',
              )}
            >
              <span
                className={cx(
                  'min-w-[62px] font-serif text-[26px]',
                  future.recommended ? 'text-chronos' : 'text-sand',
                )}
              >
                {future.pct}
              </span>
              <div className="min-w-[200px] flex-1">
                <div className="mb-[5px]">{future.listTitle}</div>
                <div className="text-[12px] text-muted">{future.listMeta}</div>
              </div>
              <span
                className={cx(
                  'font-mono text-[10px] tracking-[0.14em]',
                  future.recommended ? 'text-chronos' : 'text-muted',
                )}
              >
                {future.verdict}
              </span>
            </button>
          ))}
        </div>
      </section>
    </Screen>
  )
}
