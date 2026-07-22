import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../../../domain/workspace/pulse";
import type { ActivityItem } from "../../../../domain/workspace/workspaceMemory";

type Props = {
  items: readonly ActivityItem[];
};

const KIND_LABEL: Record<ActivityItem["kind"], string> = {
  goal: "Goal",
  simulation: "Sim",
  decision: "Decision",
  knowledge: "Knowledge",
  note: "Note",
  outcome: "Outcome",
};

/** What changed since last time? */
export function ActivityFeed({ items }: Props) {
  return (
    <section className="rounded-2xl border border-line p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          What changed since last time?
        </div>
        <Link
          to="/workspace/memory"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos"
        >
          Memory →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-dim">Nothing recorded yet — run a simulation to start memory.</p>
      ) : (
        <ul className="mt-4 space-y-0 divide-y divide-line">
          {items.map((item) => {
            const body = (
              <div className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    {KIND_LABEL[item.kind]}
                  </div>
                  <div className="mt-0.5 truncate text-[15px] text-ink">{item.title}</div>
                  <p className="mt-0.5 text-sm text-ink-dim">{item.detail}</p>
                </div>
                <time className="shrink-0 font-mono text-[11px] text-ink-faint">
                  {formatRelativeTime(item.at)}
                </time>
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link to={item.href} className="block hover:bg-chronos/5">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
