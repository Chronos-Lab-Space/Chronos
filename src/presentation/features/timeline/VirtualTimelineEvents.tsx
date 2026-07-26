import type { LogEntry } from "../../../domain/chronos/types";
import { VirtualList } from "../visualization/VirtualList";

type VirtualTimelineEventsProps = {
  events: readonly LogEntry[];
  height?: number;
};

/** Virtualized replay/event timeline for long-running simulations. */
export function VirtualTimelineEvents({ events, height = 300 }: VirtualTimelineEventsProps) {
  const newestFirst = [...events].reverse();

  return (
    <VirtualList
      items={newestFirst}
      height={height}
      rowHeight={34}
      overscan={6}
      getKey={(event) => event.id}
      className="-mx-1 px-1"
      renderRow={(event) => (
        <div className="flex h-[30px] items-start gap-2 font-mono text-[11px] leading-[1.5]">
          <span
            className="mt-1 h-1 w-1 shrink-0 rounded-full"
            style={{ background: event.color }}
          />
          <span style={{ color: event.color }}>→</span>
          <span className="truncate text-ink-dim">{event.message}</span>
        </div>
      )}
    />
  );
}
