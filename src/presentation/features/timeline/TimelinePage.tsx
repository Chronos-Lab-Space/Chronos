import { useMemo } from "react";
import { Link } from "react-router-dom";
import { deriveDecisionHistory } from "../../../domain/workspace/decisionHistory";
import { useWorkspace } from "../workspace/WorkspaceContext";

function formatDay(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
}

/**
 * Timeline — how this decision got here, newest first.
 *
 * Read-only by design: choosing a path lives on the simulation surface, where
 * the futures being chosen between are actually visible. This page answers a
 * different question — what has already happened, and what has not happened yet.
 */
export function TimelinePage() {
  const { home } = useWorkspace();

  const history = useMemo(() => (home ? deriveDecisionHistory(home) : []), [home]);

  if (!home?.goal) return null;

  // deriveDecisionHistory tells the story oldest → newest; the timeline reads
  // newest first, so the most recent state is the one you land on.
  const entries = [...history].reverse();
  const latest = home.recentSimulations[0] ?? null;
  const outcomeLogged = Boolean(latest?.result.outcome_result?.toString().trim());
  const pathChosen = Boolean(latest?.result.chosen_future_id?.toString().trim());

  return (
    <div className="max-w-[860px]">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-faint/75">
        Timeline
      </div>
      <h1 className="mt-[18px] font-serif text-[30px] leading-[1.15] text-ink sm:text-[38px]">
        How this decision got here
      </h1>
      <p className="mt-3.5 max-w-[58ch] font-serif text-[18px] leading-[1.55] text-ink-dim">
        A decision doesn't end at "run simulation". Everything below is replayable.
      </p>

      <div className="mt-11 flex flex-col" data-testid="decision-history-full">
        {entries.length === 0 ? (
          <p className="text-[13.5px] text-ink-dim">No events yet.</p>
        ) : (
          entries.map((event, i) => {
            const day = formatDay(event.at);
            const current = i === 0;
            const body = (
              <>
                <div
                  className={`mb-[7px] font-mono text-[9.5px] uppercase tracking-[0.16em] ${
                    current ? "text-chronos" : "text-ink-faint"
                  }`}
                >
                  {event.kind.replace(/_/g, " ")}
                  {current ? " · current" : ""}
                </div>
                <div className="font-serif text-[22px] leading-snug text-ink">{event.label}</div>
              </>
            );
            return (
              <div
                key={event.id}
                className="grid grid-cols-[64px_1fr] gap-7 sm:grid-cols-[96px_1fr]"
              >
                <div className="pt-1 text-right font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint/75">
                  {day ?? ""}
                </div>
                <div
                  className={`border-l pb-[30px] pl-7 ${current ? "border-line-strong" : "border-line"}`}
                >
                  {event.href ? (
                    <Link to={event.href} className="block transition hover:text-chronos">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* What has not happened yet — the design's dashed "ahead" card. Only
          meaningful once a path is committed and the outcome is still open. */}
      {pathChosen && !outcomeLogged && latest ? (
        <div className="mt-[26px] flex flex-wrap items-center gap-[30px] rounded-2xl border border-dashed border-line-strong px-[30px] py-[26px]">
          <div className="min-w-0 flex-1">
            <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint/75">
              Ahead · observed, then learned
            </div>
            <div className="mb-1.5 font-serif text-[21px] text-ink">Log the real outcome</div>
            <div className="max-w-[52ch] leading-[1.6] text-ink-faint">
              Chronos compares what happened to what it predicted, then re-weights the priors that
              got it wrong.
            </div>
          </div>
          <Link
            to={`/workspace/simulations/${latest.id}`}
            className="shrink-0 rounded-full border border-chronos/45 px-[18px] py-[11px] text-[13px] text-ink transition hover:border-chronos hover:text-chronos"
          >
            Log outcome →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
