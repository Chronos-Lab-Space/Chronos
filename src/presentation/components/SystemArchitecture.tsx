import { WorkspaceIntelligence } from "../features/workspace/WorkspaceIntelligence";

const layers = [
  {
    id: "01",
    name: "Web UI",
    role: "The human control plane.",
    detail: "Build, inspect, replay, and compare simulations from the Chronos dashboard.",
    color: "#60899B",
  },
  {
    id: "02",
    name: "API Gateway",
    role: "The public contract.",
    detail:
      "Authenticates requests, applies policy and rate limits, then routes every agent request into the runtime.",
    color: "#CDCAB2",
  },
  {
    id: "03",
    name: "Simulation Service",
    role: "The world executor.",
    detail: "Materializes candidate futures from a supplied state, model, and decision horizon.",
    color: "#60899B",
  },
  {
    id: "04",
    name: "Planner",
    role: "The search coordinator.",
    detail:
      "Expands promising actions, allocates compute budgets, and prunes futures that cannot win.",
    color: "#E2DDDA",
  },
  {
    id: "05",
    name: "Agent Runtime",
    role: "The reasoning workspace.",
    detail:
      "Runs the agent's tools, policies, and Chronos programs inside deterministic branch contexts.",
    color: "#CDCAB2",
  },
  {
    id: "06",
    name: "Temporal Engine",
    role: "The branching kernel.",
    detail:
      "Forks state, evaluates outcomes, collapses winners, and anchors every decision to a replayable timeline.",
    color: "#60899B",
  },
  {
    id: "07",
    name: "Storage",
    role: "The durable memory.",
    detail:
      "Persists canonical state, archived branches, causal traces, and audit-ready decision records.",
    color: "#E2DDDA",
  },
];

const aiServices = [
  {
    id: "01",
    name: "Planner Agent",
    input: "Goal + constraints",
    output: "Decision plan",
    detail:
      "Owns the objective. Decides what must be explored, how deeply, and what success means for this run.",
    color: "#60899B",
  },
  {
    id: "02",
    name: "Scenario Generator",
    input: "Decision plan",
    output: "Candidate scenarios",
    detail:
      "Turns intent into concrete what-if worlds: assumptions, interventions, constraints, and horizons.",
    color: "#CDCAB2",
  },
  {
    id: "03",
    name: "Branch Generator",
    input: "Candidate scenarios",
    output: "State branches",
    detail:
      "Expands every scenario into isolated candidate paths and allocates a compute budget to each one.",
    color: "#60899B",
  },
  {
    id: "04",
    name: "Simulation Runtime",
    input: "State branches",
    output: "Future traces",
    detail:
      "Executes tools, world models, and deterministic agent logic inside every branch context.",
    color: "#E2DDDA",
  },
  {
    id: "05",
    name: "Outcome Evaluator",
    input: "Future traces",
    output: "Outcome scores",
    detail:
      "Measures reward, risk, confidence, and policy compliance against the planner's original objective.",
    color: "#CDCAB2",
  },
  {
    id: "06",
    name: "Ranking Engine",
    input: "Outcome scores",
    output: "Selected path",
    detail:
      "Ranks viable futures, applies collapse strategy, and returns the best path with an explainable decision record.",
    color: "#E2DDDA",
  },
  {
    id: "07",
    name: "Memory",
    input: "Selected path + traces",
    output: "Learned context",
    detail:
      "Stores durable outcomes, branch archives, and lessons that make the next planning cycle more informed.",
    color: "#60899B",
  },
];

export function SystemArchitecture() {
  return (
    <section className="relative border-t border-line pt-20 lg:pt-28">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
              / target system architecture
            </span>
            <div className="h-px w-10 bg-line" />
          </div>
          <h3 className="font-serif text-4xl leading-[1] tracking-tight md:text-5xl">
            One decision,
            <br />
            <span className="italic text-ink-dim">seven layers deep.</span>
          </h3>
        </div>
        <p className="max-w-sm text-[14px] leading-[1.7] text-ink-dim">
          This is the architecture Chronos is evolving toward: a clear separation between how agents
          ask, how futures are searched, and how decisions become durable state.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Vertical system path */}
        <div className="lg:col-span-5">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-bg-soft p-5 sm:p-7">
            <div className="pointer-events-none absolute inset-0 line-grid opacity-20" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.23em] text-ink-faint">
                <span>Decision path</span>
                <span>Target topology</span>
              </div>

              <div className="space-y-0">
                {layers.map((layer, index) => (
                  <div key={layer.id}>
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-bg font-mono text-[10px]"
                        style={{ borderColor: `${layer.color}55`, color: layer.color }}
                      >
                        {layer.id}
                      </div>
                      <div
                        className="flex min-h-12 flex-1 items-center justify-between rounded-lg border bg-bg/60 px-4 py-3"
                        style={{ borderColor: `${layer.color}2f` }}
                      >
                        <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink">
                          {layer.name}
                        </span>
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: layer.color }}
                        />
                      </div>
                    </div>

                    {index < layers.length - 1 && (
                      <div className="ml-5 flex h-6 items-center">
                        <div className="h-full border-l border-dashed border-line-strong" />
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          className="-ml-[5px] translate-y-2 text-ink-faint"
                        >
                          <path
                            d="M5 1v7M2 5l3 3 3-3"
                            stroke="currentColor"
                            strokeWidth="1"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Layer responsibilities */}
        <div className="lg:col-span-7">
          <div className="border-t border-line">
            {layers.map((layer) => (
              <div
                key={layer.id}
                className="grid grid-cols-[auto_1fr] gap-x-5 border-b border-line py-5 sm:grid-cols-[44px_1fr_1.5fr] sm:gap-x-6"
              >
                <div
                  className="font-mono text-[10px] tracking-[0.2em]"
                  style={{ color: layer.color }}
                >
                  {layer.id}
                </div>
                <div className="font-serif text-xl text-ink sm:text-2xl">{layer.name}</div>
                <div className="col-span-2 mt-2 text-[13px] leading-[1.65] text-ink-dim sm:col-span-1 sm:mt-0">
                  <span className="font-medium text-ink">{layer.role}</span> {layer.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AgentServiceArchitecture />
      <TemporalBranchLifecycle />
    </section>
  );
}

function TemporalBranchLifecycle() {
  const stages = [
    ["01", "Timeline", "Canonical state", "#60899B"],
    ["02", "Branch", "Alternative future", "#CDCAB2"],
    ["03", "Subbranch", "Deeper exploration", "#60899B"],
    ["04", "Merge", "Converged evidence", "#E2DDDA"],
    ["05", "Collapse", "Canonical decision", "#E2DDDA"],
  ] as const;

  return (
    <section className="relative mt-20 border-t border-line pt-20 lg:mt-28 lg:pt-28">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
              / temporal versioning
            </span>
            <div className="h-px w-10 bg-line" />
          </div>
          <h3 className="font-serif text-4xl leading-[1] tracking-tight md:text-5xl">
            Decisions are
            <br />
            <span className="italic text-ink-dim">versioned futures.</span>
          </h3>
        </div>
        <p className="max-w-sm text-[14px] leading-[1.7] text-ink-dim">
          Every decision begins as a timeline, branches into alternatives, can explore subbranches
          or merge compatible evidence, then collapses to one ranked canonical path.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-bg-soft p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          <span>Temporal lifecycle</span>
          <span>Replayable by design</span>
        </div>
        <div className="flex min-w-max items-center gap-2 overflow-x-auto pb-2 lg:min-w-0 lg:justify-between">
          {stages.map(([id, name, detail, color], index) => (
            <div key={id} className="flex items-center gap-2">
              <div
                className="w-[145px] rounded-xl border bg-bg/70 p-4"
                style={{ borderColor: `${color}40` }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color }}>
                    {id}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                </div>
                <div className="mt-3 font-serif text-xl text-ink">{name}</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-faint">
                  {detail}
                </div>
              </div>
              {index < stages.length - 1 && (
                <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0 text-ink-faint">
                  <path
                    d="M2 8h11M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-line pt-5 sm:grid-cols-3">
          <LifecycleNote
            title="Branch freely"
            body="Root branches and subbranches preserve parent lineage, depth, state, and hypothesis."
          />
          <LifecycleNote
            title="Merge deliberately"
            body="Compatible branches converge through explicit merge records without committing the timeline."
          />
          <LifecycleNote
            title="Collapse once"
            body="Timeline ranking selects one path while discarded alternatives remain replayable evidence."
          />
        </div>
      </div>
    </section>
  );
}

function LifecycleNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg/50 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-chronos">{title}</div>
      <p className="mt-2 text-[12px] leading-[1.65] text-ink-dim">{body}</p>
    </div>
  );
}

/**
 * The agentic pipeline is intentionally separate from the delivery stack above.
 * In production each stage can scale, deploy, and fail independently.
 */
function AgentServiceArchitecture() {
  return (
    <section className="relative mt-20 border-t border-line pt-20 lg:mt-28 lg:pt-28">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
              / target AI service architecture
            </span>
            <div className="h-px w-10 bg-line" />
          </div>
          <h3 className="font-serif text-4xl leading-[1] tracking-tight md:text-5xl">
            The reasoning loop,
            <br />
            <span className="italic text-ink-dim">decomposed into services.</span>
          </h3>
        </div>
        <p className="max-w-sm text-[14px] leading-[1.7] text-ink-dim">
          Each stage is independently deployable and observable. That means a planner can evolve
          without rewriting simulation, and memory can grow without slowing the decision path.
        </p>
      </div>

      {/* Horizontal service topology */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-bg-soft p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 line-grid opacity-20" />
        <div className="relative">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.23em] text-ink-faint">
            <span>AI decision pipeline</span>
            <span>Independent services · event-driven contracts</span>
          </div>

          <div className="flex min-w-max items-center gap-2 overflow-x-auto pb-2 lg:min-w-0 lg:justify-between lg:gap-1">
            {aiServices.map((service, index) => (
              <div key={service.id} className="flex items-center gap-2">
                <div
                  className="w-[142px] shrink-0 rounded-lg border bg-bg/70 p-3 sm:w-[156px]"
                  style={{ borderColor: `${service.color}42` }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-mono text-[9px] tracking-[0.2em]"
                      style={{ color: service.color }}
                    >
                      {service.id}
                    </span>
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: service.color }}
                    />
                  </div>
                  <div className="mt-3 font-serif text-[17px] leading-[1.05] text-ink">
                    {service.name}
                  </div>
                </div>
                {index < aiServices.length - 1 && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    className="shrink-0 text-ink-faint"
                  >
                    <path
                      d="M2 8h11M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inputs, outputs, responsibilities */}
      <div className="mt-6 divide-y divide-line border-y border-line">
        {aiServices.map((service) => (
          <div
            key={service.id}
            className="grid grid-cols-[38px_1fr] gap-x-4 py-5 sm:grid-cols-[42px_1fr_120px_120px] sm:gap-x-6"
          >
            <div
              className="font-mono text-[10px] tracking-[0.2em]"
              style={{ color: service.color }}
            >
              {service.id}
            </div>
            <div>
              <div className="font-serif text-xl text-ink sm:text-2xl">{service.name}</div>
              <p className="mt-1 max-w-xl text-[13px] leading-[1.65] text-ink-dim">
                {service.detail}
              </p>
            </div>
            <div className="col-start-2 mt-3 sm:col-start-auto sm:mt-1">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">
                Consumes
              </div>
              <div className="mt-1 font-mono text-[11px] text-ink-dim">{service.input}</div>
            </div>
            <div className="col-start-2 mt-3 sm:col-start-auto sm:mt-1">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">
                Produces
              </div>
              <div className="mt-1 font-mono text-[11px]" style={{ color: service.color }}>
                {service.output}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ArchitecturePrinciple
          title="Scale independently"
          body="Branch generation and simulation can absorb bursts without making planning or memory wait."
        />
        <ArchitecturePrinciple
          title="Retry safely"
          body="Every handoff is an explicit event with a stable run and branch identifier, making retries idempotent."
        />
        <ArchitecturePrinciple
          title="Observe every decision"
          body="Trace each request from goal to selected path, including pruned branches and evaluator evidence."
        />
      </div>

      <WorkspaceIntelligence />
    </section>
  );
}

function ArchitecturePrinciple({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft/60 p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">{title}</div>
      <p className="mt-2 text-[12px] leading-[1.65] text-ink-dim">{body}</p>
    </div>
  );
}
