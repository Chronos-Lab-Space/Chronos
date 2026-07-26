import { useMemo, useState } from "react";
import { createEngine, run } from "../../../application/chronos/engine";
import { SimulationLearningService } from "../../../application/workspace/SimulationLearningService";
import { capabilityWorkloads, getCapabilityWorkload } from "../../../domain/chronos/capabilities";

/** Operational workspace view: shows how one completed run informs the next one. */
export function WorkspaceLearningDashboard() {
  const [workloadId, setWorkloadId] = useState(capabilityWorkloads[0].id);
  const workload = useMemo(() => getCapabilityWorkload(workloadId), [workloadId]);
  const learning = useMemo(() => {
    const simulation = run(
      createEngine(workload.scenario.id, workload.scenario.initialState, workload.scenario.actions),
      "max-utility"
    );
    return new SimulationLearningService().derive(simulation, {
      workspaceId: "workspace-demo",
      now: "2026-01-01T00:00:00.000Z",
    });
  }, [workload]);

  return (
    <section className="mx-auto max-w-7xl px-0 py-4">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-chronos">
            Workspace intelligence
          </div>
          <h2 className="mt-2 font-serif text-3xl text-ink">
            Every simulation improves the next one.
          </h2>
        </div>
        <select
          value={workloadId}
          onChange={(event) => setWorkloadId(event.target.value)}
          className="rounded-md border border-line bg-bg px-3 py-2 font-mono text-[11px] text-ink focus:border-chronos/50 focus:outline-none"
        >
          {capabilityWorkloads.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-line bg-bg-soft p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
              Workspace
            </div>
            <div className="mt-2 font-serif text-2xl text-ink">Demo Workspace</div>
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <MiniMetric
                label="Past simulations"
                value={String(learning.pastSimulations.length)}
                color="#60899B"
              />
              <MiniMetric
                label="Knowledge nodes"
                value={String(learning.knowledgeGraph.nodes.length)}
                color="#CDCAB2"
              />
              <MiniMetric
                label="Success signals"
                value={String(learning.successfulFutures.length)}
                color="#E2DDDA"
              />
              <MiniMetric
                label="Failure patterns"
                value={String(learning.failurePatterns.length)}
                color="#989898"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="overflow-hidden rounded-xl border border-line bg-bg-soft">
            <div className="grid grid-cols-5 border-b border-line bg-bg/50 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
              <span>Workspace</span>
              <span>Graph</span>
              <span>Past runs</span>
              <span>Success</span>
              <span>Patterns</span>
            </div>
            <div className="grid grid-cols-5 gap-1 px-4 py-6">
              {[
                ["Workspace", "#60899B"],
                ["Knowledge\nGraph", "#CDCAB2"],
                ["Past\nSimulations", "#60899B"],
                ["Successful\nFutures", "#E2DDDA"],
                ["Failure\nPatterns", "#989898"],
              ].map(([label, color], index) => (
                <div
                  key={String(label)}
                  className="relative flex min-h-24 items-center justify-center rounded-lg border bg-bg/60 px-2 text-center"
                  style={{ borderColor: `${color}45` }}
                >
                  <span
                    className="whitespace-pre-line font-mono text-[10px] uppercase leading-[1.5] tracking-[0.15em]"
                    style={{ color }}
                  >
                    {label}
                  </span>
                  {index < 4 && (
                    <span className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 text-ink-faint">
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-line px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-chronos">
              Feedback: successful future → preferred hypothesis · failure pattern → next constraint
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-bg-soft p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-warm">
            Successful futures
          </div>
          {learning.successfulFutures.map((future) => (
            <div
              key={future.branchId}
              className="mt-4 rounded-lg border border-accent-warm/25 bg-bg p-4"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[12px] text-ink">{future.hypothesis}</span>
                <span className="font-mono text-[12px] text-accent-warm">
                  {future.score.toFixed(3)}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-[1.6] text-ink-dim">{future.evidence}</p>
            </div>
          ))}
        </section>
        <section className="rounded-xl border border-line bg-bg-soft p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Failure patterns
          </div>
          <div className="mt-4 space-y-2">
            {learning.failurePatterns.map((pattern) => (
              <div key={pattern.id} className="rounded-lg border border-line bg-bg p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] text-ink">{pattern.pattern}</span>
                  <span className="font-mono text-[10px] text-ink-faint">
                    ×{pattern.occurrences}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-ink-dim">{pattern.recommendedConstraint}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        {label}
      </span>
      <span className="font-mono text-[13px]" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
