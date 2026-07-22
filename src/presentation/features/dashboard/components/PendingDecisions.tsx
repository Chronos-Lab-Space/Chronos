import { Link } from "react-router-dom";
import type { PendingDecision } from "../../../../domain/workspace/workspaceMemory";

type Props = {
  pending: readonly PendingDecision[];
};

/** What decisions are pending? */
export function PendingDecisions({ pending }: Props) {
  return (
    <section className="rounded-2xl border border-line p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          What decisions are pending?
        </div>
        <span className="font-mono text-[11px] text-chronos">{pending.length}</span>
      </div>

      {pending.length === 0 ? (
        <p className="mt-4 text-sm text-ink-dim">
          No open decisions — every completed run has a saved path and outcome feedback.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {pending.slice(0, 5).map((item) => (
            <li key={`${item.simulationId}-${item.reason}`}>
              <Link
                to={item.href}
                className="block rounded-xl border border-line px-4 py-3 transition hover:border-chronos/40 hover:bg-chronos/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[15px] text-ink">{item.title}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-chronos">
                    {item.reason === "choose_path"
                      ? "Choose path"
                      : item.reason === "record_followed"
                        ? "Follow-through"
                        : "Outcome"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-dim">{item.detail}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
