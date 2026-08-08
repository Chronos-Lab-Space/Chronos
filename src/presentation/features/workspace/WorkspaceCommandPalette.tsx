import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildPaletteCommands,
  filterPaletteCommands,
  knowledgeSearchCommand,
  type PaletteCommand,
} from "../../../domain/workspace/commandPalette";
import type { WorkspaceHome } from "../../../domain/workspace/types";

/**
 * ⌘K command palette — search, ask, or run a command.
 * Commands come from the pure domain builder; a query with no match falls
 * back to a knowledge search. Arrow keys move, Enter runs, Esc closes.
 */
export function WorkspaceCommandPalette({
  home,
  onClose,
}: {
  home: WorkspaceHome | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);

  const commands = useMemo<PaletteCommand[]>(() => {
    const matched = filterPaletteCommands(buildPaletteCommands(home), query);
    return matched.length > 0 ? matched : [knowledgeSearchCommand(query)];
  }, [home, query]);

  useEffect(() => {
    rows.current[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (command: PaletteCommand) => {
    onClose();
    navigate(command.href);
  };

  const move = (delta: number) => {
    setActive((i) => (i + delta + commands.length) % commands.length);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss; the dialog itself stays keyboard-first (Esc closes)
    <div
      data-testid="command-palette"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/[0.62] px-4 pt-[14vh] backdrop-blur-[3px]"
    >
      <div
        role="dialog"
        aria-label="Command palette"
        className="w-[620px] max-w-[92vw] overflow-hidden rounded-2xl border border-line-strong bg-[#141414] shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center gap-3 border-b border-line px-[18px] py-4">
          <span className="font-mono text-[13px] text-chronos">›</span>
          <input
            // biome-ignore lint/a11y/noAutofocus: a command palette exists to be typed into the moment it opens
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Keep the highlight on an existing row while the list filters down.
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                move(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                move(-1);
              } else if (e.key === "Enter") {
                e.preventDefault();
                const command = commands[active];
                if (command) run(command);
              }
            }}
            placeholder="Search, ask, or run a command…"
            className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
          <span className="shrink-0 rounded border border-line-strong px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            Esc
          </span>
        </div>

        <div className="max-h-[46vh] overflow-y-auto p-2">
          {commands.map((command, i) => (
            <button
              key={command.id}
              type="button"
              ref={(el) => {
                rows.current[i] = el;
              }}
              onClick={() => run(command)}
              onMouseMove={() => setActive(i)}
              className={`flex w-full items-center gap-3.5 rounded-xl px-3 py-[11px] text-left ${
                i === active ? "bg-chronos/15" : ""
              }`}
            >
              <span className="w-[62px] shrink-0 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
                {command.kind}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                {command.label}
              </span>
              <span className="shrink-0 truncate text-[12px] text-ink-faint">{command.hint}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-[22px] border-t border-line px-[18px] py-[11px] font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint/75">
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span className="hidden sm:inline">try: run simulation · show memory · advance</span>
        </div>
      </div>
    </div>
  );
}
