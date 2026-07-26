import { Link } from "react-router-dom";
import { type BriefStage, deriveDecisionBrief } from "../../../domain/workspace/decisionBrief";
import { useWorkspace } from "./WorkspaceContext";

/**
 * Decision Brief — the decision-centric workspace surface.
 * One continuous editorial column: Decision → Recommendation → Confidence →
 * Evidence → Ranked futures, under a persistent six-state lifecycle band.
 * Everything on this page is derived from real workspace data
 * (deriveDecisionBrief); missing stages render as honest empty states.
 */

function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
      {children}
    </div>
  );
}

function StageBand({ stages }: { stages: BriefStage[] }) {
  return (
    <div className="mb-10 flex items-start overflow-x-auto border-b border-line pb-5">
      {stages.map((stage, i) => {
        const date = formatDay(stage.at);
        return (
          <div
            key={stage.id}
            aria-current={stage.state === "current" ? "step" : undefined}
            className={`min-w-[128px] flex-1 border-t-2 pt-3 pr-3 last:pr-0 ${
              stage.state === "current"
                ? "border-chronos"
                : stage.state === "past"
                  ? "border-chronos/45 opacity-70"
                  : "border-line opacity-40"
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-[9px] tracking-[0.16em] text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[13px] text-ink">{stage.label}</span>
            </div>
            <div className="text-[11px] text-ink-faint">
              {stage.sub}
              {date ? ` · ${date}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DecisionBriefPage() {
  const { home } = useWorkspace();
  const brief = deriveDecisionBrief(home);

  if (!brief?.goalTitle) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <Eyebrow>DECISION BRIEF</Eyebrow>
        <h1 className="mt-4 font-serif text-4xl text-ink">No decision yet</h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-dim">
          Set the decision you're trying to make and the brief assembles itself — lifecycle,
          recommendation, evidence, and ranked futures.
        </p>
        <Link
          to="/workspace"
          className="mt-8 inline-flex rounded-full bg-chronos px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos/85"
        >
          Set your decision →
        </Link>
      </div>
    );
  }

  const report = brief.reportSimulation;
  const simHref = report ? `/workspace/simulations/${report.id}` : "/workspace/simulations?new=1";

  return (
    <div className="mx-auto max-w-4xl pb-16" data-testid="decision-brief">
      <StageBand stages={brief.stages} />

      <Eyebrow>DECISION</Eyebrow>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-ink sm:text-5xl">
        {brief.goalTitle}
      </h1>
      {brief.goalDescription ? (
        <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-ink-dim">
          {brief.goalDescription}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-b border-line pb-8 text-[12px] text-ink-faint">
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

      <section className="border-b border-line py-10">
        <Eyebrow>RECOMMENDATION</Eyebrow>
        {brief.recommendation ? (
          <>
            {brief.confidencePct != null && (
              <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
                {brief.confidencePct}% CONFIDENCE
                {report ? ` · RUN V${report.version}` : ""}
              </div>
            )}
            <h2 className="mt-3 max-w-2xl font-serif text-2xl leading-snug text-ink sm:text-3xl">
              {brief.recommendation.headline}
            </h2>
            {brief.recommendation.body ? (
              <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-ink-dim">
                {brief.recommendation.body}
              </p>
            ) : null}
            <Link
              to={simHref}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-chronos px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos/85"
            >
              Review in simulation →
            </Link>
          </>
        ) : (
          <>
            <h2 className="mt-4 max-w-xl font-serif text-2xl leading-snug text-ink sm:text-3xl">
              No recommendation available.
            </h2>
            <p className="mt-3 max-w-xl font-serif text-lg text-ink-dim">
              Run your first simulation to generate ranked futures.
            </p>
            <Link
              to="/workspace/simulations?new=1"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-chronos px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos/85"
            >
              Run simulation →
            </Link>
          </>
        )}
      </section>

      <section className="border-b border-line py-10">
        <Eyebrow>CONFIDENCE</Eyebrow>
        <div className="mt-6 flex flex-wrap items-start gap-x-14 gap-y-8">
          <div>
            <div className="font-serif text-6xl leading-none text-chronos sm:text-7xl">
              {brief.confidencePct != null ? `${brief.confidencePct}%` : "—"}
            </div>
            <div className="mt-2 text-[12px] text-ink-faint">
              {brief.confidencePct != null
                ? "from the latest completed run"
                : "no completed run yet"}
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-x-10 gap-y-6 pt-1 sm:grid-cols-3">
            {brief.stats.map((stat) => (
              <div key={stat.label}>
                <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                  {stat.label}
                </div>
                <div className="font-serif text-2xl text-ink">{stat.value}</div>
                <div className="text-[11px] text-ink-faint">{stat.caption}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line py-10">
        <div className="flex items-baseline justify-between gap-4">
          <Eyebrow>EVIDENCE · {brief.evidence.length} SOURCES</Eyebrow>
          <Link to="/workspace/knowledge" className="text-[13px] text-chronos">
            All knowledge →
          </Link>
        </div>
        {brief.evidence.length ? (
          <div className="mt-4 flex flex-col">
            {brief.evidence.slice(0, 6).map((row, i) => (
              <Link
                key={row.id}
                to="/workspace/knowledge"
                className={`grid grid-cols-[1fr_auto_auto] items-center gap-4 border-t border-line px-1 py-3 transition hover:bg-bg-soft/20 ${
                  i === Math.min(brief.evidence.length, 6) - 1 ? "border-b" : ""
                }`}
              >
                <span className="truncate text-[14px] text-ink">{row.title}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                  {row.kind}
                </span>
                <span className="text-[12px] text-ink-faint">{formatDay(row.addedAt)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[14px] text-ink-dim">
            Nothing attached yet — the brief gets sharper with every source.
          </p>
        )}
      </section>

      <section className="py-10">
        <div className="flex items-baseline justify-between gap-4">
          <Eyebrow>
            RANKED FUTURES{brief.futures.length ? ` · ${brief.futures.length}` : ""}
          </Eyebrow>
          <Link to={simHref} className="text-[13px] text-chronos">
            Open simulation →
          </Link>
        </div>
        {brief.futures.length ? (
          <div className="mt-4 flex flex-col gap-2.5">
            {brief.futures.map((future) => (
              <Link
                key={future.id}
                to={`/workspace/simulations/${future.simulationId}`}
                className={`flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-xl border px-5 py-4 transition ${
                  future.recommended || future.chosen
                    ? "border-line-strong bg-bg-soft/15 hover:border-chronos/45"
                    : "border-line hover:border-ink-faint"
                }`}
              >
                <span
                  className={`min-w-[56px] font-serif text-2xl ${
                    future.recommended || future.chosen ? "text-chronos" : "text-ink-dim"
                  }`}
                >
                  {future.scorePct}%
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-ink">{future.name}</span>
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
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[14px] text-ink-dim">
            Futures appear here after the first simulation completes.
          </p>
        )}
      </section>
    </div>
  );
}
