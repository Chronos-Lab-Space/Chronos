import { useMemo, useState } from "react";
import {
  fork,
  evaluate,
  collapse,
  reset,
  run,
  createEngine,
} from "../../application/chronos/engine";
import { capabilityWorkloads, getCapabilityWorkload } from "../../domain/chronos/capabilities";
import type { CapabilityWorkload } from "../../domain/chronos/capabilities";
import type { CollapseStrategy, Engine } from "../../domain/chronos/types";
import { VirtualBranchList } from "../features/visualization/VirtualBranchList";
import { VirtualTimelineEvents } from "../features/timeline/VirtualTimelineEvents";
import { TaskGraphPreview } from "../features/planner/TaskGraphPreview";
import { StartupLaunchPlanner } from "../../application/planner/StartupLaunchPlanner";

export function Product() {
  const [workloadId, setWorkloadId] = useState(capabilityWorkloads[0].id);
  const [engine, setEngine] = useState<Engine>(() => {
    const workload = getCapabilityWorkload(capabilityWorkloads[0].id);
    return createEngine(
      workload.scenario.id,
      workload.scenario.initialState,
      workload.scenario.actions
    );
  });
  const [strategy, setStrategy] = useState<CollapseStrategy>("max-utility");

  const workload = useMemo(() => getCapabilityWorkload(workloadId), [workloadId]);
  const taskGraph = useMemo(
    () =>
      new StartupLaunchPlanner().decompose({
        workspaceId: "workspace-demo",
        decisionId: `launch-startup-${workload.id}`,
        prompt: "Launch startup",
      }),
    [workload.id]
  );

  const switchWorkload = (id: string) => {
    const nextWorkload = getCapabilityWorkload(id);
    setWorkloadId(id);
    setEngine(
      createEngine(
        nextWorkload.scenario.id,
        nextWorkload.scenario.initialState,
        nextWorkload.scenario.actions
      )
    );
  };

  return (
    <section className="relative pb-24 lg:pb-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Capability workload selector. Providers register capabilities; the engine executes tasks. */}
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {capabilityWorkloads.map((capabilityWorkload) => (
            <CapabilityCard
              key={capabilityWorkload.id}
              workload={capabilityWorkload}
              active={workloadId === capabilityWorkload.id}
              onClick={() => switchWorkload(capabilityWorkload.id)}
            />
          ))}
        </div>

        {/* Workload registration strip */}
        <div
          className="mb-6 rounded-xl border bg-bg-soft/60 p-5"
          style={{ borderColor: `${workload.accent}30` }}
        >
          <div className="flex items-start gap-4">
            <div
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: workload.accent }}
            />
            <div className="flex-1">
              <div
                className="font-mono text-[10px] uppercase tracking-[0.25em]"
                style={{ color: workload.accent }}
              >
                {workload.domain} · {workload.problem}
              </div>
              <div className="mt-2 text-[13px] leading-[1.65] text-ink-dim">{workload.stakes}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {workload.capabilities.map((capability) => (
                  <span
                    key={capability.id}
                    className="rounded-full border border-line bg-bg px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint"
                  >
                    registered: {capability.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <TaskGraphPreview
          graph={taskGraph}
          capabilityName={workload.capabilities[0]?.name ?? "No capability registered"}
        />

        {/* Phase controls */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <PhaseButton
            label="01 · fork"
            onClick={() => setEngine(fork(engine))}
            disabled={engine.phase !== "idle"}
            active={engine.phase === "forked"}
            done={engine.phase === "evaluated" || engine.phase === "collapsed"}
            color="#c6f0ff"
          />
          <span className="font-mono text-ink-faint">→</span>
          <PhaseButton
            label="02 · evaluate"
            onClick={() => setEngine(evaluate(engine))}
            disabled={engine.phase !== "forked"}
            active={engine.phase === "evaluated"}
            done={engine.phase === "collapsed"}
            color="#b79bff"
          />
          <span className="font-mono text-ink-faint">→</span>
          <PhaseButton
            label="03 · collapse"
            onClick={() => setEngine(collapse(engine, strategy))}
            disabled={engine.phase !== "evaluated"}
            active={engine.phase === "collapsed"}
            done={false}
            color="#ffd7a3"
          />
          <button
            type="button"
            onClick={() => setEngine(run(engine, strategy))}
            disabled={engine.phase === "collapsed"}
            className="rounded-md border border-chronos/40 bg-chronos/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-chronos transition hover:bg-chronos/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Run all
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                strategy
              </span>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as CollapseStrategy)}
                className="rounded-md border border-line bg-bg px-2 py-1 font-mono text-[11px] text-ink focus:border-chronos/40 focus:outline-none"
              >
                <option value="max-utility">max-utility</option>
                <option value="min-risk">min-risk</option>
                <option value="balanced">balanced</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setEngine(reset(engine, workload.scenario.initialState))}
              className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim transition hover:border-line-strong hover:text-ink"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left: World State + Actions */}
          <div className="space-y-4 lg:col-span-4">
            <WorldStatePanel engine={engine} workload={workload} />
            <ActionsPanel engine={engine} />
          </div>

          {/* Center: Branch visualization */}
          <div className="lg:col-span-5">
            <BranchTree engine={engine} />
          </div>

          {/* Right: Log + Stats */}
          <div className="space-y-4 lg:col-span-3">
            <StatsPanel engine={engine} />
            <ExecutionLog engine={engine} />
          </div>
        </div>

        {/* Candidate scenarios generated from registered capabilities */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          {workload.candidateScenarios.map((q, i) => (
            <div key={i} className="rounded-xl border border-line bg-bg-soft/60 p-4">
              <div
                className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em]"
                style={{ color: workload.accent }}
              >
                branch · 0x{i.toString(16).padStart(2, "0")}
              </div>
              <div className="text-[13px] leading-[1.55] text-ink-dim italic">{q}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- Capability workload card ----

function CapabilityCard({
  workload,
  active,
  onClick,
}: {
  workload: CapabilityWorkload;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border p-5 text-left transition ${
        active
          ? "bg-bg-soft"
          : "border-line bg-bg-soft/40 hover:border-line-strong hover:bg-bg-soft/60"
      }`}
      style={
        active
          ? { borderColor: `${workload.accent}60`, boxShadow: `0 0 0 1px ${workload.accent}15` }
          : undefined
      }
    >
      <div className="flex items-start gap-4">
        <CapabilityIcon icon={workload.icon} accent={workload.accent} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-serif text-2xl leading-tight text-ink">{workload.name}</div>
            {active && (
              <span
                className="font-mono text-[10px] uppercase tracking-[0.25em]"
                style={{ color: workload.accent }}
              >
                active
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
            {workload.domain}
          </div>
          <div className="mt-3 line-clamp-2 text-[12px] leading-[1.55] text-ink-dim">
            {workload.description}
          </div>
        </div>
      </div>
    </button>
  );
}

function CapabilityIcon({ icon, accent }: { icon: CapabilityWorkload["icon"]; accent: string }) {
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border"
      style={{ borderColor: `${accent}40`, background: `${accent}10` }}
    >
      {icon === "forge" && (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 18h16M6 18v-4l2-2h8l2 2v4M9 12V8l3-3 3 3v4"
            stroke={accent}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M11 10h2" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      {icon === "oracle" && (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"
            stroke={accent}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" stroke={accent} strokeWidth="1.5" />
          <circle cx="12" cy="12" r="1" fill={accent} />
        </svg>
      )}
      {icon === "atlas" && (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={accent} strokeWidth="1.5" />
          <path
            d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"
            stroke={accent}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}

// ---- Phase button ----

function PhaseButton({
  label,
  onClick,
  disabled,
  active,
  done,
  color,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  active: boolean;
  done: boolean;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] transition ${
        active
          ? "border-transparent"
          : disabled
            ? "cursor-not-allowed border-line text-ink-faint/50"
            : "border-line text-ink-dim hover:border-line-strong hover:text-ink"
      }`}
      style={
        active
          ? { background: `${color}20`, color, borderColor: `${color}60` }
          : done
            ? { borderColor: `${color}40`, color }
            : undefined
      }
    >
      {done ? "✓ " : ""}
      {label}
    </button>
  );
}

// ---- World State panel (domain-aware labels) ----

function WorldStatePanel({ engine, workload }: { engine: Engine; workload: CapabilityWorkload }) {
  const { world } = engine;

  // Map each capability workload's semantics onto the generic fields.
  const labels = {
    forge: {
      agent: {
        title: "team",
        rows: [
          { k: "velocity", v: `${world.robot.x} pts/wk` },
          { k: "days left", v: world.robot.y },
          { k: "quality", v: `${world.robot.armAngle}°` },
          { k: "flag", v: world.robot.gripOpen ? "ready" : "locked" },
        ],
      },
      goal: {
        title: "feature",
        rows: [
          { k: "LOC target", v: `-${world.object.x}` },
          { k: "open bugs", v: world.object.y },
          { k: "coverage", v: world.object.stable ? "stable" : "fragile" },
          { k: "shipped", v: world.object.grasped ? "yes" : "no" },
        ],
      },
      context: {
        title: "environment",
        rows: [
          { k: "stakeholder", v: world.environment.humanPresent ? "watching" : "clear" },
          { k: "debt pressure", v: world.environment.wind },
          { k: "morale", v: world.environment.lighting },
        ],
      },
    },
    oracle: {
      agent: {
        title: "position",
        rows: [
          { k: "size", v: `${world.robot.x}%` },
          { k: "vol", v: `${world.robot.y}%` },
          { k: "conviction", v: `${world.robot.armAngle}°` },
          { k: "exposure", v: world.robot.gripOpen ? "flexible" : "locked" },
        ],
      },
      goal: {
        title: "event",
        rows: [
          { k: "minutes to print", v: world.object.x },
          { k: "P&L", v: `${world.object.y} bps` },
          { k: "tape", v: world.object.stable ? "thick" : "thin" },
          { k: "holding", v: world.object.grasped ? "yes" : "flat" },
        ],
      },
      context: {
        title: "market",
        rows: [
          { k: "human desk", v: world.environment.humanPresent ? "on" : "off" },
          { k: "macro wind", v: world.environment.wind },
          { k: "signals", v: world.environment.lighting },
        ],
      },
    },
    atlas: {
      agent: {
        title: "company",
        rows: [
          { k: "runway", v: `${world.robot.x} mo` },
          { k: "MRR", v: `$${world.robot.y}k` },
          { k: "momentum", v: `${world.robot.armAngle}°` },
          { k: "optionality", v: world.robot.gripOpen ? "open" : "committed" },
        ],
      },
      goal: {
        title: "landscape",
        rows: [
          { k: "churn", v: `${world.object.x}%` },
          { k: "competitor", v: `$${world.object.y}M` },
          { k: "market", v: world.object.stable ? "stable" : "shifting" },
          { k: "positioned", v: world.object.grasped ? "yes" : "no" },
        ],
      },
      context: {
        title: "board & market",
        rows: [
          { k: "board", v: world.environment.humanPresent ? "watching" : "hands-off" },
          { k: "competitive wind", v: world.environment.wind },
          { k: "clarity", v: world.environment.lighting },
        ],
      },
    },
  }[workload.id as "forge" | "oracle" | "atlas"]!;

  return (
    <div className="rounded-xl border border-line bg-bg-soft p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
          World State
        </div>
        <div className="font-mono text-[10px] text-ink-faint">t = {world.timestamp}</div>
      </div>

      <div className="space-y-4">
        <StateGroup label={labels.agent.title} color={workload.accent} rows={labels.agent.rows} />
        <StateGroup label={labels.goal.title} color={workload.accent} rows={labels.goal.rows} />
        <StateGroup
          label={labels.context.title}
          color={workload.accent}
          rows={labels.context.rows}
        />
      </div>
    </div>
  );
}

function StateGroup({
  label,
  color,
  rows,
}: {
  label: string;
  color: string;
  rows: { k: string; v: string | number }[];
}) {
  return (
    <div>
      <div
        className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em]"
        style={{ color }}
      >
        <span className="h-1 w-1 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div key={r.k} className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-ink-faint">{r.k}</span>
            <span className="text-ink tabular-nums">{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Actions panel ----

function ActionsPanel({ engine }: { engine: Engine }) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
          Candidate Tasks
        </div>
        <div className="font-mono text-[10px] text-ink-faint">{engine.actions.length}</div>
      </div>

      <div className="space-y-2">
        {engine.actions.map((a) => (
          <div key={a.id} className="rounded-md border border-line bg-bg p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[12px] text-ink">{a.name}</span>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-ink-faint">R:{a.baseRisk.toFixed(2)}</span>
                <span className="text-ink-faint">·</span>
                <span className="text-ink-faint">W:{a.baseReward.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-1 text-[11px] leading-[1.5] text-ink-dim">{a.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Branch tree ----

function BranchTree({ engine }: { engine: Engine }) {
  const branches = engine.branches;
  const hasBranches = branches.length > 0;

  return (
    <div className="glow-border relative h-full min-h-[320px] overflow-hidden rounded-xl border border-line bg-bg-soft sm:min-h-[500px]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
          Branch Topology
        </div>
        <div className="shrink-0 font-mono text-[10px] text-ink-faint">
          {hasBranches ? `${branches.length} branches` : "no branches"}
        </div>
      </div>

      <div className="relative overflow-x-auto p-3 sm:p-5">
        {!hasBranches ? (
          <div className="flex h-[280px] flex-col items-center justify-center sm:h-[440px]">
            <svg width="60" height="60" viewBox="0 0 60 60" className="mb-4 text-ink-faint">
              <circle
                cx="30"
                cy="30"
                r="20"
                stroke="currentColor"
                strokeWidth="1"
                fill="none"
                strokeDasharray="2 4"
              />
              <circle cx="30" cy="30" r="4" fill="currentColor" opacity="0.4" />
            </svg>
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
              Press "fork" to branch
            </div>
          </div>
        ) : branches.length > 60 ? (
          <VirtualBranchList branches={branches} />
        ) : (
          <svg
            viewBox="0 0 640 440"
            className="h-auto min-w-[520px] w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="br-branch" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#c6f0ff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#c6f0ff" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="br-evaluated" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#b79bff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#b79bff" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="br-winner" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ffd7a3" stopOpacity="1" />
                <stop offset="100%" stopColor="#ffd7a3" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="br-pruned" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4a5168" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#4a5168" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            <g>
              <circle cx="60" cy="220" r="12" fill="#c6f0ff" opacity="0.15" />
              <circle cx="60" cy="220" r="6" fill="#c6f0ff" />
              <text
                x="60"
                y="252"
                fill="#4a5168"
                fontSize="9"
                fontFamily="JetBrains Mono"
                textAnchor="middle"
                style={{ letterSpacing: 2 }}
              >
                ORIGIN
              </text>
            </g>

            {branches.map((b, i) => {
              const count = branches.length;
              const t = (i + 1) / (count + 1);
              const y = 60 + t * 320;

              let stroke = "url(#br-branch)";
              let nodeColor = "#c6f0ff";
              let nodeRadius = 4;
              let opacity = 1;

              if (b.status === "evaluated") {
                stroke = "url(#br-evaluated)";
                nodeColor = "#b79bff";
              } else if (b.status === "winner") {
                stroke = "url(#br-winner)";
                nodeColor = "#ffd7a3";
                nodeRadius = 6;
              } else if (b.status === "pruned") {
                stroke = "url(#br-pruned)";
                nodeColor = "#4a5168";
                nodeRadius = 3;
                opacity = 0.4;
              }

              return (
                <g key={b.id} opacity={opacity}>
                  <path
                    d={`M60 220 C 180 220, 220 ${y}, 360 ${y}`}
                    stroke={stroke}
                    strokeWidth={b.status === "winner" ? 2 : 1}
                    fill="none"
                  />
                  <circle cx="360" cy={y} r={nodeRadius} fill={nodeColor} />
                  {b.status === "winner" && (
                    <circle cx="360" cy={y} r="14" fill={nodeColor} opacity="0.15" />
                  )}

                  <text x="380" y={y - 2} fill="#e8ecf2" fontSize="11" fontFamily="JetBrains Mono">
                    {b.actionName}
                  </text>
                  <text x="380" y={y + 12} fill="#4a5168" fontSize="9" fontFamily="JetBrains Mono">
                    branch_{b.id}
                  </text>
                  {b.reason && (
                    <text
                      x="380"
                      y={y + 24}
                      fill="#4a5168"
                      fontSize="8"
                      fontFamily="JetBrains Mono"
                      fontStyle="italic"
                    >
                      {b.reason}
                    </text>
                  )}

                  {b.score !== null && (
                    <g>
                      <rect
                        x={520}
                        y={y - 10}
                        width="60"
                        height="20"
                        rx="3"
                        fill={b.status === "winner" ? "#ffd7a3" : "#b79bff"}
                        opacity={b.status === "winner" ? 0.2 : 0.15}
                      />
                      <text
                        x={550}
                        y={y + 4}
                        fill={b.status === "winner" ? "#ffd7a3" : "#b79bff"}
                        fontSize="11"
                        fontFamily="JetBrains Mono"
                        textAnchor="middle"
                      >
                        {(b.score ?? 0).toFixed(3)}
                      </text>
                    </g>
                  )}

                  {b.status === "winner" && (
                    <text
                      x={520}
                      y={y + 22}
                      fill="#ffd7a3"
                      fontSize="8"
                      fontFamily="JetBrains Mono"
                      style={{ letterSpacing: 1.5 }}
                    >
                      WINNER
                    </text>
                  )}
                  {b.status === "pruned" && (
                    <>
                      <text
                        x={520}
                        y={y + 22}
                        fill="#4a5168"
                        fontSize="8"
                        fontFamily="JetBrains Mono"
                        style={{ letterSpacing: 1.5 }}
                      >
                        PRUNED
                      </text>
                      <g opacity="0.6">
                        <line
                          x1="355"
                          y1={y - 5}
                          x2="365"
                          y2={y + 5}
                          stroke="#4a5168"
                          strokeWidth="1"
                        />
                        <line
                          x1="365"
                          y1={y - 5}
                          x2="355"
                          y2={y + 5}
                          stroke="#4a5168"
                          strokeWidth="1"
                        />
                      </g>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

// ---- Stats panel ----

function StatsPanel({ engine }: { engine: Engine }) {
  const winner = engine.branches.find((b) => b.status === "winner");
  const evaluated = engine.branches.filter((b) => b.status === "evaluated");
  const pruned = engine.branches.filter((b) => b.status === "pruned");

  return (
    <div className="rounded-xl border border-line bg-bg-soft p-5">
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
        Runtime Stats
      </div>

      <div className="space-y-3">
        <Stat k="Phase" v={engine.phase} color="#c6f0ff" />
        <Stat k="Branches" v={engine.branches.length} color="#c6f0ff" />
        <Stat k="Evaluated" v={evaluated.length} color="#b79bff" />
        <Stat k="Pruned" v={pruned.length} color="#4a5168" />
        <Stat
          k="Winner"
          v={winner ? `branch_${winner.id}` : "—"}
          color={winner ? "#ffd7a3" : "#4a5168"}
        />
        <Stat
          k="Score"
          v={winner?.score !== undefined && winner?.score !== null ? winner.score.toFixed(3) : "—"}
          color={winner ? "#ffd7a3" : "#4a5168"}
        />
        {winner?.reason && <Stat k="Why" v={winner.reason} color="#ffd7a3" />}
      </div>
    </div>
  );
}

function Stat({ k, v, color }: { k: string; v: string | number; color: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line/60 pb-2 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">{k}</span>
      <span className="font-mono text-[12px] tabular-nums" style={{ color }}>
        {v}
      </span>
    </div>
  );
}

// ---- Execution log ----

function ExecutionLog({ engine }: { engine: Engine }) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
          Execution Log
        </div>
        <div className="font-mono text-[10px] text-ink-faint">{engine.log.length}</div>
      </div>

      <VirtualTimelineEvents events={engine.log} />
    </div>
  );
}
