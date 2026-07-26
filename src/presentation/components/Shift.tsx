export function Shift() {
  return (
    <section className="relative py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Header */}
        <div className="mb-20 max-w-3xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
              / the shift
            </span>
            <div className="h-px w-10 bg-line" />
          </div>
          <h2 className="font-serif text-5xl leading-[1] tracking-tight md:text-7xl">
            From chatbot
            <br />
            <span className="italic text-ink-dim">to strategist.</span>
          </h2>
          <p className="mt-8 text-[18px] leading-[1.75] text-ink-dim">
            Today's agents react. They take an input, generate an output, and hope it's right. But
            real intelligence doesn't work that way. Real intelligence simulates consequences before
            acting.
          </p>
        </div>

        {/* Robot example */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left: Narrative */}
          <div className="lg:col-span-5">
            <div className="mb-6 flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
                / example · robotic manipulation
              </span>
            </div>

            <p className="text-[15px] leading-[1.75] text-ink-dim">
              Before a robot moves its arm, Chronos lets it simulate:
            </p>

            <div className="mt-8 space-y-4">
              {[
                {
                  q: "What if I move my arm this way?",
                  outcome: "success · 0.94",
                  color: "#ffd7a3",
                },
                {
                  q: "What if the object slips?",
                  outcome: "recover · 0.72",
                  color: "#b79bff",
                },
                {
                  q: "What if a human enters?",
                  outcome: "pause · 0.88",
                  color: "#c6f0ff",
                },
                {
                  q: "What if the environment changes?",
                  outcome: "replan · 0.81",
                  color: "#c6f0ff",
                },
              ].map((sim, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-4 rounded-lg border border-line bg-bg-soft/60 p-4 transition hover:border-line-strong"
                >
                  <div
                    className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: sim.color }}
                  />
                  <div className="flex-1">
                    <div className="text-[14px] leading-[1.5] text-ink">{sim.q}</div>
                    <div
                      className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em]"
                      style={{ color: sim.color }}
                    >
                      {sim.outcome}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 text-[15px] leading-[1.75] text-ink-dim">
              Then it acts — with certainty.
            </p>
          </div>

          {/* Right: Visualization */}
          <div className="lg:col-span-7">
            <RobotSimulation />
          </div>
        </div>

        {/* Human parallel */}
        <div className="mt-24 border-l-2 border-chronos/40 pl-8">
          <p className="text-[20px] leading-[1.6] text-ink md:text-[24px]">
            This is closer to how humans operate. We mentally simulate consequences. We imagine
            futures. We choose the best one.
          </p>
          <p className="mt-6 text-[16px] leading-[1.7] text-ink-dim">
            Chronos gives autonomous systems the same capability — but at the speed of compute, not
            the speed of thought.
          </p>
        </div>

        {/* Bottom thesis */}
        <div className="mt-24 rounded-2xl border border-line bg-bg-soft p-10 lg:p-12">
          <div className="mb-6 flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
              / thesis
            </span>
            <div className="h-px w-10 bg-line" />
          </div>
          <p className="font-serif text-3xl leading-[1.3] text-ink md:text-4xl">
            Chronos is a future simulation engine — the infrastructure that every autonomous system
            eventually needs before taking action.
          </p>
        </div>
      </div>
    </section>
  );
}

function RobotSimulation() {
  return (
    <div className="relative aspect-square w-full max-w-[600px] mx-auto">
      {/* Background grid */}
      <div className="absolute inset-0 line-grid opacity-30" />

      {/* Central agent */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div className="absolute -inset-8 rounded-full bg-chronos/10 blur-2xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-chronos/60 bg-bg">
            <svg width="32" height="32" viewBox="0 0 32 32" className="text-chronos">
              <circle cx="16" cy="12" r="4" fill="currentColor" />
              <rect x="10" y="18" width="12" height="10" rx="2" fill="currentColor" />
              <rect x="6" y="20" width="4" height="6" rx="1" fill="currentColor" opacity="0.6" />
              <rect x="22" y="20" width="4" height="6" rx="1" fill="currentColor" opacity="0.6" />
            </svg>
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.25em] text-chronos">
            AGENT
          </div>
        </div>
      </div>

      {/* Four simulation branches */}
      <svg viewBox="0 0 600 600" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="sim-cyan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c6f0ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#c6f0ff" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="sim-violet" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b79bff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#b79bff" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="sim-warm" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffd7a3" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffd7a3" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Branch 1: top-right (winner) */}
        <path d="M300 300 Q 380 220, 460 140" stroke="url(#sim-warm)" strokeWidth="2" fill="none" />
        <circle cx="460" cy="140" r="6" fill="#ffd7a3" />
        <circle cx="460" cy="140" r="12" fill="#ffd7a3" opacity="0.2" />
        <text x="470" y="135" fill="#ffd7a3" fontSize="11" fontFamily="JetBrains Mono">
          0.94
        </text>
        <text x="470" y="150" fill="#8a93a6" fontSize="9" fontFamily="JetBrains Mono">
          move arm
        </text>

        {/* Branch 2: right */}
        <path
          d="M300 300 Q 400 300, 500 300"
          stroke="url(#sim-violet)"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="500" cy="300" r="5" fill="#b79bff" />
        <text x="510" y="295" fill="#b79bff" fontSize="11" fontFamily="JetBrains Mono">
          0.72
        </text>
        <text x="510" y="310" fill="#8a93a6" fontSize="9" fontFamily="JetBrains Mono">
          slip
        </text>

        {/* Branch 3: bottom-right */}
        <path
          d="M300 300 Q 380 380, 460 460"
          stroke="url(#sim-cyan)"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="460" cy="460" r="5" fill="#c6f0ff" />
        <text x="470" y="455" fill="#c6f0ff" fontSize="11" fontFamily="JetBrains Mono">
          0.88
        </text>
        <text x="470" y="470" fill="#8a93a6" fontSize="9" fontFamily="JetBrains Mono">
          human enters
        </text>

        {/* Branch 4: bottom */}
        <path
          d="M300 300 Q 300 400, 300 480"
          stroke="url(#sim-cyan)"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="300" cy="480" r="5" fill="#c6f0ff" />
        <text x="310" y="475" fill="#c6f0ff" fontSize="11" fontFamily="JetBrains Mono">
          0.81
        </text>
        <text x="310" y="490" fill="#8a93a6" fontSize="9" fontFamily="JetBrains Mono">
          environment
        </text>

        {/* Winner indicator */}
        <g opacity="0.6">
          <line
            x1="460"
            y1="140"
            x2="520"
            y2="80"
            stroke="#ffd7a3"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <text
            x="525"
            y="75"
            fill="#ffd7a3"
            fontSize="9"
            fontFamily="JetBrains Mono"
            style={{ letterSpacing: 1 }}
          >
            SELECTED
          </text>
        </g>
      </svg>

      {/* Corner labels */}
      <div className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
        simulation · t = 0.0ms
      </div>
      <div className="absolute right-4 bottom-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
        4 futures · 1 action
      </div>
    </div>
  );
}
