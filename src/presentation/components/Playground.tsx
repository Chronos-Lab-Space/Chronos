import { useEffect, useState } from "react";

type Phase = "idle" | "fork" | "evaluate" | "collapse" | "done";

const PHASE_DURATION = 2600;

export function Playground() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [auto, setAuto] = useState(true);
  const [branchCount, setBranchCount] = useState(0);
  const [evalProgress, setEvalProgress] = useState(0);
  const [entropy, setEntropy] = useState(1.0);
  const [activeBranch, setActiveBranch] = useState<string | null>(null);

  useEffect(() => {
    if (!auto) return;
    const phases: Phase[] = ["fork", "evaluate", "collapse", "done"];
    let i = 0;

    const advance = () => {
      setPhase(phases[i]);
      i = (i + 1) % phases.length;
    };

    advance();
    const t = setInterval(advance, PHASE_DURATION);
    return () => clearInterval(t);
  }, [auto]);

  // Animate branch count during fork phase
  useEffect(() => {
    if (phase === "fork") {
      setBranchCount(0);
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / (PHASE_DURATION * 0.9), 1);
        setBranchCount(Math.floor(progress * 64));
      }, 30);
      return () => clearInterval(interval);
    } else if (phase === "idle") {
      setBranchCount(0);
    } else {
      setBranchCount(64);
    }
  }, [phase]);

  // Animate evaluation progress
  useEffect(() => {
    if (phase === "evaluate") {
      setEvalProgress(0);
      setEntropy(1.0);
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / (PHASE_DURATION * 0.9), 1);
        setEvalProgress(progress);
        setEntropy(1.0 - progress * 0.85);
        setActiveBranch(
          progress < 0.3
            ? "0x2f1a"
            : progress < 0.6
              ? "0x4a2c"
              : progress < 0.85
                ? "0x7f3e"
                : "0x4a"
        );
      }, 40);
      return () => clearInterval(interval);
    } else if (phase === "idle") {
      setEvalProgress(0);
      setEntropy(1.0);
      setActiveBranch(null);
    }
  }, [phase]);

  const run = () => {
    setAuto(false);
    setPhase("fork");
    setTimeout(() => setPhase("evaluate"), PHASE_DURATION);
    setTimeout(() => setPhase("collapse"), PHASE_DURATION * 2);
    setTimeout(() => setPhase("done"), PHASE_DURATION * 3);
    setTimeout(() => {
      setAuto(true);
    }, PHASE_DURATION * 4);
  };

  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-12 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-chronos blink" />
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
              live demo · auto-running
            </span>
          </div>
          <button
            type="button"
            onClick={run}
            className="group inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim transition hover:border-chronos/40 hover:text-chronos"
          >
            Replay cycle
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className="transition group-hover:rotate-180"
              style={{ transitionDuration: "500ms" }}
            >
              <path
                d="M5 1a4 4 0 1 0 4 4M9 1v4h-4"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Demo panel */}
        <div className="glow-border relative overflow-hidden rounded-2xl border border-line bg-bg-soft">
          {/* Phase tabs — scroll on narrow screens so labels are not cropped */}
          <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
              <div className="flex min-w-max items-center gap-1">
                {[
                  { key: "fork", label: "01 · fork" },
                  { key: "evaluate", label: "02 · evaluate" },
                  { key: "collapse", label: "03 · collapse" },
                  { key: "done", label: "04 · commit" },
                ].map((p) => {
                  const active = phase === p.key || (phase === "idle" && p.key === "fork");
                  return (
                    <div
                      key={p.key}
                      className={`shrink-0 rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] transition ${
                        active ? "bg-chronos/15 text-chronos" : "text-ink-faint"
                      }`}
                    >
                      {p.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              {phase === "idle" && "0.0ms"}
              {phase === "fork" && "0.3ms"}
              {phase === "evaluate" && "1.4ms"}
              {phase === "collapse" && "2.1ms"}
              {phase === "done" && "committed"}
            </div>
          </div>

          {/* Main content: canvas + side panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Canvas — taller on mobile so branch labels stay in view */}
            <div className="relative aspect-[16/10] w-full min-h-[220px] sm:aspect-[21/9] lg:col-span-8 lg:aspect-auto lg:min-h-[480px]">
              <PlaygroundCanvas
                phase={phase}
                evalProgress={evalProgress}
                branchCount={branchCount}
              />
            </div>

            {/* Side panel: live metrics */}
            <div className="border-t border-line bg-bg/50 p-6 lg:col-span-4 lg:border-t-0 lg:border-l">
              <div className="mb-5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                Runtime telemetry
              </div>

              <div className="space-y-4">
                <Metric
                  label="Active branches"
                  value={phase === "idle" ? "—" : branchCount.toLocaleString()}
                  color="#c6f0ff"
                  progress={phase === "fork" ? branchCount / 64 : phase === "idle" ? 0 : 1}
                />
                <Metric
                  label="Evaluation"
                  value={
                    phase === "evaluate"
                      ? `${Math.floor(evalProgress * 100)}%`
                      : phase === "idle"
                        ? "—"
                        : phase === "fork"
                          ? "0%"
                          : "100%"
                  }
                  color="#b79bff"
                  progress={
                    phase === "evaluate"
                      ? evalProgress
                      : phase === "idle" || phase === "fork"
                        ? 0
                        : 1
                  }
                />
                <Metric
                  label="Entropy"
                  value={phase === "idle" ? "—" : entropy.toFixed(3)}
                  color="#ffd7a3"
                  progress={1 - entropy}
                />
                <Metric
                  label="Sim depth"
                  value={phase === "idle" ? "—" : "10⁶ steps"}
                  color="#c6f0ff"
                  progress={phase === "idle" ? 0 : 1}
                />
              </div>

              {/* Active branch */}
              <div className="mt-6 border-t border-line pt-5">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                  Currently evaluating
                </div>
                <div className="font-mono text-sm text-accent-2">
                  {activeBranch ? `branch_${activeBranch}` : "—"}
                </div>
                {activeBranch && (
                  <div className="mt-1 font-mono text-[11px] text-ink-faint">
                    score: {(0.3 + Math.random() * 0.15).toFixed(3)}
                  </div>
                )}
              </div>

              {/* Winner */}
              <div className="mt-5 border-t border-line pt-5">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                  Winner
                </div>
                <div
                  className={`font-mono text-sm transition ${phase === "done" ? "text-accent-warm" : "text-ink-faint"}`}
                >
                  {phase === "done" ? "branch_0x4a" : "—"}
                </div>
                {phase === "done" && (
                  <div className="mt-1 font-mono text-[11px] text-ink-faint">score: 0.942</div>
                )}
              </div>

              {/* Status log */}
              <div className="mt-6 border-t border-line pt-5">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                  Status
                </div>
                <div className="space-y-1 font-mono text-[11px] leading-[1.6]">
                  <LogLine
                    active={
                      phase === "fork" ||
                      phase === "evaluate" ||
                      phase === "collapse" ||
                      phase === "done"
                    }
                    done={phase !== "fork"}
                    color="#c6f0ff"
                  >
                    fork → 10,000 branches
                  </LogLine>
                  <LogLine
                    active={phase === "evaluate" || phase === "collapse" || phase === "done"}
                    done={phase === "collapse" || phase === "done"}
                    color="#b79bff"
                  >
                    evaluate ·{" "}
                    {phase === "evaluate"
                      ? `${Math.floor(evalProgress * 100)}%`
                      : phase === "idle" || phase === "fork"
                        ? "0%"
                        : "100%"}
                  </LogLine>
                  <LogLine
                    active={phase === "collapse" || phase === "done"}
                    done={phase === "done"}
                    color="#ffd7a3"
                  >
                    collapse → branch_0x4a
                  </LogLine>
                  <LogLine active={phase === "done"} done={phase === "done"} color="#ffd7a3">
                    commit · state hash 8f3a2c
                  </LogLine>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline strip at bottom */}
          <div className="border-t border-line bg-bg-soft/60 px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                t =
              </div>
              <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-line">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width:
                      phase === "idle"
                        ? "0%"
                        : phase === "fork"
                          ? "15%"
                          : phase === "evaluate"
                            ? `${15 + evalProgress * 55}%`
                            : phase === "collapse"
                              ? "80%"
                              : "100%",
                    background:
                      phase === "idle"
                        ? "transparent"
                        : phase === "fork"
                          ? "#c6f0ff"
                          : phase === "evaluate"
                            ? "#b79bff"
                            : "#ffd7a3",
                  }}
                />
              </div>
              <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink">
                {phase === "idle" && "0.0ms"}
                {phase === "fork" && "0.3ms"}
                {phase === "evaluate" && "1.4ms"}
                {phase === "collapse" && "2.1ms"}
                {phase === "done" && "2.1ms ✓"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  color,
  progress,
}: {
  label: string;
  value: string;
  color: string;
  progress: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
          {label}
        </div>
        <div className="font-mono text-sm tabular-nums" style={{ color }}>
          {value}
        </div>
      </div>
      <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progress * 100}%`,
            background: color,
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  );
}

function LogLine({
  active,
  done,
  color,
  children,
}: {
  active: boolean;
  done: boolean;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full transition"
        style={{
          background: active ? color : "#4a5168",
          opacity: active ? 1 : 0.3,
        }}
      />
      <span
        className="transition"
        style={{
          color: active ? color : "#4a5168",
          opacity: active ? 1 : 0.5,
        }}
      >
        {done ? "✓" : active ? "→" : "·"}
      </span>
      <span
        className="transition"
        style={{
          color: active ? "#e8ecf2" : "#4a5168",
          opacity: active ? 1 : 0.5,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function PlaygroundCanvas({
  phase,
  evalProgress,
  branchCount,
}: {
  phase: Phase;
  evalProgress: number;
  branchCount: number;
}) {
  const visualBranches = phase === "idle" ? 0 : 12;
  const showWinner = phase === "collapse" || phase === "done";

  return (
    <svg viewBox="0 0 1200 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="pg-branch" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c6f0ff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#c6f0ff" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="pg-winner" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffd7a3" stopOpacity="1" />
          <stop offset="100%" stopColor="#ffd7a3" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="pg-pruned" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4a5168" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#4a5168" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id="pg-node">
          <stop offset="0%" stopColor="#c6f0ff" stopOpacity="1" />
          <stop offset="100%" stopColor="#c6f0ff" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id="pg-winner-node">
          <stop offset="0%" stopColor="#ffd7a3" stopOpacity="1" />
          <stop offset="100%" stopColor="#ffd7a3" stopOpacity="0.2" />
        </radialGradient>
        <filter id="pg-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background grid */}
      <g opacity="0.3">
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={i * 100 + 50}
            y1="0"
            x2={i * 100 + 50}
            y2="500"
            stroke="#e8ecf2"
            strokeWidth="0.3"
            opacity="0.15"
          />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0"
            y1={i * 100}
            x2="1200"
            y2={i * 100}
            stroke="#e8ecf2"
            strokeWidth="0.3"
            opacity="0.15"
          />
        ))}
      </g>

      {/* State origin */}
      <g>
        <circle cx="120" cy="250" r="10" fill="url(#pg-node)" filter="url(#pg-glow)" />
        <circle cx="120" cy="250" r="20" fill="#c6f0ff" opacity="0.08" />
        <text
          x="120"
          y="295"
          fill="#4a5168"
          fontSize="10"
          fontFamily="JetBrains Mono"
          textAnchor="middle"
          style={{ letterSpacing: 2 }}
        >
          ORIGIN
        </text>
        <text
          x="120"
          y="310"
          fill="#4a5168"
          fontSize="8"
          fontFamily="JetBrains Mono"
          textAnchor="middle"
        >
          state_0x00
        </text>
      </g>

      {/* Branches */}
      {Array.from({ length: visualBranches }).map((_, i) => {
        const t = (i + 1) / (branchCount + 1);
        const y = 70 + t * 360;
        const isWinner = showWinner && i === Math.floor(branchCount / 2);
        const isPruned = (phase === "collapse" || phase === "done") && !isWinner;
        const stroke = isWinner
          ? "url(#pg-winner)"
          : isPruned
            ? "url(#pg-pruned)"
            : "url(#pg-branch)";
        const opacity = isWinner
          ? 1
          : isPruned
            ? 0.25
            : phase === "collapse"
              ? 0.3
              : 0.85 - i * 0.03;

        return (
          <g
            key={i}
            style={{
              transition: "opacity 700ms ease",
              opacity,
            }}
          >
            {/* Branch path */}
            <path
              d={`M120 250 C 320 250, 380 ${y}, 580 ${y}`}
              stroke={stroke}
              strokeWidth={isWinner ? 1.4 : isPruned ? 0.4 : 0.7}
              fill="none"
            />
            {/* Branch node */}
            <circle
              cx="580"
              cy={y}
              r={isWinner ? 5 : isPruned ? 1.5 : 2.5}
              fill={isWinner ? "#ffd7a3" : isPruned ? "#4a5168" : "#c6f0ff"}
              opacity={isWinner ? 1 : isPruned ? 0.4 : 0.8}
            />
            {/* Winner glow */}
            {isWinner && (
              <g>
                <circle cx="580" cy={y} r="12" fill="#ffd7a3" opacity="0.15" />
                <circle cx="580" cy={y} r="20" fill="#ffd7a3" opacity="0.05" />
              </g>
            )}
            {/* Evaluate segment */}
            {(phase === "evaluate" || phase === "collapse" || phase === "done") && !isPruned && (
              <g>
                <line
                  x1="580"
                  y1={y}
                  x2={phase === "collapse" || phase === "done" ? 700 : 880}
                  y2={y}
                  stroke={stroke}
                  strokeWidth={isWinner ? 0.8 : 0.4}
                  opacity={phase === "collapse" || phase === "done" ? (isWinner ? 1 : 0.15) : 0.6}
                />
              </g>
            )}
            {/* Evaluate dots (data flowing) */}
            {phase === "evaluate" && !isPruned && (
              <g>
                {[0, 1, 2, 3, 4].map((j) => {
                  const xPos = 620 + j * 50;
                  const progress = evalProgress * 5;
                  const visible = j <= progress;
                  return (
                    <circle
                      key={j}
                      cx={xPos}
                      cy={y}
                      r={visible ? 2 : 1}
                      fill="#b79bff"
                      opacity={visible ? 0.8 : 0.2}
                    />
                  );
                })}
              </g>
            )}
            {/* Score badge during evaluate */}
            {phase === "evaluate" && evalProgress > 0.3 && !isPruned && i % 3 === 0 && (
              <g opacity={Math.min(1, (evalProgress - 0.3) * 3)}>
                <rect
                  x={720}
                  y={y - 8}
                  width="40"
                  height="16"
                  rx="3"
                  fill="#111111"
                  stroke={isWinner ? "#E2DDDA" : "#989898"}
                  strokeWidth="0.5"
                />
                <text
                  x={740}
                  y={y + 3}
                  fill={isWinner ? "#ffd7a3" : "#8a93a6"}
                  fontSize="8"
                  fontFamily="JetBrains Mono"
                  textAnchor="middle"
                >
                  {isWinner ? "0.94" : (0.3 + i * 0.05).toFixed(2)}
                </text>
              </g>
            )}
            {/* Pruned indicator */}
            {isPruned && (
              <g opacity="0.5">
                <line x1="575" y1={y - 5} x2="585" y2={y + 5} stroke="#4a5168" strokeWidth="0.8" />
                <line x1="585" y1={y - 5} x2="575" y2={y + 5} stroke="#4a5168" strokeWidth="0.8" />
              </g>
            )}
            {/* Winner line to commit */}
            {isWinner && (
              <g>
                <line
                  x1="580"
                  y1={y}
                  x2={phase === "collapse" ? 800 : 1080}
                  y2={250}
                  stroke="url(#pg-winner)"
                  strokeWidth="1.4"
                  opacity={phase === "collapse" ? 0.7 : 1}
                />
              </g>
            )}
          </g>
        );
      })}

      {/* Evaluate marker */}
      {(phase === "evaluate" || phase === "collapse" || phase === "done") && (
        <g>
          <line
            x1="880"
            y1="60"
            x2="880"
            y2="440"
            stroke="#b79bff"
            strokeWidth="0.5"
            opacity="0.25"
            strokeDasharray="2 4"
          />
          <text
            x="880"
            y="50"
            fill="#8a93a6"
            fontSize="9"
            fontFamily="JetBrains Mono"
            textAnchor="middle"
            style={{ letterSpacing: 2 }}
          >
            EVALUATE
          </text>
        </g>
      )}

      {/* Collapse marker */}
      {(phase === "collapse" || phase === "done") && (
        <g>
          <line
            x1="700"
            y1="60"
            x2="700"
            y2="440"
            stroke="#ffd7a3"
            strokeWidth="0.5"
            opacity="0.25"
            strokeDasharray="2 4"
          />
          <text
            x="700"
            y="50"
            fill="#8a93a6"
            fontSize="9"
            fontFamily="JetBrains Mono"
            textAnchor="middle"
            style={{ letterSpacing: 2 }}
          >
            COLLAPSE
          </text>
        </g>
      )}

      {/* Commit node */}
      {showWinner && (
        <g>
          <circle cx="1080" cy="250" r="10" fill="url(#pg-winner-node)" filter="url(#pg-glow)" />
          <circle cx="1080" cy="250" r="20" fill="#ffd7a3" opacity="0.15" />
          <circle
            cx="1080"
            cy="250"
            r="28"
            fill="none"
            stroke="#ffd7a3"
            strokeWidth="0.5"
            opacity="0.4"
            className={phase === "done" ? "pulse-ring" : ""}
            style={{ transformOrigin: "1080px 250px" }}
          />
          <text
            x="1080"
            y="295"
            fill="#ffd7a3"
            fontSize="10"
            fontFamily="JetBrains Mono"
            textAnchor="middle"
            style={{ letterSpacing: 2 }}
          >
            COMMIT
          </text>
          <text
            x="1080"
            y="310"
            fill="#8a93a6"
            fontSize="8"
            fontFamily="JetBrains Mono"
            textAnchor="middle"
          >
            state_0x8f3a
          </text>
        </g>
      )}

      {/* Branch count indicator (top-left) */}
      {phase !== "idle" && (
        <g>
          <text
            x="50"
            y="40"
            fill="#4a5168"
            fontSize="9"
            fontFamily="JetBrains Mono"
            style={{ letterSpacing: 2 }}
          >
            BRANCHES
          </text>
          <text x="50" y="60" fill="#c6f0ff" fontSize="16" fontFamily="JetBrains Mono">
            {branchCount.toLocaleString()}
          </text>
        </g>
      )}
    </svg>
  );
}
