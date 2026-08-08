import { useState } from "react";
import { Link } from "react-router-dom";
import { confidencePercent, formatCreatedAt } from "../../../domain/workspace/seed";
import { deriveTargets } from "../../../domain/workspace/targets";
import type { OutcomeVerdict, WorkspaceHome } from "../../../domain/workspace/types";
import { buildActivityFeed, derivePriors } from "../../../domain/workspace/workspaceMemory";

/** Reads next to the predicted confidence, so it names the comparison. */
const VERDICT_LABEL: Record<OutcomeVerdict, string> = {
  better: "better than predicted",
  as_expected: "as predicted",
  worse: "worse than predicted",
};

const SECTION_LABEL = "font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint/75";

/**
 * Right context rail — Details (objective, constraints, targets, priors,
 * activity, outcome) and Notes (real workspace notes) as tabs, per the
 * imported workspace design.
 *
 * `Related simulations` has no counterpart in that design but is kept: the
 * rail exists so a decision can be worked without navigating away for context,
 * and jumping between runs is part of that.
 */
export function WorkspaceContextRail({
  home,
  /**
   * Simulation currently in view, when the route has one. Without it the rail
   * describes the newest run — correct on dashboard routes, but on a detail
   * page for an older run it would show a different simulation's constraints
   * and link Log outcome at the wrong record.
   */
  activeSimulationId,
}: {
  home: WorkspaceHome;
  activeSimulationId?: string;
}) {
  const [tab, setTab] = useState<"details" | "notes">("details");
  const goal = home.goal;
  const active =
    (activeSimulationId ? home.recentSimulations.find((s) => s.id === activeSimulationId) : null) ??
    home.recentSimulations[0];
  const related = home.recentSimulations
    .filter((s) => s.status === "completed" && s.id !== active?.id)
    .slice(0, 4);
  const constraints =
    active && Array.isArray(active.result.constraints)
      ? (active.result.constraints as string[]).slice(0, 6)
      : [];
  const targets = deriveTargets(goal);
  const priors = derivePriors(home).slice(0, 3);
  const activity = buildActivityFeed(home, 4);

  const tabClass = (isActive: boolean) =>
    `cursor-pointer pb-[3px] font-mono text-[9.5px] uppercase tracking-[0.14em] transition ${
      isActive
        ? "border-b border-chronos text-ink"
        : "border-b border-transparent text-ink-faint/75"
    }`;

  return (
    <aside
      className="workspace-context-rail hidden w-[316px] shrink-0 border-l border-line px-6 py-[26px] xl:block xl:overflow-y-auto"
      aria-label="Context"
    >
      <div className="mb-[22px] flex items-center justify-between">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-faint/75">
          Context
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setTab("details")}
            className={tabClass(tab === "details")}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setTab("notes")}
            className={tabClass(tab === "notes")}
          >
            Notes
          </button>
        </div>
      </div>

      {tab === "notes" ? (
        <div className="flex flex-col gap-[22px]">
          {home.notes.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">
              No notes yet — capture the conversation around this decision.
            </p>
          ) : (
            home.notes.slice(0, 8).map((note) => (
              <div key={note.id} className="border-l-2 border-line-strong pl-3.5">
                <p className="font-serif text-[16px] leading-[1.55] text-ink-dim">
                  {note.content.length > 160 ? `${note.content.slice(0, 160)}…` : note.content}
                </p>
                <div className="mt-[9px] font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint/75">
                  {note.title} · {formatCreatedAt(note.created_at)}
                </div>
              </div>
            ))
          )}
          <Link
            to="/workspace/notes"
            className="rounded-xl border border-dashed border-line-strong p-3.5 text-[12.5px] text-ink-faint/75 transition hover:border-chronos/45 hover:text-ink"
          >
            Write a note…
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-[30px]">
          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <div className={SECTION_LABEL}>Objective</div>
              <Link to="/workspace" className="font-mono text-[9.5px] uppercase text-chronos">
                Update
              </Link>
            </div>
            <p className="font-serif text-[16px] leading-[1.5] text-ink-dim">
              {goal?.description?.trim() || goal?.title || "No objective set."}
            </p>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className={SECTION_LABEL}>
                Constraints{constraints.length > 0 ? ` · ${constraints.length}` : ""}
              </div>
              <Link
                to="/workspace/simulations?new=1"
                className="font-mono text-[9.5px] uppercase text-chronos"
              >
                Edit
              </Link>
            </div>
            {constraints.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">None on this run.</p>
            ) : (
              <ul className="flex flex-col gap-[9px] text-[12.5px]">
                {constraints.map((c) => (
                  <li key={c} className="flex gap-2.5">
                    <span className="text-chronos">✓</span>
                    <span className="text-ink-dim">{c.replace(/^(hard|soft):\s*/i, "")}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {goal && (
            <section data-testid="rail-targets">
              <div className={`mb-3 ${SECTION_LABEL}`}>Targets</div>
              {targets.length === 0 ? (
                <p className="text-[12.5px] text-ink-faint">
                  No measurable target in the objective — add a number to hold the run to something.
                </p>
              ) : (
                <dl className="flex flex-col gap-[9px] text-[12.5px]">
                  {targets.map((target) => (
                    <div
                      key={`${target.value} ${target.label}`}
                      className="flex justify-between gap-3"
                    >
                      <dt className="capitalize text-ink-faint">{target.label}</dt>
                      <dd className="tabular-nums text-ink">{target.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          )}

          <section data-testid="rail-memory">
            <div className="mb-3 flex items-center justify-between">
              <div className={SECTION_LABEL}>Memory in play</div>
              <Link
                to="/workspace/memory"
                className="font-mono text-[9.5px] uppercase text-chronos"
              >
                All
              </Link>
            </div>
            {priors.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">
                No outcome logged yet — nothing here has been proved right or wrong.
              </p>
            ) : (
              <ul className="flex flex-col gap-3 text-[12.5px]">
                {priors.map((prior) => (
                  <li key={prior.simulationId}>
                    <Link to={prior.href} className="text-ink-dim transition hover:text-chronos">
                      {prior.pathName}
                    </Link>
                    <span className="text-ink-faint">
                      {prior.confidence != null ? (
                        <>
                          {" — "}
                          <span className="tabular-nums">
                            {confidencePercent(prior.confidence)}
                          </span>
                        </>
                      ) : null}
                      {prior.verdict ? (
                        <span className={prior.verdict === "worse" ? "text-amber-300/80" : ""}>
                          {prior.confidence != null ? ", " : " — "}
                          {VERDICT_LABEL[prior.verdict]}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section data-testid="rail-activity">
            <div className={`mb-3 ${SECTION_LABEL}`}>Recent activity</div>
            {activity.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">Nothing has happened here yet.</p>
            ) : (
              <ul className="flex flex-col gap-[13px] text-[12.5px]">
                {activity.map((item) => (
                  <li key={item.id}>
                    <div className="text-ink-dim">{item.title}</div>
                    <div className="mt-[3px] font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint/75">
                      {formatCreatedAt(item.at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section data-testid="rail-related">
            <div className="mb-3 flex items-center justify-between">
              <div className={SECTION_LABEL}>Related simulations</div>
              <Link
                to="/workspace/simulations"
                className="font-mono text-[9.5px] uppercase text-chronos"
              >
                View all →
              </Link>
            </div>
            {related.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">No completed runs yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {related.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/workspace/simulations/${s.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-2 text-[12.5px] transition hover:border-chronos/45"
                    >
                      <span className="min-w-0 truncate text-ink">{s.title}</span>
                      <span className="shrink-0 font-mono text-[10px] text-chronos">
                        {s.confidence != null ? confidencePercent(s.confidence) : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-t border-line-soft pt-[22px]">
            <div className="mb-2.5 flex items-center justify-between">
              <div className={SECTION_LABEL}>Outcome</div>
              <span className="rounded-[3px] border border-line-strong px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
                {active?.result.outcome_followed ? "In progress" : "Not started"}
              </span>
            </div>
            <p className="mb-3.5 text-[12.5px] leading-[1.6] text-ink-faint">
              Log what actually happens after launch. Chronos re-weights the models that got it
              wrong.
            </p>
            {active ? (
              <Link
                to={`/workspace/simulations/${active.id}`}
                className="block rounded-full border border-line-strong py-[9px] text-center text-[12.5px] text-ink-dim transition hover:border-chronos/45 hover:text-ink"
              >
                Log outcome
              </Link>
            ) : null}
          </section>
        </div>
      )}
    </aside>
  );
}
