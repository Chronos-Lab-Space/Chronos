import { useEffect, useMemo, useRef, useState } from "react";
import { compile, presetPrograms, toAuthoredState } from "../../domain/chronos/language";
import {
  fork,
  evaluate,
  collapse,
  createEngine,
  reset,
  run,
} from "../../application/chronos/engine";
import type { Engine } from "../../domain/chronos/types";
import type { CollapseStrategy } from "../../domain/chronos/types";

export function LanguageSection() {
  const [source, setSource] = useState(presetPrograms.forge.source);
  const [program, setProgram] = useState(presetPrograms.forge.name);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [strategy, setStrategy] = useState<CollapseStrategy>("max-utility");
  const [scoreFnName, setScoreFnName] = useState<string | null>(null);

  // Parse source on every change
  const compileResult = useMemo(() => {
    try {
      const compiled = compile(source);
      return { ok: true, compiled } as const;
    } catch (e: any) {
      const line = e?.line;
      const col = e?.col;
      const msg = e?.message ?? String(e);
      const location =
        line !== undefined ? `line ${line}${col !== undefined ? `, col ${col}` : ""}: ` : "";
      return { ok: false, error: `${location}${msg}` } as const;
    }
  }, [source]);

  // When source changes, rebuild engine
  useEffect(() => {
    if (!compileResult.ok) {
      setEngine(null);
      return;
    }
    const { initialState, actions } = compileResult.compiled;
    // Find first score fn name
    const scoreNames = Object.keys(compileResult.compiled.scoreFns);
    setScoreFnName(scoreNames[0] ?? null);
    const eng = createEngine("custom", initialState, actions);
    setEngine(eng);
  }, [compileResult]);

  const loadPreset = (key: keyof typeof presetPrograms) => {
    setProgram(presetPrograms[key].name);
    setSource(presetPrograms[key].source);
  };

  const runFork = () => {
    if (!engine) return;
    setEngine(fork(engine));
  };

  const runEvaluate = () => {
    if (!engine) return;
    // The program's own `score` block decides these numbers when it declares
    // one — toAuthoredState puts the state back in the namespaces the score
    // body reads. With no score block, or one that returns a non-number, the
    // built-in reward/risk model stays in charge.
    const score = scoreFnName ? compileResult.compiled?.scoreFns[scoreFnName] : undefined;
    setEngine(
      evaluate(
        engine,
        score
          ? (branch) =>
              score({
                ...toAuthoredState(branch.state),
                risk: branch.risk,
                reward: branch.reward,
              })
          : undefined
      )
    );
  };

  const runCollapse = () => {
    if (!engine) return;
    setEngine(collapse(engine, strategy));
  };

  const runReset = () => {
    if (!engine || !compileResult.ok) return;
    setEngine(reset(engine, compileResult.compiled.initialState));
  };

  const runAll = () => {
    if (!engine) return;
    setEngine(run(engine, strategy));
  };

  return (
    <section className="relative pb-16 lg:pb-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Language thesis */}
        <div className="mb-8 rounded-2xl border border-line bg-bg-soft p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                What is Chronos Language?
              </div>
              <p className="mt-2 max-w-3xl text-[14px] leading-[1.65] text-ink-dim">
                A domain-specific language for temporal reasoning. Instead of hand-coding engine
                input, agents write Chronos: declare their world, define actions with risk and
                reward, express scoring logic in a few lines, and let the runtime do the rest. Same
                engine. Every domain.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-chronos" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-chronos">
                v0.1 · mvp
              </span>
            </div>
          </div>
        </div>

        {/* REPL */}
        <Repl
          source={source}
          onSourceChange={setSource}
          program={program}
          onLoadPreset={loadPreset}
          compileResult={compileResult}
          engine={engine}
          strategy={strategy}
          onStrategyChange={setStrategy}
          onFork={runFork}
          onEvaluate={runEvaluate}
          onCollapse={runCollapse}
          onReset={runReset}
          onRunAll={runAll}
          scoreFnName={scoreFnName}
        />

        {/* Syntax reference */}
        <div className="mt-12">
          <SyntaxReference />
        </div>
      </div>
    </section>
  );
}

// ---- REPL component ----

type ReplProps = {
  source: string;
  onSourceChange: (s: string) => void;
  program: string;
  onLoadPreset: (key: keyof typeof presetPrograms) => void;
  compileResult: { ok: true; compiled: ReturnType<typeof compile> } | { ok: false; error: string };
  engine: Engine | null;
  strategy: CollapseStrategy;
  onStrategyChange: (s: CollapseStrategy) => void;
  onFork: () => void;
  onEvaluate: () => void;
  onCollapse: () => void;
  onReset: () => void;
  onRunAll: () => void;
  scoreFnName: string | null;
};

function Repl({
  source,
  onSourceChange,
  program,
  onLoadPreset,
  compileResult,
  engine,
  strategy,
  onStrategyChange,
  onFork,
  onEvaluate,
  onCollapse,
  onReset,
  onRunAll,
  scoreFnName,
}: ReplProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  // Sync scroll between textarea and highlight overlay
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left: Code editor */}
      <div className="lg:col-span-7">
        <div className="glow-border relative overflow-hidden rounded-xl border border-line bg-bg-soft">
          {/* Chrome */}
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-ink-faint/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-faint/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-faint/50" />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={program}
                onChange={(e) => {
                  const key = e.target.value as keyof typeof presetPrograms;
                  onLoadPreset(key);
                }}
                className="rounded-md border border-line bg-bg px-2 py-1 font-mono text-[11px] text-ink"
              >
                {Object.entries(presetPrograms).map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.name}
                  </option>
                ))}
                <option value="custom" disabled>
                  custom…
                </option>
              </select>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                main.chronos
              </span>
            </div>
          </div>

          {/* Editor */}
          <div className="relative h-[600px]">
            {/* Highlight backdrop */}
            <pre
              ref={highlightRef}
              className="pointer-events-none absolute inset-0 overflow-auto p-4 font-mono text-[12px] leading-[1.7]"
              aria-hidden="true"
            >
              <code>
                <Highlight source={source} />
                {"\n"}
              </code>
            </pre>
            {/* Actual editable textarea */}
            <textarea
              ref={textareaRef}
              value={source}
              onChange={(e) => onSourceChange(e.target.value)}
              onScroll={handleScroll}
              spellCheck={false}
              className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-4 font-mono text-[12px] leading-[1.7] text-transparent caret-chronos outline-none"
              style={{ caretColor: "#c6f0ff" }}
            />
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between border-t border-line bg-bg-soft px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    compileResult.ok ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
                <span className={compileResult.ok ? "text-ink-dim" : "text-rose-400"}>
                  {compileResult.ok ? "compiled" : "error"}
                </span>
              </span>
              <span className="text-ink-faint">
                {source.split("\n").length} lines · {source.length} chars
              </span>
            </div>
            <span className="text-ink-faint">chronos v0.1</span>
          </div>
        </div>

        {/* Error display */}
        {!compileResult.ok && (
          <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/5 p-3 font-mono text-[11px] text-rose-300">
            <span className="uppercase tracking-[0.2em]">parse error · </span>
            {compileResult.error}
          </div>
        )}
      </div>

      {/* Right: Output */}
      <div className="space-y-4 lg:col-span-5">
        {/* Controls */}
        <div className="rounded-xl border border-line bg-bg-soft p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
              Runtime
            </div>
            <select
              value={strategy}
              onChange={(e) => onStrategyChange(e.target.value as CollapseStrategy)}
              className="rounded-md border border-line bg-bg px-2 py-1 font-mono text-[10px] text-ink"
            >
              <option value="max-utility">collapse: max-utility</option>
              <option value="min-risk">collapse: min-risk</option>
              <option value="balanced">collapse: balanced</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onFork}
              disabled={!compileResult.ok || !engine || engine.phase !== "idle"}
              className="rounded-md border border-chronos/40 bg-chronos/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-chronos transition hover:bg-chronos/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              01 · fork
            </button>
            <button
              type="button"
              onClick={onEvaluate}
              disabled={engine?.phase !== "forked"}
              className="rounded-md border border-accent-2/40 bg-accent-2/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-accent-2 transition hover:bg-accent-2/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              02 · evaluate
            </button>
            <button
              type="button"
              onClick={onCollapse}
              disabled={engine?.phase !== "evaluated"}
              className="rounded-md border border-accent-warm/40 bg-accent-warm/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-accent-warm transition hover:bg-accent-warm/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              03 · collapse
            </button>
            <button
              type="button"
              onClick={onRunAll}
              disabled={!compileResult.ok || !engine || engine.phase !== "idle"}
              className="ml-auto rounded-md border border-line bg-bg px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              ▶ run all
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={!engine}
              className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              reset
            </button>
          </div>
        </div>

        {/* Compiled state */}
        <OutputPanel title="World State" subtitle={engine ? `t = ${engine.world.timestamp}` : "—"}>
          {compileResult.ok ? (
            <JsonView value={stateToView(compileResult.compiled.initialState)} />
          ) : (
            <div className="font-mono text-[11px] text-ink-faint">
              parse error — fix source to see compiled state
            </div>
          )}
        </OutputPanel>

        {/* Compiled actions */}
        <OutputPanel title="Actions" subtitle={engine ? `${engine.actions.length}` : "—"}>
          {engine ? (
            <div className="space-y-1.5">
              {engine.actions.map((a) => (
                <div
                  key={a.id}
                  className="flex items-baseline justify-between font-mono text-[11px]"
                >
                  <span className="text-ink">{a.name}</span>
                  <span className="text-ink-faint">
                    R:{a.baseRisk.toFixed(2)} · W:{a.baseReward.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="font-mono text-[11px] text-ink-faint">—</div>
          )}
        </OutputPanel>

        {/* Score function */}
        <OutputPanel title="Score" subtitle={scoreFnName ? `${scoreFnName} · applied` : "—"}>
          {compileResult.ok && scoreFnName ? (
            <div className="space-y-1.5">
              <div className="font-mono text-[11px] text-ink-dim">
                score {scoreFnName}(state) {"{"} ... {"}"}
              </div>
              <div className="font-mono text-[10px] leading-[1.5] text-ink-faint">
                scores the branches below
              </div>
            </div>
          ) : (
            <div className="font-mono text-[10px] leading-[1.5] text-ink-faint">
              no score block — built-in reward/risk model
            </div>
          )}
        </OutputPanel>

        {/* Branches */}
        <OutputPanel title="Branches" subtitle={engine ? `${engine.branches.length}` : "—"}>
          {engine && engine.branches.length > 0 ? (
            <div className="space-y-1.5">
              {engine.branches.map((b) => (
                <div
                  key={b.id}
                  className="flex items-baseline justify-between font-mono text-[11px]"
                >
                  <span
                    className={
                      b.status === "winner"
                        ? "text-accent-warm"
                        : b.status === "pruned"
                          ? "text-ink-faint"
                          : "text-ink"
                    }
                  >
                    {b.status === "winner" && "✓ "}
                    {b.status === "pruned" && "✕ "}
                    branch_{b.id} · {b.actionName}
                  </span>
                  <span className={b.status === "winner" ? "text-accent-warm" : "text-ink-faint"}>
                    {b.score !== null ? b.score.toFixed(3) : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="font-mono text-[11px] text-ink-faint">
              {engine ? "run fork to branch" : "—"}
            </div>
          )}
        </OutputPanel>
      </div>
    </div>
  );
}

// ---- Output panel ----

function OutputPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
          {title}
        </div>
        {subtitle && <div className="font-mono text-[10px] text-ink-faint">{subtitle}</div>}
      </div>
      <div className="max-h-[180px] overflow-y-auto">{children}</div>
    </div>
  );
}

// ---- JSON view ----

function JsonView({ value }: { value: any }) {
  return (
    <pre className="font-mono text-[11px] leading-[1.6] text-ink-dim">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function stateToView(state: any): any {
  return {
    agent: {
      x: state.robot.x,
      y: state.robot.y,
      armAngle: state.robot.armAngle,
      gripOpen: state.robot.gripOpen,
    },
    world: {
      x: state.object.x,
      y: state.object.y,
      stable: state.object.stable,
      grasped: state.object.grasped,
    },
    context: {
      humanPresent: state.environment.humanPresent,
      wind: state.environment.wind,
      lighting: state.environment.lighting,
    },
  };
}

// ---- Syntax highlighter ----

function Highlight({ source }: { source: string }) {
  const tokens = useMemo(() => tokenizeForHighlight(source), [source]);

  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className={tokenClass(t.type)}>
          {t.value}
        </span>
      ))}
    </>
  );
}

type HLToken = { type: string; value: string };

function tokenizeForHighlight(source: string): HLToken[] {
  const tokens: HLToken[] = [];
  let i = 0;

  while (i < source.length) {
    const c = source[i];

    // whitespace
    if (/[ \t\n\r]/.test(c)) {
      let s = "";
      while (i < source.length && /[ \t\n\r]/.test(source[i])) {
        s += source[i];
        i++;
      }
      tokens.push({ type: "ws", value: s });
      continue;
    }

    // comment
    if (c === "#") {
      let s = "";
      while (i < source.length && source[i] !== "\n") {
        s += source[i];
        i++;
      }
      tokens.push({ type: "comment", value: s });
      continue;
    }

    // string
    if (c === '"' || c === "'") {
      const quote = c;
      let s = c;
      i++;
      while (i < source.length && source[i] !== quote) {
        s += source[i];
        i++;
      }
      if (i < source.length) {
        s += source[i];
        i++;
      }
      tokens.push({ type: "string", value: s });
      continue;
    }

    // number
    if (/[0-9]/.test(c)) {
      let s = "";
      while (i < source.length && /[0-9.]/.test(source[i])) {
        s += source[i];
        i++;
      }
      tokens.push({ type: "number", value: s });
      continue;
    }

    // identifier / keyword
    if (/[a-zA-Z_]/.test(c)) {
      let s = "";
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) {
        s += source[i];
        i++;
      }
      const keywords = new Set([
        "state",
        "action",
        "score",
        "run",
        "fork",
        "evaluate",
        "collapse",
        "with",
        "if",
        "return",
        "clamp",
        "risk",
        "reward",
        "true",
        "false",
      ]);
      tokens.push({
        type: keywords.has(s) ? "keyword" : "ident",
        value: s,
      });
      continue;
    }

    // symbol
    tokens.push({ type: "symbol", value: c });
    i++;
  }

  return tokens;
}

function tokenClass(type: string): string {
  switch (type) {
    case "keyword":
      return "text-chronos";
    case "string":
      return "text-accent-warm";
    case "number":
      return "text-chronos";
    case "comment":
      return "text-ink-faint italic";
    case "symbol":
      return "text-ink-faint";
    case "ident":
      return "text-ink";
    default:
      return "text-ink";
  }
}

// ---- Syntax reference ----

function SyntaxReference() {
  const examples = [
    {
      title: "state",
      desc: "Declare the world the agent sees. Fields are grouped by namespace.",
      code: `state {
  agent.velocity = 68
  agent.days_left = 3
  world.bugs = 7
  world.coverage = "fragile"
  context.stakeholder = "watching"
}`,
    },
    {
      title: "action",
      desc: "Declare a possible future. Each action mutates state and declares risk + reward.",
      code: `action "Refactor first" {
  agent.days_left = 5
  agent.quality = 80
  world.bugs = 2
  world.coverage = "stable"
  risk = 0.2
  reward = 0.6
}`,
    },
    {
      title: "score",
      desc: "A pure function that turns a state into a 0–1 number. The engine picks the highest.",
      code: `score utility(state) {
  base = state.reward - 0.8 * state.risk
  if state.context.stakeholder == "watching" {
    base = base - 0.15
  }
  return clamp(base, 0, 1)
}`,
    },
    {
      title: "run",
      desc: "The pipeline. fork branches, evaluate with a scoring function, collapse to a winner.",
      code: `run {
  fork
  evaluate with utility
  collapse max-utility
}`,
    },
  ];

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
          / syntax reference
        </span>
        <div className="h-px w-10 bg-line" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {examples.map((ex) => (
          <div key={ex.title} className="rounded-xl border border-line bg-bg-soft p-5">
            <div className="flex items-baseline gap-3">
              <code className="font-mono text-sm text-chronos">{ex.title}</code>
              <div className="h-px flex-1 bg-line" />
            </div>
            <p className="mt-2 text-[12px] leading-[1.6] text-ink-dim">{ex.desc}</p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-bg p-3 font-mono text-[11px] leading-[1.6]">
              <code>
                <Highlight source={ex.code} />
              </code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
