const layers = [
  [
    "01",
    "Workspace",
    "Shared decision context",
    "The tenant boundary for agents, goals, constraints, simulations, and ownership.",
    "#60899B",
  ],
  [
    "02",
    "Knowledge Graph",
    "Causal context",
    "Links assumptions, entities, decisions, and evidence into reusable causal relationships.",
    "#CDCAB2",
  ],
  [
    "03",
    "Past Simulations",
    "Replayable evidence",
    "Stores branch traces, evaluator scores, selections, and the assumptions that produced them.",
    "#60899B",
  ],
  [
    "04",
    "Successful Futures",
    "Reusable strategies",
    "Promotes selected paths whose real outcomes validated the simulation's prediction.",
    "#E2DDDA",
  ],
  [
    "05",
    "Failure Patterns",
    "Guardrails",
    "Detects recurring invalid assumptions, unsafe actions, and costly branches before they repeat.",
    "#989898",
  ],
] as const;

/** Workspace-scoped feedback loop. Isolated so it can become a dashboard feature bundle. */
export function WorkspaceIntelligence() {
  return (
    <section className="relative mt-20 border-t border-line pt-20 lg:mt-28 lg:pt-28">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
              / workspace intelligence
            </span>
            <div className="h-px w-10 bg-line" />
          </div>
          <h3 className="font-serif text-4xl leading-[1] tracking-tight md:text-5xl">
            Every simulation
            <br />
            <span className="italic text-ink-dim">improves the next one.</span>
          </h3>
        </div>
        <p className="max-w-sm text-[14px] leading-[1.7] text-ink-dim">
          Chronos turns each decision into structured evidence that improves planning, ranking, and
          guardrails inside a workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-bg-soft p-5 sm:p-7">
            <div className="pointer-events-none absolute inset-0 line-grid opacity-20" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.23em] text-ink-faint">
                <span>Learning loop</span>
                <span>Workspace scoped</span>
              </div>
              {layers.map(([id, name, , , color], index) => (
                <div key={id}>
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-bg font-mono text-[10px]"
                      style={{ borderColor: `${color}55`, color }}
                    >
                      {id}
                    </div>
                    <div
                      className="flex min-h-12 flex-1 items-center justify-between rounded-lg border bg-bg/60 px-4 py-3"
                      style={{ borderColor: `${color}2f` }}
                    >
                      <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink">
                        {name}
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                    </div>
                  </div>
                  {index < layers.length - 1 && (
                    <div className="ml-5 h-6 border-l border-dashed border-line-strong" />
                  )}
                </div>
              ))}
              <div className="mt-6 flex items-center gap-3 rounded-lg border border-chronos/25 bg-chronos/5 p-3">
                <svg width="18" height="18" viewBox="0 0 18 18" className="text-chronos">
                  <path
                    d="M14.8 7.2A6.5 6.5 0 1 0 15 10M15 3v4.5h-4.5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-chronos">
                  Feedback into next planning cycle
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="divide-y divide-line border-y border-line">
            {layers.map(([id, name, output, detail, color]) => (
              <div
                key={id}
                className="grid grid-cols-[42px_1fr] gap-x-4 py-5 sm:grid-cols-[42px_1fr_150px] sm:gap-x-6"
              >
                <div className="font-mono text-[10px] tracking-[0.2em]" style={{ color }}>
                  {id}
                </div>
                <div>
                  <div className="font-serif text-xl text-ink sm:text-2xl">{name}</div>
                  <p className="mt-1 text-[13px] leading-[1.65] text-ink-dim">{detail}</p>
                </div>
                <div className="col-start-2 mt-3 sm:col-start-auto sm:mt-1">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">
                    Contributes
                  </div>
                  <div className="mt-1 font-mono text-[11px]" style={{ color }}>
                    {output}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-line bg-bg-soft/60 p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
              The flywheel
            </div>
            <p className="mt-2 text-[14px] leading-[1.7] text-ink-dim">
              A successful future becomes a higher-priority hypothesis. A failure pattern becomes a
              constraint. The knowledge graph connects both to the next decision, so planning starts
              with evidence instead of a blank state.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
