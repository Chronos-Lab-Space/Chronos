import { Link } from "react-router-dom";
import { evaluateMvpGates, nextMvpGate } from "../../../../domain/workspace/mvpGates";
import type { WorkspaceHome } from "../../../../domain/workspace/types";

/**
 * Surface the recommended build order as progressive, usable value —
 * not a full OS, just the path that validates Chronos' differentiator.
 */
export function MvpProgress({ home }: { home: WorkspaceHome }) {
  const gates = evaluateMvpGates(home);
  const next = nextMvpGate(home);
  const doneCount = gates.filter((g) => g.done).length;

  return (
    <section className="border border-line p-4 transition hover:border-line-strong">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          MVP path · {doneCount}/{gates.length}
        </div>
        {next ? (
          <Link to={next.href} className="text-sm text-chronos transition hover:text-ink">
            Next: {next.cta} →
          </Link>
        ) : (
          <span className="text-sm text-chronos">Core loop validated</span>
        )}
      </div>

      <ol className="ws-cascade mt-4 flex flex-wrap gap-2">
        {gates.map((gate) => (
          <li key={gate.id}>
            <Link
              to={gate.href}
              title={gate.usableWhen}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition ${
                gate.done
                  ? "bg-chronos/15 text-chronos"
                  : next?.id === gate.id
                    ? "border border-chronos/40 text-ink"
                    : "border border-line text-ink-faint hover:border-line-strong hover:text-ink-dim"
              }`}
            >
              <span>{gate.done ? "✓" : gate.phase}</span>
              <span>{gate.label}</span>
            </Link>
          </li>
        ))}
      </ol>

      {next && (
        <p className="mt-3 text-sm text-ink-dim">
          <span className="text-ink">Phase {next.phase} — {next.label}:</span>{" "}
          {next.usableWhen}
        </p>
      )}
    </section>
  );
}
