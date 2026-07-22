import { ScrollReveal } from "./ScrollReveal";

export function Features() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Bento */}
        <ScrollReveal stagger variant="fade" className="grid grid-cols-12 gap-4">
          {/* 1 — Hero: Temporal Fork (7 cols) — the only card with glow-border */}
          <div className="glow-border card-hover group relative col-span-12 overflow-hidden rounded-2xl border border-line bg-bg-soft p-10 lg:col-span-7 lg:p-12">
            <div className="flex h-full flex-col justify-between gap-10">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
                  01 · Temporal fork
                </div>
                <h3 className="mt-5 font-serif text-4xl leading-[1.05] md:text-5xl">
                  Branch reality,
                  <br />
                  <span className="italic">in milliseconds.</span>
                </h3>
                <p className="mt-5 max-w-lg text-[14px] leading-[1.7] text-ink-dim">
                  Create diverging compute paths from any state. Each branch is
                  isolated, deterministic, and cheap enough to create millions
                  of — then collapse them into the future you actually want.
                </p>
              </div>

              <ForkViz />
            </div>
          </div>

          {/* 2 — Stat card (5 cols) */}
          <div className="card-hover group relative col-span-12 overflow-hidden rounded-2xl border border-line bg-bg-soft p-10 lg:col-span-5 lg:p-12">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
                Parallel throughput
              </div>
              <div className="mt-6 font-serif text-7xl leading-none tracking-tight md:text-8xl">
                <span className="gradient-text">10</span>
                <sup className="ml-1 text-3xl text-ink-dim md:text-4xl">⁶</sup>
              </div>
              <div className="mt-4 text-[14px] leading-[1.7] text-ink-dim">
                simultaneous world simulations
                <br />
                on a single node.
              </div>
            </div>

            <div className="mt-12 flex items-center gap-2 border-t border-line pt-5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim">
                A100 · 12-node cluster
              </span>
            </div>
          </div>

          {/* 3 — Entropy Scheduling (4 cols) */}
          <div className="card-hover group relative col-span-12 overflow-hidden rounded-2xl border border-line bg-bg-soft p-10 lg:col-span-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
              02 · Entropy-aware scheduling
            </div>
            <h3 className="mt-5 font-serif text-3xl leading-tight">
              Zero <span className="italic">wasted</span> compute.
            </h3>
            <p className="mt-4 text-[13px] leading-[1.7] text-ink-dim">
              The scheduler measures the informational entropy of every task and
              routes high-entropy work to the deepest layer of the stack.
            </p>
            <WaveViz />
          </div>

          {/* 4 — Causal Engine (4 cols) */}
          <div className="card-hover group relative col-span-12 overflow-hidden rounded-2xl border border-line bg-bg-soft p-10 lg:col-span-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent-2">
              03 · Causal inference engine
            </div>
            <h3 className="mt-5 font-serif text-3xl leading-tight">
              See what <span className="italic">comes next.</span>
            </h3>
            <p className="mt-4 text-[13px] leading-[1.7] text-ink-dim">
              A built-in causal graph tracks every decision, counterfactual, and
              dependency — so agents can answer "what if?" at any depth.
            </p>
            <GraphViz />
          </div>

          {/* 5 — Zero-drift (4 cols) */}
          <div className="card-hover group relative col-span-12 overflow-hidden rounded-2xl border border-line bg-bg-soft p-10 lg:col-span-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent-warm">
              04 · Zero-drift state
            </div>
            <h3 className="mt-5 font-serif text-3xl leading-tight">
              State that <span className="italic">never lies.</span>
            </h3>
            <p className="mt-4 text-[13px] leading-[1.7] text-ink-dim">
              Versioned simulations and saved paths stay in workspace memory so
              you can reopen, re-run, and compare decisions over time.
            </p>
            <TimelineViz />
          </div>

          {/* 6 — Wide: Parallel worlds (7 cols) */}
          <div className="card-hover group relative col-span-12 overflow-hidden rounded-2xl border border-line bg-bg-soft p-10 lg:col-span-7 lg:p-12">
            <div className="flex h-full flex-col justify-between gap-10">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent-2">
                  05 · Parallel world evaluation
                </div>
                <h3 className="mt-5 font-serif text-4xl leading-[1.05] md:text-5xl">
                  Every decision,
                  <br />
                  <span className="italic">evaluated in full.</span>
                </h3>
                <p className="mt-5 max-w-lg text-[14px] leading-[1.7] text-ink-dim">
                  Compare ranked futures side by side — confidence, risk, and
                  trade-offs — then collapse into a Decision Report you can save.
                </p>
              </div>
              <ParallelViz />
            </div>
          </div>

          {/* 7 — Post-quantum (5 cols) */}
          <div className="card-hover group relative col-span-12 overflow-hidden rounded-2xl border border-line bg-bg-soft p-10 lg:col-span-5 lg:p-12">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
                06 · Post-quantum security
              </div>
              <h3 className="mt-5 font-serif text-3xl leading-tight">
                Future-proof, <span className="italic">literally.</span>
              </h3>
              <p className="mt-4 text-[13px] leading-[1.7] text-ink-dim">
                Lattice-based key agreement. Hash-based signatures. Every
                temporal branch is sealed with algorithms that will survive the
                computers we haven't built yet.
              </p>
            </div>
            <div className="mt-10 flex items-center gap-3 border-t border-line pt-5">
              <ShieldIcon />
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim">
                ML-KEM-768 · ML-DSA-65
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

/* --- Visualizations — refined, diagrammatic --- */

function ForkViz() {
  return (
    <svg viewBox="0 0 600 180" className="h-40 w-full">
      <defs>
        <linearGradient id="fork-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c6f0ff" />
          <stop offset="100%" stopColor="#c6f0ff" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {/* root node */}
      <circle cx="40" cy="90" r="5" fill="#c6f0ff" />
      <circle cx="40" cy="90" r="10" fill="#c6f0ff" opacity="0.15" />

      {/* branches — clean, fewer, smoother curves */}
      {[
        { y: 30, op: 0.9 },
        { y: 90, op: 0.75 },
        { y: 150, op: 0.6 },
      ].map((b, i) => (
        <g key={i}>
          <path
            d={`M40 90 C 200 90, 240 ${b.y}, 400 ${b.y}`}
            stroke="url(#fork-g)"
            strokeWidth="0.8"
            fill="none"
            opacity={b.op}
          />
          <circle cx="400" cy={b.y} r="2.5" fill="#c6f0ff" opacity={b.op} />
          {/* sub-branches — very subtle */}
          {[0, 1, 2].map((j) => {
            const ny = b.y + (j - 1) * 14;
            return (
              <path
                key={j}
                d={`M400 ${b.y} C 480 ${b.y}, 510 ${ny}, 580 ${ny}`}
                stroke="url(#fork-g)"
                strokeWidth="0.4"
                fill="none"
                opacity={b.op * 0.4}
              />
            );
          })}
        </g>
      ))}

      {/* Labels */}
      <text x="40" y="118" fill="#4a5168" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle" style={{ letterSpacing: 2 }}>
        ORIGIN
      </text>
      <text x="400" y="175" fill="#4a5168" fontSize="9" fontFamily="JetBrains Mono" style={{ letterSpacing: 2 }}>
        BRANCH · 0x7F2A
      </text>
    </svg>
  );
}

function WaveViz() {
  return (
    <svg viewBox="0 0 420 80" className="mt-10 h-16 w-full">
      <defs>
        <linearGradient id="wave-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c6f0ff" />
          <stop offset="100%" stopColor="#b79bff" />
        </linearGradient>
      </defs>
      <path
        d="M0 40 Q 30 10, 60 40 T 120 40 T 180 40 T 240 40 T 300 40 T 360 40 T 420 40"
        stroke="url(#wave-g)"
        strokeWidth="1.2"
        fill="none"
      />
      {/* subtle bars */}
      {Array.from({ length: 42 }).map((_, i) => {
        const h = 2 + Math.abs(Math.sin(i * 0.6)) * 14;
        return <rect key={i} x={i * 10} y={72 - h} width="3" height={h} fill="#c6f0ff" opacity="0.08" />;
      })}
    </svg>
  );
}

function GraphViz() {
  const nodes = [
    { x: 40, y: 60 },
    { x: 120, y: 25 },
    { x: 120, y: 95 },
    { x: 210, y: 60 },
    { x: 290, y: 25 },
    { x: 290, y: 95 },
    { x: 370, y: 60 },
  ];
  const edges: [number, number][] = [
    [0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6],
  ];
  return (
    <svg viewBox="0 0 400 120" className="mt-10 h-24 w-full">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="#b79bff"
          strokeWidth="0.6"
          opacity="0.3"
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="6" fill="#b79bff" opacity="0.08" />
          <circle cx={n.x} cy={n.y} r="2.5" fill="#b79bff" />
        </g>
      ))}
    </svg>
  );
}

function TimelineViz() {
  const xs = [40, 110, 190, 270, 350];
  return (
    <svg viewBox="0 0 420 90" className="mt-10 h-20 w-full">
      <line x1="20" y1="40" x2="400" y2="40" stroke="#ffd7a3" strokeWidth="0.5" opacity="0.3" />
      {xs.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={40} r="3" fill="#ffd7a3" opacity={0.5 + i * 0.1} />
          <circle cx={x} cy={40} r="7" fill="#ffd7a3" opacity="0.06" />
          <text x={x} y={65} fill="#4a5168" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">
            t{i}
          </text>
          <text x={x} y={28} fill="#8a93a6" fontSize="7" fontFamily="JetBrains Mono" textAnchor="middle">
            SHA-256
          </text>
        </g>
      ))}
    </svg>
  );
}

function ParallelViz() {
  const rows = 5;
  const cols = 16;
  return (
    <svg viewBox="0 0 560 100" className="h-20 w-full">
      {Array.from({ length: rows }).map((_, r) => (
        <g key={r}>
          <line x1="10" y1={15 + r * 18} x2="550" y2={15 + r * 18} stroke="#b79bff" strokeWidth="0.3" opacity="0.2" />
          {Array.from({ length: cols }).map((_, c) => {
            const active = (r + c) % 4 === 0 || (r * c) % 7 === 0;
            return (
              <circle
                key={c}
                cx={25 + c * 34}
                cy={15 + r * 18}
                r={active ? 2.5 : 1}
                fill={active ? "#b79bff" : "#4a5168"}
                opacity={active ? 0.85 : 0.25}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-chronos">
      <path
        d="M12 2L4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
