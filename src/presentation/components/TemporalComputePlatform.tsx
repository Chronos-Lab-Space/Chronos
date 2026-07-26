const platformLayers = [
  {
    number: "01",
    name: "SDK",
    label: "Embed",
    detail:
      "Typed clients for TypeScript, Python, Rust, and Go. Bring temporal reasoning into the agent you already have.",
    color: "#60899B",
  },
  {
    number: "02",
    name: "API",
    label: "Connect",
    detail:
      "A stable REST and event interface for forking, evaluating, replaying, and inspecting decisions from any environment.",
    color: "#CDCAB2",
  },
  {
    number: "03",
    name: "CLI",
    label: "Operate",
    detail:
      "Run simulations, inspect branches, and ship Chronos programs from a terminal or CI pipeline.",
    color: "#60899B",
  },
  {
    number: "04",
    name: "Visual Studio Extension",
    label: "Author",
    detail:
      "Write Chronos programs with syntax awareness, live branch previews, and outcome inspection without leaving your editor.",
    color: "#E2DDDA",
  },
  {
    number: "05",
    name: "Agent Runtime",
    label: "Reason",
    detail:
      "The deterministic workspace where an agent's tools, policies, memory, and decision plan execute across branches.",
    color: "#CDCAB2",
  },
  {
    number: "06",
    name: "Simulation Cloud",
    label: "Scale",
    detail:
      "Elastic simulation capacity, branch archives, replay, observability, and durable memory for every production run.",
    color: "#60899B",
  },
];

export function TemporalComputePlatform() {
  return (
    <section className="relative border-b border-line pb-20 lg:pb-28">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
              / temporal compute platform
            </span>
            <div className="h-px w-10 bg-line" />
          </div>
          <h3 className="font-serif text-4xl leading-[1] tracking-tight md:text-5xl">
            One platform.
            <br />
            <span className="italic text-ink-dim">Every way agents build.</span>
          </h3>
        </div>
        <p className="max-w-sm text-[14px] leading-[1.7] text-ink-dim">
          Chronos is not only a decision engine. It is the developer platform for authoring,
          running, observing, and scaling temporal agents.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        {/* The requested platform sequence, rendered as one connected composition. */}
        <div className="lg:col-span-5">
          <div className="relative border-y border-line">
            {platformLayers.map((layer, index) => (
              <div key={layer.number}>
                <div className="group flex items-center gap-4 py-4 transition sm:gap-5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-bg font-mono text-[10px]"
                    style={{ borderColor: `${layer.color}55`, color: layer.color }}
                  >
                    {layer.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-2xl leading-none text-ink sm:text-3xl">
                      {layer.name}
                    </div>
                  </div>
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.2em]"
                    style={{ color: layer.color }}
                  >
                    {layer.label}
                  </span>
                </div>
                {index < platformLayers.length - 1 && (
                  <div className="ml-4 h-4 border-l border-dashed border-line-strong" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* The same platform explained at the right level of abstraction. */}
        <div className="lg:col-span-7">
          <div className="divide-y divide-line border-y border-line">
            {platformLayers.map((layer) => (
              <div
                key={layer.number}
                className="grid grid-cols-[42px_1fr] gap-x-4 py-4 sm:grid-cols-[42px_120px_1fr] sm:gap-x-6"
              >
                <div
                  className="font-mono text-[10px] tracking-[0.2em]"
                  style={{ color: layer.color }}
                >
                  {layer.number}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink sm:pt-0.5">
                  {layer.label}
                </div>
                <p className="col-span-2 mt-2 text-[13px] leading-[1.65] text-ink-dim sm:col-span-1 sm:mt-0">
                  {layer.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 border-l-2 border-chronos/40 pl-5">
            <p className="text-[14px] leading-[1.7] text-ink-dim">
              The SDK, API, CLI, and extension are how builders enter Chronos. The Agent Runtime and
              Simulation Cloud are where production decisions actually happen. One contract connects
              the entire path.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
