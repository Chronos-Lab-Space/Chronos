import { useEffect } from "react";
import { Link } from "react-router-dom";
import { deriveDecisionBrief } from "../../../domain/workspace/decisionBrief";
import { deriveOutcomeReview } from "../../../domain/workspace/outcomeReview";
import { toParagraphs } from "../../../domain/workspace/prose";
import { notifyIfDueCountChanged } from "../../../infrastructure/notifications/outcomeReviewNotifier";
import { OutcomeReviewBanner } from "./components/OutcomeReviewBanner";
import { useWorkspace } from "./WorkspaceContext";

/**
 * Decision Brief — the decision-centric workspace surface.
 * One continuous editorial column: Decision → Recommendation → Confidence →
 * Evidence → Ranked futures. The six-state lifecycle band above it is owned
 * by the shell (WorkspaceStageBand) so it persists on every workspace page.
 * Everything here is derived from real workspace data (deriveDecisionBrief);
 * missing stages render as honest empty states.
 */

function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-faint/75">
      {children}
    </div>
  );
}

const PRIMARY_ACTION =
  "inline-flex items-center gap-2.5 rounded-full bg-chronos px-[18px] py-[11px] text-[13px] font-medium text-bg transition hover:bg-[#7AA6B6]";
const SECONDARY_ACTION =
  "inline-flex items-center gap-2.5 rounded-full border border-line-strong px-[18px] py-[11px] text-[13px] text-ink-dim transition hover:border-chronos/45 hover:text-ink";

export function DecisionBriefPage() {
  const { home } = useWorkspace();
  const brief = deriveDecisionBrief(home);
  // `now` is read here and injected, never inside the derivation — a
  // time-dependent function that reads the clock itself cannot be pinned by a
  // test.
  const review = deriveOutcomeReview(home, new Date());

  // No-op unless the visitor opted in from Settings and the browser already
  // granted permission -- see outcomeReviewNotifier.ts. This is the one place
  // the brief's own due queue is read, so it is also the one place that can
  // notice it changed.
  useEffect(() => {
    notifyIfDueCountChanged(review.due.length);
  }, [review.due.length]);

  if (!brief?.goalTitle) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <Eyebrow>DECISION BRIEF</Eyebrow>
        <h1 className="mt-4 font-serif text-4xl text-ink">No decision yet</h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-dim">
          Set the decision you're trying to make and the brief assembles itself — lifecycle,
          recommendation, evidence, and ranked futures.
        </p>
        <Link to="/workspace/hq" className={`mt-8 ${PRIMARY_ACTION}`}>
          Set your decision →
        </Link>
      </div>
    );
  }

  const report = brief.reportSimulation;
  const simHref = report ? `/workspace/simulations/${report.id}` : "/workspace/simulations?new=1";
  const recommendedFuture = brief.futures.find((f) => f.recommended) ?? null;

  return (
    <div className="max-w-[1000px]" data-testid="decision-brief">
      <OutcomeReviewBanner items={review.due} />
      <Eyebrow>DECISION</Eyebrow>
      <h1 className="mt-[18px] font-serif text-[34px] leading-[1.1] tracking-[-0.01em] text-ink sm:text-[46px]">
        {brief.goalTitle}
      </h1>
      {brief.goalDescription ? (
        <p className="mt-[18px] max-w-[62ch] text-pretty font-serif text-[19px] leading-[1.55] text-ink-dim">
          {brief.goalDescription}
        </p>
      ) : null}
      <div className="mt-[22px] flex flex-wrap gap-x-7 gap-y-1 border-b border-line-soft pb-10 text-[12px] text-ink-faint">
        <span>
          Opened <span className="text-ink-dim">{formatDay(brief.goalSetAt) ?? "—"}</span>
        </span>
        <span>
          Workspace <span className="text-ink-dim">{brief.workspaceName}</span>
        </span>
        <span>
          State{" "}
          <span className="text-chronos">
            {brief.stages.find((s) => s.state === "current")?.label}
          </span>
        </span>
      </div>

      <section className="border-b border-line-soft py-[46px]">
        <Eyebrow>RECOMMENDATION</Eyebrow>
        {brief.recommendation ? (
          <>
            <div className="mb-3.5 mt-[26px] font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
              {[
                recommendedFuture ? recommendedFuture.name : null,
                brief.confidencePct != null ? `${brief.confidencePct}% confidence` : null,
                report ? `run v${report.version}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <h2 className="max-w-[30ch] font-serif text-[26px] leading-[1.24] tracking-[-0.01em] text-ink sm:text-[34px]">
              {brief.recommendation.headline}
            </h2>
            {toParagraphs(brief.recommendation.body).map((paragraph) => (
              <p
                key={paragraph}
                className="mt-5 max-w-[60ch] text-pretty font-serif text-[18px] leading-[1.6] text-ink-dim"
              >
                {paragraph}
              </p>
            ))}
            <div className="mt-[30px] flex flex-wrap gap-3">
              <Link to={simHref} className={PRIMARY_ACTION}>
                Collapse to this future <span aria-hidden>→</span>
              </Link>
              <Link to={simHref} className={SECONDARY_ACTION}>
                Inspect the branch
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-[26px] max-w-[30ch] font-serif text-[26px] leading-[1.24] text-ink sm:text-[34px]">
              No recommendation available.
            </h2>
            <p className="mt-5 max-w-[60ch] font-serif text-[18px] leading-[1.6] text-ink-dim">
              Run your first simulation to generate ranked futures.
            </p>
            <Link to="/workspace/simulations?new=1" className={`mt-[30px] ${PRIMARY_ACTION}`}>
              Run simulation <span aria-hidden>→</span>
            </Link>
          </>
        )}
      </section>

      <section className="border-b border-line-soft py-[46px]">
        <Eyebrow>CONFIDENCE</Eyebrow>
        <div className="mt-[30px] flex flex-wrap items-start gap-x-14 gap-y-8">
          <div>
            <div className="font-serif text-[76px] leading-[0.9] text-chronos">
              {brief.confidencePct != null ? `${brief.confidencePct}%` : "—"}
            </div>
            <div className="mt-2.5 text-[12.5px] text-ink-faint">
              {brief.confidencePct != null
                ? "from the latest completed run"
                : "no completed run yet"}
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-x-11 gap-y-7 pt-1.5 sm:grid-cols-3">
            {brief.stats.map((stat) => (
              <div key={stat.label}>
                <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint/75">
                  {stat.label}
                </div>
                <div className="font-serif text-[28px] text-ink">{stat.value}</div>
                <div className="text-[11.5px] text-ink-faint">{stat.caption}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line-soft py-[46px]">
        <div className="mb-[26px] flex items-baseline justify-between gap-4">
          <Eyebrow>EVIDENCE · {brief.evidence.length} SOURCES</Eyebrow>
          <Link to="/workspace/knowledge" className="text-[13px] text-chronos">
            All knowledge →
          </Link>
        </div>
        {brief.evidence.length ? (
          <div className="flex flex-col">
            {brief.evidence.slice(0, 6).map((row, i) => (
              <Link
                key={row.id}
                data-testid={`evidence-${row.id}`}
                to="/workspace/knowledge"
                className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-5 border-t border-line-soft px-1 py-3.5 transition hover:bg-bg-soft/16 sm:grid-cols-[1fr_150px_90px_70px] ${
                  i === Math.min(brief.evidence.length, 6) - 1 ? "border-b" : ""
                }`}
              >
                <span className="truncate text-[13.5px] text-ink">{row.title}</span>
                <span className="text-[12px] text-ink-faint">{row.kind}</span>
                <span className="text-[12px] text-ink-faint">{formatDay(row.addedAt)}</span>
                {/* Weight by use, not by an invented HIGH/MEDIUM grade. */}
                <span
                  className={`text-right font-mono text-[11px] uppercase tracking-[0.1em] ${
                    row.citedByRuns > 0 ? "text-chronos" : "text-ink-faint"
                  }`}
                >
                  {row.citedByRuns > 0 ? `cited ${row.citedByRuns}×` : "unused"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[13.5px] text-ink-dim">
            Nothing attached yet — the brief gets sharper with every source.
          </p>
        )}
      </section>

      <section className="pt-[46px]">
        <div className="mb-[26px] flex items-baseline justify-between gap-4">
          <Eyebrow>
            RANKED FUTURES{brief.futures.length ? ` · ${brief.futures.length} SIMULATED` : ""}
          </Eyebrow>
          <Link to={simHref} className="text-[13px] text-chronos">
            Open simulation →
          </Link>
        </div>
        {brief.futures.length ? (
          <div className="flex flex-col gap-2.5">
            {brief.futures.map((future) => (
              <Link
                key={future.id}
                data-testid={`future-${future.id}`}
                to={`/workspace/simulations/${future.simulationId}`}
                className={`flex flex-wrap items-baseline gap-x-[22px] gap-y-1 rounded-xl border px-5 py-[18px] transition ${
                  future.recommended || future.chosen
                    ? "border-line-strong bg-bg-soft/16 hover:border-chronos/45"
                    : "border-line hover:border-ink-faint"
                }`}
              >
                <span
                  className={`min-w-[62px] font-serif text-[26px] ${
                    future.recommended || future.chosen ? "text-chronos" : "text-ink-dim"
                  }`}
                >
                  {future.scorePct}%
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mb-[5px] block text-[13.5px] text-ink">{future.name}</span>
                  <span className="block truncate text-[12px] text-ink-faint">
                    {future.summary} · risk {future.riskPct}%
                  </span>
                </span>
                {future.chosen ? (
                  <span className="font-mono text-[10px] tracking-[0.14em] text-chronos">
                    CHOSEN
                  </span>
                ) : future.recommended ? (
                  <span className="font-mono text-[10px] tracking-[0.14em] text-chronos">
                    RECOMMENDED
                  </span>
                ) : future.standing?.kind === "disqualified" ? (
                  <span className="font-mono text-[10px] tracking-[0.14em] text-amber-300/80">
                    BREACHES A CONSTRAINT
                  </span>
                ) : future.standing ? (
                  <span className="font-mono text-[10px] tracking-[0.14em] text-ink-faint">
                    {future.standing.points} PTS BEHIND
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[13.5px] text-ink-dim">
            Futures appear here after the first simulation completes.
          </p>
        )}
      </section>
    </div>
  );
}
