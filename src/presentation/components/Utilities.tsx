const surfaces = [
  {
    number: "01",
    name: "SDK",
    accent: "text-chronos",
    icon: "sdk",
    headline: (
      <>
        Native in <span className="italic">every</span> language.
      </>
    ),
    body: "First-class SDKs for TypeScript, Python, Rust, and Go. Fully typed, zero-copy serialization, and built-in retry logic.",
  },
  {
    number: "02",
    name: "API",
    accent: "text-accent-2",
    icon: "api",
    headline: (
      <>
        A stable contract
        <br />
        for <span className="italic">every</span> agent.
      </>
    ),
    body: "REST, event streams, and gRPC for forking, evaluating, replaying, and inspecting decisions from any runtime.",
  },
  {
    number: "03",
    name: "CLI",
    accent: "text-chronos",
    icon: "cli",
    headline: (
      <>
        Operate from
        <br />
        <span className="italic">your</span> terminal.
      </>
    ),
    body: "A single binary that runs anywhere. Fork branches, inspect entropy, replay history, and run Chronos in CI.",
  },
  {
    number: "04",
    name: "Visual Studio Extension",
    accent: "text-accent-warm",
    icon: "extension",
    headline: (
      <>
        Write futures
        <br />
        where you <span className="italic">build.</span>
      </>
    ),
    body: "Author Chronos programs with syntax awareness, branch previews, evaluator hints, and inline outcomes in Visual Studio Code.",
  },
  {
    number: "05",
    name: "Agent Runtime",
    accent: "text-accent-2",
    icon: "runtime",
    headline: (
      <>
        Reason across
        <br />
        <span className="italic">every</span> branch.
      </>
    ),
    body: "A deterministic workspace for tools, policies, memory, and Chronos programs to execute in isolated branch contexts.",
  },
  {
    number: "06",
    name: "Simulation Cloud",
    accent: "text-chronos",
    icon: "cloud",
    headline: (
      <>
        Elastic futures,
        <br />
        <span className="italic">on demand.</span>
      </>
    ),
    body: "Simulation capacity, branch archives, replay, observability, and durable decision memory for production agent workloads.",
  },
] as const;

export function Utilities() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {surfaces.map((surface) => (
            <article
              key={surface.name}
              className="card-hover group relative overflow-hidden rounded-2xl border border-line bg-bg-soft p-8 lg:p-9"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div
                    className={`font-mono text-[11px] uppercase tracking-[0.25em] ${surface.accent}`}
                  >
                    {surface.number} · {surface.name}
                  </div>
                  <h3 className="mt-4 font-serif text-3xl leading-[1.05] text-ink">
                    {surface.headline}
                  </h3>
                </div>
                <SurfaceIcon kind={surface.icon} />
              </div>
              <p className="mt-5 text-[13px] leading-[1.7] text-ink-dim">{surface.body}</p>
              <SurfaceDetail kind={surface.icon} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SurfaceDetail({ kind }: { kind: (typeof surfaces)[number]["icon"] }) {
  if (kind === "sdk") {
    return (
      <div className="mt-8 space-y-1.5 border-t border-line pt-5 font-mono text-[11px]">
        {[
          ["@chronos/sdk", "TS"],
          ["@chronos/sdk-py", "PY"],
          ["@chronos/sdk-rs", "RS"],
          ["@chronos/sdk-go", "GO"],
        ].map(([pkg, lang]) => (
          <div key={pkg} className="flex items-center justify-between">
            <span className="text-ink">{pkg}</span>
            <span className="text-ink-faint">{lang}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "api") {
    return (
      <div className="mt-8 space-y-1.5 border-t border-line pt-5 font-mono text-[11px]">
        <ApiRow method="POST" path="/v1/fork" color="text-accent-2" />
        <ApiRow method="POST" path="/v1/evaluate" color="text-chronos" />
        <ApiRow method="POST" path="/v1/collapse" color="text-accent-warm" />
        <ApiRow method="GET" path="/v1/replay/:branch" color="text-ink-dim" />
      </div>
    );
  }
  if (kind === "cli") {
    return (
      <pre className="mt-8 overflow-x-auto rounded-lg border border-line bg-bg p-4 font-mono text-[10px] leading-[1.8]">
        <span className="text-ink-faint">$ chronos run ./decision.chronos{"\n"}</span>
        <span className="text-chronos">✓ forked 1,024 branches{"\n"}</span>
        <span className="text-accent-2">✓ evaluated in 1.4ms{"\n"}</span>
        <span className="text-accent-warm">✓ winner: branch_0x4a</span>
      </pre>
    );
  }
  if (kind === "extension") {
    return (
      <div className="mt-8 rounded-lg border border-line bg-bg p-3 font-mono text-[10px] leading-[1.7]">
        <div className="flex items-center justify-between border-b border-line pb-2 text-ink-faint">
          <span>decision.chronos</span>
          <span className="text-accent-warm">VS Code</span>
        </div>
        <div className="pt-2">
          <span className="text-chronos">score</span>{" "}
          <span className="text-ink">utility(state)</span> {"{"}
        </div>
        <div className="pl-3">
          <span className="text-ink">return </span>
          <span className="text-accent-warm">0.942</span>
        </div>
        <div>
          {"}"} <span className="text-emerald-400">✓ best path preview</span>
        </div>
      </div>
    );
  }
  if (kind === "runtime") {
    return (
      <div className="mt-8 grid grid-cols-3 gap-2 border-t border-line pt-5">
        {[
          ["branches", "1,024"],
          ["tools", "12"],
          ["memory", "live"],
        ].map(([label, value]) => (
          <div key={label} className="border-l border-line pl-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
              {label}
            </div>
            <div className="mt-1 font-serif text-xl text-ink">{value}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-8 border-t border-line pt-5">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        <span>Simulation Cloud</span>
        <span className="text-chronos">14 regions</span>
      </div>
      <div className="mt-3 flex items-end gap-1.5">
        {[28, 42, 36, 58, 48, 74, 65, 86, 80, 94, 75, 100].map((height, i) => (
          <span
            key={i}
            className="flex-1 rounded-t-sm bg-gradient-to-t from-accent-2/30 to-chronos/80"
            style={{ height: `${height / 4}px` }}
          />
        ))}
      </div>
    </div>
  );
}

function ApiRow({ method, path, color }: { method: string; path: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-9 ${color}`}>{method}</span>
      <span className="text-ink">{path}</span>
    </div>
  );
}

function SurfaceIcon({ kind }: { kind: (typeof surfaces)[number]["icon"] }) {
  const color =
    kind === "extension" ? "#E2DDDA" : kind === "runtime" || kind === "api" ? "#CDCAB2" : "#60899B";
  return (
    <svg width="38" height="38" viewBox="0 0 40 40" fill="none" className="shrink-0">
      {kind === "sdk" && (
        <>
          <rect
            x="4"
            y="8"
            width="32"
            height="24"
            rx="2"
            stroke={color}
            strokeWidth="1"
            opacity="0.7"
          />
          <path
            d="M12 18l4 4-4 4M20 26h8"
            stroke={color}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === "api" && (
        <>
          <circle cx="20" cy="20" r="5" stroke={color} strokeWidth="1" />
          <circle cx="9" cy="10" r="2.5" stroke={color} strokeWidth="1" opacity="0.7" />
          <circle cx="31" cy="10" r="2.5" stroke={color} strokeWidth="1" opacity="0.7" />
          <circle cx="31" cy="30" r="2.5" stroke={color} strokeWidth="1" opacity="0.7" />
          <path
            d="M11 12l6 6M29 12l-6 6M29 28l-6-6"
            stroke={color}
            strokeWidth="0.8"
            opacity="0.5"
          />
        </>
      )}
      {kind === "cli" && (
        <>
          <rect
            x="4"
            y="6"
            width="32"
            height="28"
            rx="2"
            stroke={color}
            strokeWidth="1"
            opacity="0.7"
          />
          <path
            d="M10 16l4 4-4 4M18 24h11"
            stroke={color}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === "extension" && (
        <>
          <rect
            x="5"
            y="5"
            width="30"
            height="30"
            rx="3"
            stroke={color}
            strokeWidth="1"
            opacity="0.7"
          />
          <path
            d="M14 13l-5 7 5 7M26 13l5 7-5 7M18 28l4-16"
            stroke={color}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === "runtime" && (
        <>
          <circle cx="20" cy="20" r="14" stroke={color} strokeWidth="1" opacity="0.5" />
          <circle cx="20" cy="20" r="7" stroke={color} strokeWidth="1" />
          <circle cx="20" cy="20" r="2" fill={color} />
          <path
            d="M20 6v7M34 20h-7M20 34v-7M6 20h7"
            stroke={color}
            strokeWidth="0.8"
            opacity="0.6"
          />
        </>
      )}
      {kind === "cloud" && (
        <>
          <path
            d="M12 29h17a7 7 0 0 0 0-14 10 10 0 0 0-19-1A7 7 0 0 0 12 29z"
            stroke={color}
            strokeWidth="1.1"
            strokeLinejoin="round"
            opacity="0.75"
          />
          <path d="M14 23h12M17 19h6" stroke={color} strokeWidth="1" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
