import { ScrollReveal } from "./ScrollReveal";

export function Intelligence() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* The feedback loop */}
        <ScrollReveal variant="scale">
        <div className="glow-border relative overflow-hidden rounded-2xl border border-line bg-bg-soft p-10 lg:p-16">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left: The loop */}
            <div className="lg:col-span-5">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
                The compounding cycle
              </h3>
              <div className="mt-8">
                <FeedbackLoop />
              </div>
            </div>

            {/* Right: The five domains */}
            <div className="lg:col-span-7">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
                What it learns
              </h3>
              <div className="mt-8 space-y-6">
                {[
                  {
                    domain: "Software projects",
                    pattern: "How codebases evolve, where bugs emerge, which architectures scale",
                    color: "#c6f0ff",
                  },
                  {
                    domain: "User behavior",
                    pattern: "What drives engagement, where users drop off, which features compound",
                    color: "#b79bff",
                  },
                  {
                    domain: "Business growth",
                    pattern: "How companies scale, where bottlenecks form, which strategies win",
                    color: "#ffd7a3",
                  },
                  {
                    domain: "Market reactions",
                    pattern: "How markets respond to events, what creates momentum, where risks hide",
                    color: "#c6f0ff",
                  },
                  {
                    domain: "Agent interactions",
                    pattern: "How AI agents collaborate, where conflicts emerge, which protocols work",
                    color: "#b79bff",
                  },
                ].map((d, i) => (
                  <div key={d.domain} className="flex items-start gap-4">
                    <div
                      className="mt-1 h-2 w-2 rounded-full"
                      style={{ background: d.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3">
                        <span className="text-[15px] font-medium text-ink">
                          {d.domain}
                        </span>
                        <span className="font-mono text-[10px] text-ink-faint">
                          0{i + 1}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] leading-[1.65] text-ink-dim">
                        {d.pattern}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Moat callout */}
              <div className="mt-10 border-l-2 border-chronos/40 pl-6">
                <p className="text-[14px] leading-[1.7] text-ink-dim">
                  <span className="font-medium text-ink">The moat:</span> Every
                  customer makes the world model richer. Every simulation makes
                  the next one more accurate. This compounds over years into an
                  advantage that's nearly impossible to replicate — because
                  competitors would need to run the same volume of simulations
                  across the same diversity of domains to catch up.
                </p>
              </div>
            </div>
          </div>
        </div>
        </ScrollReveal>

        {/* Bottom: The implication */}
        <ScrollReveal stagger variant="fade" className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {[
            {
              title: "Day 1",
              value: "Good",
              desc: "Chronos simulates futures based on first principles and causal logic.",
            },
            {
              title: "Year 1",
              value: "Better",
              desc: "It's seen millions of outcomes across thousands of customers. Patterns emerge.",
            },
            {
              title: "Year 5",
              value: "Unfair",
              desc: "The world model knows things no individual could. Simulations approach prescience.",
            },
          ].map((m) => (
            <div
              key={m.title}
              className="rounded-2xl border border-line bg-bg-soft p-8"
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
                {m.title}
              </div>
              <div className="mt-3 font-serif text-4xl text-ink">{m.value}</div>
              <p className="mt-4 text-[13px] leading-[1.7] text-ink-dim">
                {m.desc}
              </p>
            </div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}

function FeedbackLoop() {
  return (
    <svg viewBox="0 0 400 400" className="h-auto w-full">
      <defs>
        <linearGradient id="loop-cyan" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c6f0ff" />
          <stop offset="100%" stopColor="#c6f0ff" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="loop-violet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b79bff" />
          <stop offset="100%" stopColor="#b79bff" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="loop-warm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd7a3" />
          <stop offset="100%" stopColor="#ffd7a3" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Center: World model */}
      <circle cx="200" cy="200" r="50" stroke="#c6f0ff" strokeWidth="1.5" fill="none" opacity="0.6" />
      <circle cx="200" cy="200" r="60" stroke="#c6f0ff" strokeWidth="0.5" fill="none" opacity="0.2" />
      <text x="200" y="195" fill="#c6f0ff" fontSize="12" fontFamily="JetBrains Mono" textAnchor="middle">
        WORLD
      </text>
      <text x="200" y="210" fill="#c6f0ff" fontSize="12" fontFamily="JetBrains Mono" textAnchor="middle">
        MODEL
      </text>

      {/* Outer ring with arrows */}
      <circle
        cx="200"
        cy="200"
        r="140"
        stroke="url(#loop-cyan)"
        strokeWidth="1"
        fill="none"
        strokeDasharray="4 8"
        opacity="0.4"
      />

      {/* Four stages around the loop */}
      {[
        { angle: 0, label: "SIMULATE", color: "#c6f0ff" },
        { angle: 90, label: "OBSERVE", color: "#b79bff" },
        { angle: 180, label: "LEARN", color: "#ffd7a3" },
        { angle: 270, label: "IMPROVE", color: "#c6f0ff" },
      ].map((stage, i) => {
        const rad = (stage.angle * Math.PI) / 180;
        const x = 200 + 140 * Math.cos(rad);
        const y = 200 + 140 * Math.sin(rad);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="30" stroke={stage.color} strokeWidth="1" fill="#111111" opacity="0.8" />
            <text
              x={x}
              y={y + 4}
              fill={stage.color}
              fontSize="10"
              fontFamily="JetBrains Mono"
              textAnchor="middle"
              style={{ letterSpacing: 1 }}
            >
              {stage.label}
            </text>
          </g>
        );
      })}

      {/* Arrows between stages */}
      {[0, 90, 180, 270].map((angle, i) => {
        const startRad = ((angle + 20) * Math.PI) / 180;
        const endRad = ((angle + 70) * Math.PI) / 180;
        const x1 = 200 + 140 * Math.cos(startRad);
        const y1 = 200 + 140 * Math.sin(startRad);
        const x2 = 200 + 140 * Math.cos(endRad);
        const y2 = 200 + 140 * Math.sin(endRad);
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} A 140 140 0 0 1 ${x2} ${y2}`}
            stroke="#c6f0ff"
            strokeWidth="0.8"
            fill="none"
            opacity="0.3"
            markerEnd="url(#arrow)"
          />
        );
      })}

      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#c6f0ff" opacity="0.5" />
        </marker>
      </defs>

      {/* Connections to center */}
      {[0, 90, 180, 270].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x = 200 + 110 * Math.cos(rad);
        const y = 200 + 110 * Math.sin(rad);
        return (
          <line
            key={i}
            x1={200 + 60 * Math.cos(rad)}
            y1={200 + 60 * Math.sin(rad)}
            x2={x}
            y2={y}
            stroke="#c6f0ff"
            strokeWidth="0.5"
            opacity="0.2"
            strokeDasharray="2 3"
          />
        );
      })}
    </svg>
  );
}
