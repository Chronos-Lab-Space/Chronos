import { Link } from 'react-router-dom'
import { useWorkspace } from './workspace-context'

export function Header() {
  const { setPaletteOpen, navOpen, setNavOpen, contextOpen, setContextOpen } = useWorkspace()

  return (
    <header className="flex h-[62px] flex-none items-center gap-4 border-b border-line bg-void px-4 lg:gap-8 lg:px-6">
      <button
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={navOpen}
        onClick={() => setNavOpen(!navOpen)}
        className="flex h-[27px] w-[27px] flex-none cursor-pointer flex-col items-center justify-center gap-[4px] rounded-md border border-line-strong hover:border-muted lg:hidden"
      >
        <span className="block h-px w-[13px] bg-sand" />
        <span className="block h-px w-[13px] bg-sand" />
        <span className="block h-px w-[13px] bg-sand" />
      </button>

      <Link
        to="/decision"
        className="flex flex-none items-center gap-2.5 text-paper lg:w-[236px]"
        aria-label="Chronos Lab"
      >
        <img src="/favicon.svg" alt="" className="block h-[26px] w-[26px]" />
        <span className="font-wordmark text-[24px] leading-[0.82] font-semibold tracking-[-0.04em] italic">
          Chronos
        </span>
        <span className="pt-1 font-mono text-[9px] tracking-[0.18em] text-muted">LAB</span>
      </Link>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="mx-auto flex h-[34px] max-w-[520px] min-w-0 flex-1 cursor-text items-center gap-3 rounded-full border border-line-strong bg-field-mid px-3 text-muted transition-colors hover:border-muted"
      >
        <span className="flex-none font-mono text-[10px] tracking-[0.06em]">⌘K</span>
        <span className="truncate text-[13px]">Search, ask, or run a command…</span>
      </button>

      <div className="flex flex-none items-center gap-3.5">
        <span className="hidden font-mono text-[10px] tracking-[0.14em] text-muted md:inline">
          SYNCED 10:42
        </span>
        <div className="flex items-center gap-[9px]">
          <div className="flex h-[27px] w-[27px] items-center justify-center rounded-full border border-line-strong bg-accent-soft font-mono text-[10px] text-sand">
            JC
          </div>
          <span className="hidden text-sand sm:inline">Julien</span>
        </div>
        <button
          type="button"
          aria-label="Toggle context panel"
          aria-expanded={contextOpen}
          onClick={() => setContextOpen(!contextOpen)}
          className="cursor-pointer rounded-[3px] border border-line-strong px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.12em] text-muted hover:border-muted hover:text-paper xl:hidden"
        >
          CONTEXT
        </button>
      </div>
    </header>
  )
}
