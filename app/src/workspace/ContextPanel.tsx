import { CONTEXT, NOTES } from '../data/context'
import { cx } from '../ui/cx'
import { Eyebrow } from '../ui/Eyebrow'
import { useWorkspace } from './workspace-context'
import type { ContextTab } from './workspace-context'

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-3 font-mono text-[9.5px] tracking-[0.16em] text-faint">{children}</div>
  )
}

function Tab({ id, label }: { id: ContextTab; label: string }) {
  const { tab, setTab } = useWorkspace()
  const active = tab === id
  return (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={cx(
        'cursor-pointer border-b pb-[3px] font-mono text-[9.5px] tracking-[0.14em] transition-colors',
        active ? 'border-chronos text-paper' : 'border-transparent text-faint',
      )}
    >
      {label}
    </button>
  )
}

function Details() {
  const { go, setStep } = useWorkspace()

  return (
    <div className="flex flex-col gap-[30px]">
      <div>
        <div className="mb-2.5 font-mono text-[9.5px] tracking-[0.16em] text-faint">OBJECTIVE</div>
        <div className="font-serif text-[16px] leading-[1.5] text-sand">{CONTEXT.objective}</div>
      </div>

      <div>
        <SectionLabel>CONSTRAINTS · 4 / 4 MET</SectionLabel>
        <div className="flex flex-col gap-[9px] text-[12.5px]">
          {CONTEXT.constraints.map((constraint) => (
            <div key={constraint} className="flex gap-2.5">
              <span className="text-chronos">✓</span>
              <span className="text-sand">{constraint}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>TARGETS</SectionLabel>
        <div className="flex flex-col gap-[9px] text-[12.5px]">
          {CONTEXT.targets.map((target) => (
            <div key={target.label} className="flex justify-between">
              <span className="text-muted">{target.label}</span>
              <span>{target.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>MEMORY IN PLAY</SectionLabel>
        <div className="flex flex-col gap-3 text-[12.5px]">
          {CONTEXT.memoryInPlay.map((item) => (
            <button
              key={item.headline}
              type="button"
              onClick={() => go('/memory')}
              className="cursor-pointer text-left text-sand transition-colors hover:text-chronos"
            >
              {item.headline} <span className="text-muted">{item.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>RECENT ACTIVITY</SectionLabel>
        <div className="flex flex-col gap-[13px] text-[12.5px]">
          {CONTEXT.activity.map((entry) => (
            <div key={entry.at}>
              <div className="text-sand">{entry.label}</div>
              <div className="mt-[3px] font-mono text-[10px] tracking-[0.1em] text-faint">
                {entry.at}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line-soft pt-[22px]">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-[9.5px] tracking-[0.16em] text-faint">OUTCOME</span>
          <span className="rounded-[3px] border border-line-strong px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.12em] text-muted">
            NOT STARTED
          </span>
        </div>
        <div className="mb-3.5 text-[12.5px] leading-[1.6] text-muted">
          Log what actually happens after launch. Chronos re-weights the models that got it wrong.
        </div>
        <button
          type="button"
          onClick={() => setStep(4)}
          className="w-full cursor-pointer rounded-full border border-line-strong py-[9px] text-center text-[12.5px] text-sand transition-colors hover:border-accent-line hover:text-paper"
        >
          Log outcome
        </button>
      </div>
    </div>
  )
}

function Notes() {
  return (
    <div className="flex flex-col gap-[22px]">
      {NOTES.map((note) => (
        <div key={note.byline} className="border-l-2 border-line-strong pl-3.5">
          <div className="font-serif text-[16px] leading-[1.55] text-sand">{note.body}</div>
          <div className="mt-[9px] font-mono text-[9.5px] tracking-[0.12em] text-faint">
            {note.byline}
          </div>
        </div>
      ))}
      <div className="rounded-xl border border-dashed border-line-strong p-3.5 text-[12.5px] text-faint">
        Write a note…
      </div>
    </div>
  )
}

export function ContextPanel() {
  const { tab, contextOpen, setContextOpen } = useWorkspace()

  return (
    <>
      {contextOpen && (
        <div
          className="fixed inset-0 top-[62px] z-40 bg-black/60 xl:hidden"
          onClick={() => setContextOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={cx(
          'fixed top-[62px] right-0 bottom-0 z-50 w-[316px] max-w-[86vw] flex-none overflow-y-auto border-l border-line bg-void px-6 py-[26px] transition-transform duration-200',
          'xl:static xl:max-w-none xl:translate-x-0',
          contextOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="mb-[22px] flex items-center justify-between">
          <Eyebrow>CONTEXT</Eyebrow>
          <div className="flex gap-4">
            <Tab id="details" label="DETAILS" />
            <Tab id="notes" label="NOTES" />
          </div>
        </div>
        {tab === 'details' ? <Details /> : <Notes />}
      </aside>
    </>
  )
}
