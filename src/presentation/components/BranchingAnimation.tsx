import { useEffect, useMemo, useState, type CSSProperties } from "react";

/**
 * Hero temporal decision tree: state → expand futures → prune → collapse → best path.
 * Phase cycle is React-driven so SVG transitions stay in sync.
 */

type Node = {
  id: string;
  x: number;
  y: number;
  parent?: string;
  /** Expand/draw order (lower first). */
  order: number;
  label?: string;
};

type Phase = "state" | "expand" | "evaluate" | "prune" | "collapse" | "result";

const phaseSequence: { phase: Phase; duration: number; label: string }[] = [
  { phase: "state", duration: 1100, label: "Current state" },
  { phase: "expand", duration: 2100, label: "Generate futures" },
  { phase: "evaluate", duration: 1400, label: "Evaluate trade-offs" },
  { phase: "prune", duration: 1300, label: "Prune weak paths" },
  { phase: "collapse", duration: 1000, label: "Collapse" },
  { phase: "result", duration: 2400, label: "Best path" },
];

const winningNodeIds = new Set(["origin", "b", "b2"]);

const nodes: Node[] = [
  { id: "origin", x: 400, y: 72, order: 0, label: "Goal" },

  { id: "a", x: 170, y: 178, parent: "origin", order: 1, label: "A" },
  { id: "b", x: 400, y: 178, parent: "origin", order: 1, label: "B" },
  { id: "c", x: 630, y: 178, parent: "origin", order: 1, label: "C" },

  { id: "a1", x: 88, y: 292, parent: "a", order: 2 },
  { id: "a2", x: 170, y: 292, parent: "a", order: 2 },
  { id: "a3", x: 252, y: 292, parent: "a", order: 2 },
  { id: "b1", x: 340, y: 292, parent: "b", order: 2 },
  { id: "b2", x: 460, y: 292, parent: "b", order: 2 },
  { id: "c1", x: 548, y: 292, parent: "c", order: 2 },
  { id: "c2", x: 630, y: 292, parent: "c", order: 2 },
  { id: "c3", x: 712, y: 292, parent: "c", order: 2 },
];

const nodeById = new Map(nodes.map((node) => [node.id, node]));

const futuresByBranch: Record<string, string> = {
  a: "Raise",
  b: "Ship",
  c: "Wait",
};

function curve(from: Node, to: Node) {
  const midpointY = from.y + (to.y - from.y) * 0.52;
  return `M ${from.x} ${from.y + 13} C ${from.x} ${midpointY}, ${to.x} ${midpointY}, ${to.x} ${to.y - 13}`;
}

function isWinningEdge(parentId: string, nodeId: string) {
  return (parentId === "origin" && nodeId === "b") || (parentId === "b" && nodeId === "b2");
}

function phaseLabel(phase: Phase) {
  return phaseSequence.find((p) => p.phase === phase)?.label ?? phase;
}

function futuresCount(phase: Phase) {
  switch (phase) {
    case "state":
      return "—";
    case "expand":
      return "1,024";
    case "evaluate":
      return "312";
    case "prune":
      return "48";
    case "collapse":
      return "3";
    case "result":
      return "1";
  }
}

export function BranchingAnimation() {
  const [phase, setPhase] = useState<Phase>("state");

  useEffect(() => {
    let index = 0;
    let timer: number | undefined;
    let cancelled = false;

    const advance = () => {
      if (cancelled) return;
      const current = phaseSequence[index];
      setPhase(current.phase);
      timer = window.setTimeout(() => {
        index = (index + 1) % phaseSequence.length;
        advance();
      }, current.duration);
    };

    advance();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const edges = useMemo(
    () =>
      nodes
        .filter((node) => node.parent)
        .map((node) => {
          const parent = nodeById.get(node.parent!);
          if (!parent) return null;
          return {
            node,
            parent,
            winner: isWinningEdge(node.parent!, node.id),
            path: curve(parent, node),
            delay: node.order * 0.12 + (node.x / 800) * 0.08,
          };
        })
        .filter(Boolean) as {
        node: Node;
        parent: Node;
        winner: boolean;
        path: string;
        delay: number;
      }[],
    []
  );

  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        x: 40 + ((i * 97) % 720),
        y: 40 + ((i * 53) % 420),
        r: 0.8 + (i % 3) * 0.35,
        delay: (i % 7) * 0.45,
        duration: 5 + (i % 5),
      })),
    []
  );

  return (
    <div
      className="tree-visual relative mx-auto w-full max-w-[680px] overflow-hidden rounded-2xl border border-line bg-bg-soft/70 p-3 shadow-[0_0_0_1px_rgba(198,240,255,0.04)_inset] sm:p-6"
      data-phase={phase}
    >
      {/* Ambient layers */}
      <div className="pointer-events-none absolute inset-0 line-grid opacity-25" />
      <div className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-chronos/10 blur-3xl tree-ambient-glow" />
      <div className="pointer-events-none absolute -right-10 bottom-10 h-36 w-36 rounded-full bg-accent-2/10 blur-3xl tree-ambient-glow-delayed" />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-chronos blink" />
            <span className="font-mono text-[10px] uppercase tracking-[0.23em] text-ink-dim">
              Temporal decision tree
            </span>
          </div>
          <div className="mt-2 font-mono text-[11px] tracking-[0.04em] text-chronos transition-opacity duration-300">
            {phaseLabel(phase)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            Futures
          </div>
          <div className="mt-1 font-serif text-xl tabular-nums text-ink tree-futures-count">
            {futuresCount(phase)}
          </div>
        </div>
      </div>

      {/* Phase progress rail */}
      <div className="relative mt-4 flex gap-1">
        {phaseSequence.map((step) => {
          const active = step.phase === phase;
          const done =
            phaseSequence.findIndex((p) => p.phase === phase) >
            phaseSequence.findIndex((p) => p.phase === step.phase);
          return (
            <div
              key={step.phase}
              className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${
                active
                  ? "bg-chronos shadow-[0_0_8px_rgba(198,240,255,0.45)]"
                  : done
                    ? "bg-chronos/40"
                    : "bg-line"
              }`}
            />
          );
        })}
      </div>

      <svg
        viewBox="0 0 800 500"
        className="relative mt-2 h-auto w-full"
        aria-label="Current state branching into futures before collapsing to the best path"
      >
        <defs>
          <linearGradient id="tree-path" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c6f0ff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#b79bff" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id="tree-winner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c6f0ff" />
            <stop offset="55%" stopColor="#ffd7a3" />
            <stop offset="100%" stopColor="#b79bff" />
          </linearGradient>
          <linearGradient id="tree-winner-soft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c6f0ff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffd7a3" stopOpacity="0.1" />
          </linearGradient>
          <radialGradient id="tree-origin" cx="0.35" cy="0.25" r="0.7">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#c6f0ff" />
            <stop offset="100%" stopColor="#6687a4" />
          </radialGradient>
          <radialGradient id="tree-win" cx="0.35" cy="0.25" r="0.7">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#ffd7a3" />
            <stop offset="100%" stopColor="#b79bff" />
          </radialGradient>
          <filter id="tree-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="tree-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Soft ambient particles */}
        {particles.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill="#c6f0ff"
            className="tree-particle"
            style={
              {
                "--tree-delay": `${p.delay}s`,
                "--tree-dur": `${p.duration}s`,
              } as CSSProperties
            }
          />
        ))}

        <text
          x="400"
          y="24"
          fill="#8a93a6"
          fontSize="11"
          fontFamily="JetBrains Mono, ui-monospace, monospace"
          textAnchor="middle"
          style={{ letterSpacing: 2.2 }}
        >
          CURRENT STATE
        </text>

        {/* Edges — glow underlay for winners, then stroke */}
        {edges.map(({ node, winner, path, delay }) => (
          <g key={`edge-${node.parent}-${node.id}`}>
            {winner && (
              <path
                pathLength="1"
                d={path}
                className="tree-edge tree-edge-winner-glow"
                stroke="url(#tree-winner-soft)"
                style={{ transitionDelay: `${delay}s` }}
                filter="url(#tree-soft-glow)"
              />
            )}
            <path
              pathLength="1"
              d={path}
              className={winner ? "tree-edge tree-edge-winner" : "tree-edge"}
              stroke={winner ? "url(#tree-winner)" : "url(#tree-path)"}
              style={{ transitionDelay: `${delay}s` }}
            />
            {winner && (
              <circle r="2.4" fill="#ffd7a3" className="tree-flow-dot" filter="url(#tree-glow)">
                <animateMotion dur="1.6s" repeatCount="indefinite" path={path} begin="0s" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.15;0.75;1"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        ))}

        {/* Mid-level branch labels */}
        {(["a", "b", "c"] as const).map((id) => {
          const n = nodeById.get(id)!;
          const isWin = winningNodeIds.has(id);
          return (
            <text
              key={`label-${id}`}
              x={n.x}
              y={n.y - 22}
              textAnchor="middle"
              fill={isWin ? "#ffd7a3" : "#8a93a6"}
              fontSize="10"
              fontFamily="JetBrains Mono, ui-monospace, monospace"
              className={`tree-branch-label${isWin ? " tree-branch-label-win" : ""}`}
              style={{ letterSpacing: 1.2 }}
            >
              {futuresByBranch[id]}
            </text>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isOrigin = node.id === "origin";
          const onWinningPath = winningNodeIds.has(node.id);
          const delay = node.order * 0.1;
          return (
            <g
              key={node.id}
              className={`tree-node${onWinningPath ? " tree-node-winner" : ""}${isOrigin ? " tree-node-origin" : ""}`}
              style={{ transitionDelay: `${delay}s` }}
            >
              {onWinningPath && !isOrigin && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="26"
                  fill="#ffd7a3"
                  opacity="0.1"
                  className="tree-node-halo"
                />
              )}
              {isOrigin && (
                <>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="28"
                    fill="none"
                    stroke="#c6f0ff"
                    strokeWidth="0.8"
                    className="tree-origin-ring"
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="22"
                    fill="none"
                    stroke="#c6f0ff"
                    strokeWidth="0.6"
                    opacity="0.35"
                    className="tree-origin-ring-inner"
                  />
                </>
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={isOrigin ? 13 : onWinningPath ? 10 : 7}
                fill={
                  isOrigin
                    ? "url(#tree-origin)"
                    : onWinningPath
                      ? "url(#tree-win)"
                      : "#7b79be"
                }
                opacity={onWinningPath || isOrigin ? 1 : 0.78}
                filter={onWinningPath || isOrigin ? "url(#tree-glow)" : undefined}
              />
              {isOrigin && (
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  fill="#0c1520"
                  fontSize="8"
                  fontFamily="JetBrains Mono, ui-monospace, monospace"
                  fontWeight="600"
                >
                  G
                </text>
              )}
            </g>
          );
        })}

        {/* Prune marks on losing leaves */}
        {nodes
          .filter((node) => node.order === 2 && !winningNodeIds.has(node.id))
          .map((node) => (
            <g key={`prune-${node.id}`} className="tree-prune">
              <line
                x1={node.x - 5.5}
                y1={node.y - 5.5}
                x2={node.x + 5.5}
                y2={node.y + 5.5}
                stroke="#5a6278"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <line
                x1={node.x + 5.5}
                y1={node.y - 5.5}
                x2={node.x - 5.5}
                y2={node.y + 5.5}
                stroke="#5a6278"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
          ))}

        {/* Collapse arrow to result */}
        <g className="tree-collapse">
          <path
            d="M460 322 L460 386"
            stroke="url(#tree-winner)"
            strokeWidth="1.6"
            strokeDasharray="3 5"
            filter="url(#tree-glow)"
          />
          <path
            d="M454 380 L460 388 L466 380"
            stroke="#ffd7a3"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Result card */}
        <g className="tree-result">
          <rect
            x="300"
            y="400"
            width="300"
            height="64"
            rx="10"
            fill="#1C3E4E"
            stroke="#E2DDDA"
            strokeOpacity="0.5"
            filter="url(#tree-soft-glow)"
          />
          <rect
            x="300"
            y="400"
            width="4"
            height="64"
            rx="2"
            fill="#ffd7a3"
            opacity="0.9"
          />
          <circle cx="334" cy="432" r="8" fill="url(#tree-win)" filter="url(#tree-glow)" />
          <text
            x="354"
            y="426"
            fill="#ffd7a3"
            fontSize="11"
            fontFamily="JetBrains Mono, ui-monospace, monospace"
            style={{ letterSpacing: 1.5 }}
          >
            BEST PATH
          </text>
          <text
            x="354"
            y="444"
            fill="#8a93a6"
            fontSize="10"
            fontFamily="JetBrains Mono, ui-monospace, monospace"
          >
            Ship · score 0.942 · conf 87%
          </text>
        </g>

        <text
          x="400"
          y="488"
          fill="#4a5168"
          fontSize="10"
          fontFamily="JetBrains Mono, ui-monospace, monospace"
          textAnchor="middle"
          style={{ letterSpacing: 1.6 }}
        >
          RANKED FUTURES → 1 DECISION
        </text>
      </svg>
    </div>
  );
}
