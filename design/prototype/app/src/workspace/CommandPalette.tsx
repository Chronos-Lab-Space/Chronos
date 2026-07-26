import { useEffect, useMemo, useRef, useState } from 'react'
import { cx } from '../ui/cx'
import { buildCommands, filterCommands } from './commands'
import { useWorkspace } from './workspace-context'

export function CommandPalette() {
  const ws = useWorkspace()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rows = useRef<(HTMLButtonElement | null)[]>([])

  const commands = useMemo(() => filterCommands(buildCommands(ws), query), [ws, query])

  // Keep the highlight on a row that still exists as the list filters down.
  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    rows.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const move = (delta: number) => {
    if (commands.length === 0) return
    setActive((i) => (i + delta + commands.length) % commands.length)
  }

  return (
    <div
      onClick={() => ws.setPaletteOpen(false)}
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/62 px-4 pt-[14vh] backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command bar"
        className="w-[620px] max-w-[92vw] overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center gap-3 border-b border-line px-[18px] py-4">
          <span className="font-mono text-[13px] text-chronos">›</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                move(1)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                move(-1)
              } else if (e.key === 'Enter') {
                e.preventDefault()
                commands[active]?.run()
              }
            }}
            placeholder="Search, ask, or run a command…"
            className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-paper outline-none placeholder:text-muted"
          />
          <span className="flex-none rounded-[3px] border border-line-strong px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.12em] text-faint">
            ESC
          </span>
        </div>

        <div className="max-h-[46vh] overflow-y-auto p-2">
          {commands.map((command, i) => (
            <button
              key={command.label}
              type="button"
              ref={(el) => {
                rows.current[i] = el
              }}
              onClick={command.run}
              onMouseMove={() => setActive(i)}
              className={cx(
                'flex w-full cursor-pointer items-center gap-3.5 rounded-xl px-3 py-[11px] text-left',
                i === active && 'bg-accent-soft',
              )}
            >
              <span className="w-[62px] flex-none font-mono text-[9.5px] tracking-[0.14em] text-muted">
                {command.kind}
              </span>
              <span className="min-w-0 flex-1 truncate text-paper">{command.label}</span>
              <span className="flex-none text-[12px] text-muted">{command.hint}</span>
            </button>
          ))}
          {commands.length === 0 && (
            <div className="px-3 py-[22px] text-[13px] text-muted">
              No command matches. Press enter to ask Chronos instead.
            </div>
          )}
        </div>

        <div className="flex gap-[22px] border-t border-line px-[18px] py-[11px] font-mono text-[9.5px] tracking-[0.12em] text-faint">
          <span>↑↓ NAVIGATE</span>
          <span>↵ RUN</span>
          <span className="hidden sm:inline">TRY: SIMULATE LAUNCH · SHOW MEMORY · ADVANCE</span>
        </div>
      </div>
    </div>
  )
}
