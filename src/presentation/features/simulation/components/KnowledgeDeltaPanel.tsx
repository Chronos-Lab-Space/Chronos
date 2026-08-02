import { Link } from "react-router-dom";
import {
  deriveKnowledgeDelta,
  type KnowledgeDelta,
} from "../../../../domain/workspace/knowledgeDelta";
import type { SimulationRecord, WorkspaceHome } from "../../../../domain/workspace/types";

/**
 * Knowledge-diff "replay" surface.
 *
 * Re-running the same inputs is a no-op for ranking (determinism). What
 * changed is the library. This panel shows added/removed items and offers
 * re-simulate — a new run with today's knowledge, not a fake time machine.
 */
export function KnowledgeDeltaPanel({
  home,
  simulation,
  onRerun,
  rerunning,
}: {
  home: WorkspaceHome;
  simulation: SimulationRecord;
  onRerun?: () => void;
  rerunning?: boolean;
}) {
  const delta = deriveKnowledgeDelta(home, simulation);

  return (
    <section
      data-testid="knowledge-delta"
      className="rounded-2xl border border-line bg-bg/50 p-5 sm:p-6"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
        Knowledge since this run
      </div>
      <h2 className="mt-2 font-serif text-xl text-ink">
        Would today&apos;s library change the path?
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">
        Replaying the same inputs reproduces the same ranking — that is the determinism guarantee.
        What can change is what you know: this compares the library stored on the run with the
        library now.
      </p>

      {delta.hasChanges ? (
        <>
          <DeltaLists delta={delta} />
          <div className="mt-5 flex flex-wrap gap-2">
            {onRerun && (
              <button
                type="button"
                data-testid="knowledge-delta-rerun"
                onClick={onRerun}
                disabled={rerunning}
                className="rounded-full bg-ink px-4 py-2 text-sm text-bg transition hover:bg-chronos disabled:opacity-50"
              >
                {rerunning ? "Re-simulating…" : "Re-simulate with current library"}
              </button>
            )}
            <Link
              to="/workspace/knowledge"
              className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-chronos/50 hover:text-chronos"
            >
              Open library
            </Link>
          </div>
        </>
      ) : (
        <p data-testid="knowledge-delta-empty" className="mt-4 text-sm text-ink-dim">
          Library matches this run ({delta.unchanged} item
          {delta.unchanged === 1 ? "" : "s"}). A re-run with the same inputs would rank the same
          way.
        </p>
      )}
    </section>
  );
}

function DeltaLists({ delta }: { delta: KnowledgeDelta }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div data-testid="knowledge-delta-added">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Added ({delta.added.length})
        </div>
        {delta.added.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">None</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {delta.added.map((item) => (
              <li key={item.id} className="text-sm text-ink">
                <span className="font-mono text-[10px] uppercase text-ink-faint">{item.type}</span>{" "}
                {item.title}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div data-testid="knowledge-delta-removed">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Removed ({delta.removed.length})
        </div>
        {delta.removed.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">None</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {delta.removed.map((item) => (
              <li key={item.id} className="text-sm text-ink-dim line-through">
                <span className="font-mono text-[10px] uppercase text-ink-faint">{item.type}</span>{" "}
                {item.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
