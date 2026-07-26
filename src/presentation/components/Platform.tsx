import { lazy, Suspense } from "react";
import { TemporalComputePlatform } from "./TemporalComputePlatform";

const SystemArchitecture = lazy(async () => ({
  default: (await import("./SystemArchitecture")).SystemArchitecture,
}));

export function Platform() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <TemporalComputePlatform />

        {/* Architecture diagram */}
        <div className="glow-border relative mt-20 overflow-hidden rounded-2xl border border-line bg-bg-soft p-10 lg:mt-28 lg:p-16">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left: The primitives */}
            <div className="lg:col-span-5">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
                The six primitives
              </h3>
              <div className="mt-8 space-y-6">
                {[
                  {
                    name: "fork",
                    desc: "Clone state into isolated branches",
                    color: "#c6f0ff",
                  },
                  {
                    name: "evaluate",
                    desc: "Run simulations across all branches",
                    color: "#b79bff",
                  },
                  {
                    name: "collapse",
                    desc: "Merge the best branch back",
                    color: "#ffd7a3",
                  },
                  {
                    name: "commit",
                    desc: "Persist state to canonical timeline",
                    color: "#c6f0ff",
                  },
                  {
                    name: "replay",
                    desc: "Re-execute any archived branch",
                    color: "#b79bff",
                  },
                  {
                    name: "query",
                    desc: "Inspect causal graph and entropy",
                    color: "#ffd7a3",
                  },
                ].map((p, i) => (
                  <div key={p.name} className="flex items-start gap-4">
                    <div className="mt-1 h-2 w-2 rounded-full" style={{ background: p.color }} />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3">
                        <code className="font-mono text-sm" style={{ color: p.color }}>
                          {p.name}
                        </code>
                        <span className="font-mono text-[10px] text-ink-faint">0{i + 1}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-ink-dim">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Visual flow */}
            <div className="lg:col-span-7">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
                Runtime lifecycle
              </h3>
              <div className="mt-8">
                <FlowDiagram />
              </div>
            </div>
          </div>
        </div>

        <Suspense fallback={<ArchitectureFallback />}>
          <SystemArchitecture />
        </Suspense>
      </div>
    </section>
  );
}

function ArchitectureFallback() {
  return (
    <div className="mt-20 flex min-h-[360px] items-center justify-center rounded-2xl border border-line bg-bg-soft lg:mt-28">
      <div className="text-center">
        <div className="mx-auto h-6 w-6 rounded-full border border-chronos border-t-transparent animate-spin" />
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Loading system architecture
        </div>
      </div>
    </div>
  );
}

function FlowDiagram() {
  return (
    <svg viewBox="0 0 600 400" className="h-auto w-full">
      <defs>
        <linearGradient id="flow-cyan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c6f0ff" />
          <stop offset="100%" stopColor="#c6f0ff" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="flow-violet" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b79bff" />
          <stop offset="100%" stopColor="#b79bff" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="flow-warm" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffd7a3" />
          <stop offset="100%" stopColor="#ffd7a3" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* State input */}
      <g>
        <rect
          x="20"
          y="170"
          width="80"
          height="60"
          rx="4"
          stroke="#c6f0ff"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />
        <text
          x="60"
          y="195"
          fill="#c6f0ff"
          fontSize="11"
          fontFamily="JetBrains Mono"
          textAnchor="middle"
        >
          STATE
        </text>
        <text
          x="60"
          y="210"
          fill="#4a5168"
          fontSize="9"
          fontFamily="JetBrains Mono"
          textAnchor="middle"
        >
          snapshot
        </text>
      </g>

      {/* Fork */}
      <g>
        <circle
          cx="180"
          cy="200"
          r="30"
          stroke="#c6f0ff"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />
        <text
          x="180"
          y="205"
          fill="#c6f0ff"
          fontSize="12"
          fontFamily="JetBrains Mono"
          textAnchor="middle"
        >
          fork
        </text>
        <path d="M100 200 L150 200" stroke="url(#flow-cyan)" strokeWidth="1" fill="none" />
        <path d="M145 195 L150 200 L145 205" stroke="#c6f0ff" strokeWidth="1" fill="none" />
      </g>

      {/* Branches */}
      <g>
        {[140, 200, 260].map((y, i) => (
          <g key={i}>
            <path
              d={`M210 200 C 240 200, 250 ${y}, 280 ${y}`}
              stroke="url(#flow-cyan)"
              strokeWidth="0.8"
              fill="none"
              opacity={0.7 - i * 0.15}
            />
            <rect
              x="280"
              y={y - 15}
              width="60"
              height="30"
              rx="3"
              stroke="#c6f0ff"
              strokeWidth="0.6"
              fill="none"
              opacity={0.5 - i * 0.1}
            />
            <text
              x="310"
              y={y + 4}
              fill="#4a5168"
              fontSize="8"
              fontFamily="JetBrains Mono"
              textAnchor="middle"
            >
              branch_{i}
            </text>
          </g>
        ))}
      </g>

      {/* Evaluate */}
      <g>
        <circle
          cx="410"
          cy="200"
          r="30"
          stroke="#b79bff"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />
        <text
          x="410"
          y="205"
          fill="#b79bff"
          fontSize="10"
          fontFamily="JetBrains Mono"
          textAnchor="middle"
        >
          evaluate
        </text>
        {[140, 200, 260].map((y, i) => (
          <path
            key={i}
            d={`M340 ${y} C 370 ${y}, 380 200, 380 200`}
            stroke="url(#flow-violet)"
            strokeWidth="0.8"
            fill="none"
            opacity={0.6 - i * 0.15}
          />
        ))}
      </g>

      {/* Collapse */}
      <g>
        <circle
          cx="510"
          cy="200"
          r="30"
          stroke="#ffd7a3"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />
        <text
          x="510"
          y="205"
          fill="#ffd7a3"
          fontSize="10"
          fontFamily="JetBrains Mono"
          textAnchor="middle"
        >
          collapse
        </text>
        <path d="M440 200 L480 200" stroke="url(#flow-warm)" strokeWidth="1" fill="none" />
        <path d="M475 195 L480 200 L475 205" stroke="#ffd7a3" strokeWidth="1" fill="none" />
      </g>

      {/* Commit output */}
      <g>
        <rect
          x="560"
          y="170"
          width="80"
          height="60"
          rx="4"
          stroke="#ffd7a3"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />
        <text
          x="600"
          y="195"
          fill="#ffd7a3"
          fontSize="10"
          fontFamily="JetBrains Mono"
          textAnchor="middle"
        >
          COMMIT
        </text>
        <text
          x="600"
          y="210"
          fill="#4a5168"
          fontSize="9"
          fontFamily="JetBrains Mono"
          textAnchor="middle"
        >
          best path
        </text>
        <path d="M540 200 L560 200" stroke="url(#flow-warm)" strokeWidth="1" fill="none" />
      </g>

      {/* Archive */}
      <g>
        <rect
          x="280"
          y="320"
          width="260"
          height="50"
          rx="4"
          stroke="#8a93a6"
          strokeWidth="0.6"
          fill="none"
          opacity="0.3"
          strokeDasharray="2 3"
        />
        <text
          x="410"
          y="345"
          fill="#4a5168"
          fontSize="10"
          fontFamily="JetBrains Mono"
          textAnchor="middle"
        >
          ARCHIVE · all branches replayable
        </text>
        {[140, 200, 260].map((y, i) => (
          <path
            key={i}
            d={`M310 ${y + 15} C 310 280, 350 320, 350 320`}
            stroke="#8a93a6"
            strokeWidth="0.4"
            fill="none"
            opacity="0.2"
          />
        ))}
      </g>

      {/* Labels */}
      <text
        x="60"
        y="250"
        fill="#4a5168"
        fontSize="9"
        fontFamily="JetBrains Mono"
        textAnchor="middle"
      >
        t = 0.0ms
      </text>
      <text
        x="180"
        y="250"
        fill="#4a5168"
        fontSize="9"
        fontFamily="JetBrains Mono"
        textAnchor="middle"
      >
        t = 0.3ms
      </text>
      <text
        x="410"
        y="250"
        fill="#4a5168"
        fontSize="9"
        fontFamily="JetBrains Mono"
        textAnchor="middle"
      >
        t = 1.4ms
      </text>
      <text
        x="510"
        y="250"
        fill="#4a5168"
        fontSize="9"
        fontFamily="JetBrains Mono"
        textAnchor="middle"
      >
        t = 2.1ms
      </text>
    </svg>
  );
}
