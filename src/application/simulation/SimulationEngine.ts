import { StartupLaunchPlanner } from "../planner/StartupLaunchPlanner";
import type { AIPort } from "../../domain/ai/AIPort";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import { simulate, type Path } from "../../domain/chronos/startup-sim";
import type {
  FutureRecord,
  GoalRecord,
  KnowledgeRecord,
  NoteRecord,
  TimelineNodeRecord,
} from "../../domain/workspace/types";

export type SimulationConstraint = {
  id: string;
  text: string;
  kind: "hard" | "soft";
};

export type SimulationTaskStatus = "pending" | "running" | "completed" | "failed";

export type SimulationTask = {
  id: string;
  title: string;
  status: SimulationTaskStatus;
  phase: "plan" | "generate" | "evaluate" | "rank" | "collapse";
};

export type SimulationEngineInput = {
  simulationId: string;
  workspaceId: string;
  goal: GoalRecord | null;
  objective: string;
  knowledge: readonly KnowledgeRecord[];
  notes: readonly NoteRecord[];
  constraints: readonly SimulationConstraint[];
};

export type SimulationEngineOutput = {
  /** Ranked futures (eligible first). Fewer than 5 if catalog is thin. */
  futures: FutureRecord[];
  best: FutureRecord;
  recommendation: string;
  risks: string[];
  confidence: number;
  tasks: SimulationTask[];
  timeline: TimelineNodeRecord[];
  category: string;
  thesis: string;
  plannerTaskTitles: string[];
  /** Honest Monte Carlo sample count from the generator. */
  pathsEvaluated: number;
  /** Strategy archetypes considered. */
  pathArchetypes: number;
  /** Futures removed by hard constraints. */
  disqualifiedCount: number;
};

/** Structured signals parsed from objective + knowledge (not free-form only). */
export type DecisionSignals = {
  runwayMonths: number | null;
  mrr: number | null;
  burnMonthly: number | null;
  bootstrapPreferred: boolean;
  raiseForbidden: boolean;
  raisePreferred: boolean;
  complianceHeavy: boolean;
  growthPressure: boolean;
  corpus: string;
};

/** Postgres `uuid` columns reject demo path ids like `0x8d21`. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function newUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Deterministic-enough fallback for non-browser unit tests without Web Crypto.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Accept only real UUIDs for cloud-persisted rows; regenerate otherwise. */
function asPersistedId(candidate: string | undefined | null): string {
  if (typeof candidate === "string" && UUID_RE.test(candidate.trim())) {
    return candidate.trim();
  }
  return newUuid();
}

/** @deprecated use newUuid / asPersistedId — kept name for call-site clarity */
function id(_prefix?: string) {
  return newUuid();
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function parseNumberNear(corpus: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = corpus.match(re);
    if (!m) continue;
    const raw = m[1]?.replace(/,/g, "");
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Extract decision-relevant quantities and policy flags from free text.
 * Prefer explicit numbers in knowledge over objective alone.
 */
export function extractDecisionSignals(
  objective: string,
  knowledge: readonly KnowledgeRecord[],
  notes: readonly NoteRecord[],
  constraints: readonly SimulationConstraint[]
): DecisionSignals {
  const corpus = [
    objective,
    ...knowledge.map((k) => `${k.title}\n${k.content}`),
    ...notes.map((n) => `${n.title}\n${n.content}`),
    ...constraints.map((c) => c.text),
  ]
    .join("\n")
    .toLowerCase();

  const runwayMonths = parseNumberNear(corpus, [
    /(\d+(?:\.\d+)?)\s*(?:months?|mo)\s*(?:of\s+)?runway/,
    /runway[:\s]+(\d+(?:\.\d+)?)\s*(?:months?|mo)?/,
    /(\d+(?:\.\d+)?)\s*mo(?:nth)?s?\s+runway/,
  ]);

  const mrr = parseNumberNear(corpus, [
    /\$?\s*(\d+(?:\.\d+)?)\s*k\s*mrr/,
    /mrr[:\s]+\$?\s*(\d+(?:\.\d+)?)\s*k/,
    /\$?\s*(\d+(?:\.\d+)?)\s*(?:k\s+)?mrr/,
    /mrr[:\s]+\$?\s*(\d{2,})/,
  ]);
  // Normalize "40k MRR" style (already k) vs raw dollars
  let mrrNorm = mrr;
  if (mrrNorm != null && mrrNorm < 1000 && /k\s*mrr|mrr.*k\b/.test(corpus)) {
    mrrNorm = mrrNorm * 1000;
  }

  const burnMonthly = parseNumberNear(corpus, [
    /burn[:\s]+\$?\s*(\d+(?:\.\d+)?)\s*k/,
    /\$?\s*(\d+(?:\.\d+)?)\s*k\s*(?:\/\s*mo(?:nth)?|per\s+month)?\s*burn/,
    /monthly\s+burn[:\s]+\$?\s*(\d+(?:\.\d+)?)/,
  ]);
  let burnNorm = burnMonthly;
  if (burnNorm != null && burnNorm < 1000 && /k.*burn|burn.*k\b/.test(corpus)) {
    burnNorm = burnNorm * 1000;
  }

  const raiseForbidden =
    constraints.some(
      (c) =>
        c.kind === "hard" &&
        /(no\s+raise|bootstrap|no\s+funding|no\s+seed|without\s+raising)/i.test(c.text)
    ) || /(bootstrap|no\s+raise|without\s+funding)/i.test(objective);

  const bootstrapPreferred =
    raiseForbidden ||
    constraints.some((c) => /bootstrap|self[- ]fund/i.test(c.text)) ||
    /bootstrap|self[- ]fund/i.test(corpus);

  const raisePreferred =
    !raiseForbidden &&
    (/(raise|seed|series\s*[abc]|fundraise)/i.test(objective) ||
      constraints.some((c) => /raise|fund/i.test(c.text) && c.kind === "soft"));

  const complianceHeavy =
    constraints.some((c) =>
      /(hipaa|soc\s*2|compliance|gdpr|security|legal|regulated)/i.test(c.text)
    ) || /(hipaa|soc\s*2|compliance|gdpr)/i.test(corpus);

  const growthPressure =
    /(aggressive|fast|scale|capture|win\s+the\s+market|blitz)/i.test(corpus) ||
    constraints.some((c) => /growth|scale|speed/i.test(c.text));

  return {
    runwayMonths,
    mrr: mrrNorm,
    burnMonthly: burnNorm,
    bootstrapPreferred,
    raiseForbidden,
    raisePreferred,
    complianceHeavy,
    growthPressure,
    corpus,
  };
}

function pathText(path: Path): string {
  return `${path.name} ${path.thesis} ${path.highlights.join(" ")} ${path.risks.join(" ")}`.toLowerCase();
}

function isRaiseHeavyPath(path: Path): boolean {
  return /(fund|raise|series|venture|dilution|enterprise\s+sales|top-down)/i.test(pathText(path));
}

function isAggressivePath(path: Path): boolean {
  return (
    /(aggressive|scale|blitz|subsid|capital-intensive|top-down)/i.test(pathText(path)) ||
    path.burn > 90000
  );
}

function isConservativePath(path: Path): boolean {
  return /(conserv|hold|bootstrap|bottom-up|wedge|hunker|extend\s+runway)/i.test(pathText(path));
}

/**
 * Chronos Simulation Engine — product decision loop.
 *
 * Pipeline:
 *   Planner → Generate (MC samples) → Evaluate (EV + hard constraints) → Rank → Collapse
 *
 * Hard constraints disqualify futures. Soft constraints adjust score.
 * Scores use path economics (probability, ARR, LTV/CAC, burn) + workspace signals.
 */
export class SimulationEngine {
  /**
   * @param planner Task decomposition
   * @param ai Provider-agnostic port (default pure Noop).
   *           Product path does not call AI yet — keeps sims deterministic.
   *           Composition roots may inject `createAIPortFromEnv()` for Ollama etc.
   */
  constructor(
    private readonly planner = new StartupLaunchPlanner(),
    private readonly ai: AIPort = new NoopAIProvider()
  ) {}

  /** Exposed for future enrich paths / tests — not used in default run(). */
  getAIPort(): AIPort {
    return this.ai;
  }

  run(input: SimulationEngineInput): SimulationEngineOutput {
    const tasks = this.createTaskShell();
    const objective = input.objective.trim();
    if (!objective) {
      return this.fail(input.simulationId, tasks, "Objective is required.");
    }

    try {
      const signals = extractDecisionSignals(
        objective,
        input.knowledge,
        input.notes,
        input.constraints
      );

      // 1. Planner
      this.setTask(tasks, "plan", "running");
      const plan = this.planner.decompose({
        workspaceId: input.workspaceId,
        decisionId: input.simulationId,
        prompt: this.buildPlannerPrompt(input, objective, signals),
      });
      const plannerTaskTitles = plan.tasks.map((t) => t.title);
      this.setTask(tasks, "plan", "completed");

      // 2. Generate futures (honest Monte Carlo over archetypes)
      this.setTask(tasks, "generate", "running");
      const corpus = this.buildCorpus(input, objective);
      const raw = simulate(corpus, { sampleBudget: 64 });
      const generated = this.expandCandidates(raw.bestPath, raw.alternatives, corpus, signals);
      this.setTask(tasks, "generate", "completed");

      // 3. Evaluate (hard constraints disqualify; soft + EV score)
      this.setTask(tasks, "evaluate", "running");
      const evaluated = generated.map((path) =>
        this.evaluatePath(path, input, objective, signals)
      );
      this.setTask(tasks, "evaluate", "completed");

      // 4. Rank: eligible by score, then ineligible
      this.setTask(tasks, "rank", "running");
      const eligible = evaluated.filter((f) => f.score > 0);
      const ineligible = evaluated.filter((f) => f.score <= 0);
      const rankedEligible = [...eligible].sort(
        (a, b) => b.score - a.score || b.confidence - a.confidence || a.name.localeCompare(b.name)
      );
      const rankedIneligible = [...ineligible].sort((a, b) => a.name.localeCompare(b.name));
      const futures = [...rankedEligible, ...rankedIneligible].slice(0, 5).map((f) => ({
        ...f,
        // Re-assert UUID: never ship startup-sim `0x…` or `var-…` ids to Supabase.
        id: asPersistedId(f.id),
        simulation_id: input.simulationId,
      }));
      this.setTask(tasks, "rank", "completed");

      // 5. Collapse → best eligible future (never recommend a disqualified path)
      this.setTask(tasks, "collapse", "running");
      const best = rankedEligible[0] ?? futures[0];
      if (!best) {
        return this.fail(input.simulationId, tasks, "No futures generated.");
      }
      if (best.score <= 0 && rankedEligible.length === 0) {
        return this.fail(
          input.simulationId,
          tasks,
          "All futures violated hard constraints. Relax constraints or reframe the objective."
        );
      }
      const risks = this.collectRisks(best, raw.bestPath, input.constraints, signals, ineligible.length);
      const recommendation = this.buildRecommendation(best, input, risks, signals);
      const timeline = this.buildTimeline(input.simulationId, objective, futures, plannerTaskTitles);
      this.setTask(tasks, "collapse", "completed");

      return {
        futures,
        best,
        recommendation,
        risks,
        confidence: best.confidence,
        tasks,
        timeline,
        category: raw.categoryLabel,
        thesis: best.summary,
        plannerTaskTitles,
        pathsEvaluated: raw.pathsEvaluated,
        pathArchetypes: raw.totalPaths,
        disqualifiedCount: ineligible.length,
      };
    } catch (err) {
      return this.fail(input.simulationId, tasks, (err as Error).message);
    }
  }

  private createTaskShell(): SimulationTask[] {
    return [
      { id: "plan", title: "Understanding goal", status: "pending", phase: "plan" },
      {
        id: "generate",
        title: "Generating candidate futures",
        status: "pending",
        phase: "generate",
      },
      {
        id: "evaluate",
        title: "Evaluating trade-offs",
        status: "pending",
        phase: "evaluate",
      },
      { id: "rank", title: "Ranking outcomes", status: "pending", phase: "rank" },
      {
        id: "collapse",
        title: "Preparing decision report",
        status: "pending",
        phase: "collapse",
      },
    ];
  }

  private setTask(tasks: SimulationTask[], taskId: string, status: SimulationTaskStatus) {
    const task = tasks.find((t) => t.id === taskId);
    if (task) task.status = status;
  }

  private fail(
    simulationId: string,
    tasks: SimulationTask[],
    message: string
  ): SimulationEngineOutput {
    const running = tasks.find((t) => t.status === "running");
    if (running) running.status = "failed";
    for (const t of tasks) {
      if (t.status === "pending") t.status = "failed";
    }
    const empty: FutureRecord = {
      id: id("future"),
      simulation_id: simulationId,
      name: "Failed run",
      score: 0,
      risk: 1,
      confidence: 0,
      summary: message,
    };
    return {
      futures: [empty],
      best: empty,
      recommendation: message,
      risks: [message],
      confidence: 0,
      tasks,
      timeline: [],
      category: "error",
      thesis: message,
      plannerTaskTitles: [],
      pathsEvaluated: 0,
      pathArchetypes: 0,
      disqualifiedCount: 0,
    };
  }

  private buildPlannerPrompt(
    input: SimulationEngineInput,
    objective: string,
    signals: DecisionSignals
  ): string {
    const goal = input.goal?.title ?? objective;
    const knowledge = input.knowledge.map((k) => k.title).slice(0, 12).join("; ");
    const constraints = input.constraints.map((c) => `${c.kind}:${c.text}`).join("; ");
    const signalLine = [
      signals.runwayMonths != null ? `runway=${signals.runwayMonths}mo` : "",
      signals.mrr != null ? `mrr=${signals.mrr}` : "",
      signals.burnMonthly != null ? `burn=${signals.burnMonthly}` : "",
      signals.raiseForbidden ? "policy=no-raise" : "",
      signals.bootstrapPreferred ? "policy=bootstrap" : "",
      signals.complianceHeavy ? "policy=compliance" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return [
      `Goal: ${goal}`,
      `Objective: ${objective}`,
      knowledge ? `Knowledge: ${knowledge}` : "",
      constraints ? `Constraints: ${constraints}` : "",
      signalLine ? `Signals: ${signalLine}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  private buildCorpus(input: SimulationEngineInput, objective: string): string {
    return [
      input.goal?.title,
      input.goal?.description,
      objective,
      ...input.knowledge.map((k) => `${k.type}: ${k.title}\n${k.content.slice(0, 400)}`),
      ...input.notes.map((n) => `note: ${n.title}\n${n.content.slice(0, 400)}`),
      ...input.constraints.map((c) => `constraint(${c.kind}): ${c.text}`),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  /**
   * Build up to 5 distinct strategy candidates from MC best + alts +
   * signal-aware variants (not generic fillers that ignore constraints).
   */
  private expandCandidates(
    best: Path,
    alternatives: Path[],
    corpus: string,
    signals: DecisionSignals
  ): Path[] {
    const seed = hash(corpus);
    const pool: Path[] = [best, ...alternatives];

    if (signals.bootstrapPreferred || signals.raiseForbidden) {
      pool.push({
        id: `var-${seed.toString(16)}-boot`,
        name: "Bootstrap wedge",
        thesis:
          "Stay capital-efficient; ship a narrow wedge, price early, and extend runway without a raise.",
        milestones: best.milestones,
        arr: best.arr * 0.75,
        probability: Math.min(0.35, best.probability * 1.15),
        monthsToPmf: best.monthsToPmf + 2,
        cac: best.cac * 0.85,
        ltv: best.ltv * 0.9,
        burn: best.burn * 0.65,
        highlights: ["No dilution", "Runway-first", "Founder-led sales"],
        risks: ["Slower capture", "Hiring constrained"],
      });
    }

    if (!signals.raiseForbidden && (signals.raisePreferred || signals.growthPressure)) {
      pool.push({
        id: `var-${seed.toString(16)}-raise`,
        name: "Capitalized scale",
        thesis:
          "Raise to fund GTM and product depth; trade dilution for speed and category presence.",
        milestones: best.milestones,
        arr: best.arr * 1.25,
        probability: Math.max(0.04, best.probability * 0.8),
        monthsToPmf: Math.max(3, best.monthsToPmf - 1),
        cac: best.cac * 1.15,
        ltv: best.ltv * 1.1,
        burn: best.burn * 1.45,
        highlights: ["Speed", "Hire ahead of revenue"],
        risks: ["Dilution", "Execution overload", "Higher burn"],
      });
    }

    if (signals.complianceHeavy) {
      pool.push({
        id: `var-${seed.toString(16)}-comp`,
        name: "Compliance-first path",
        thesis:
          "Sequence trust and certifications before aggressive GTM; slower start, higher close rates in regulated buyers.",
        milestones: best.milestones,
        arr: best.arr * 0.85,
        probability: Math.min(0.4, best.probability * 1.05),
        monthsToPmf: best.monthsToPmf + 3,
        cac: best.cac * 0.95,
        ltv: best.ltv * 1.15,
        burn: best.burn * 0.9,
        highlights: ["Enterprise trust", "Lower churn risk"],
        risks: ["Longer sales cycle", "Upfront compliance cost"],
      });
    }

    // Conservative hold only when not growth-forced and not already bootstrap-only catalog
    if (!signals.growthPressure) {
      pool.push({
        id: `var-${seed.toString(16)}-hold`,
        name: "Conservative hold",
        thesis: "Preserve optionality; delay irreversible commitments until signal quality improves.",
        milestones: best.milestones,
        arr: best.arr * 0.65,
        probability: Math.max(0.08, best.probability * 0.9),
        monthsToPmf: best.monthsToPmf + 4,
        cac: best.cac,
        ltv: best.ltv * 0.85,
        burn: best.burn * 0.7,
        highlights: ["Lower burn", "Option value"],
        risks: ["Missed window", "Competitor fills gap"],
      });
    }

    const seen = new Set<string>();
    const out: Path[] = [];
    for (const p of pool) {
      const key = p.name.toLowerCase();
      if (seen.has(key)) continue;
      // Drop raise-heavy variants when raise is forbidden before evaluation ranks them
      if (signals.raiseForbidden && isRaiseHeavyPath(p) && !isConservativePath(p) && !/bootstrap/i.test(p.name)) {
        // still include so evaluation can mark infeasible and explain — keep 1 raise path for transparency
        if ([...seen].some((s) => /raise|fund|capitalized|series|top-down/i.test(s))) continue;
      }
      seen.add(key);
      out.push(p);
      if (out.length >= 5) break;
    }
    return out;
  }

  private hardConstraintViolations(
    path: Path,
    constraints: readonly SimulationConstraint[],
    signals: DecisionSignals
  ): string[] {
    const violations: string[] = [];
    const text = pathText(path);

    for (const c of constraints.filter((x) => x.kind === "hard")) {
      const ct = c.text.toLowerCase();

      if (
        /(no\s+raise|bootstrap|no\s+funding|no\s+seed)/i.test(ct) &&
        isRaiseHeavyPath(path)
      ) {
        violations.push(`Hard constraint violated: ${c.text}`);
      }

      if (
        /(budget|runway|cash|capital)/i.test(ct) &&
        isAggressivePath(path) &&
        (signals.runwayMonths != null ? signals.runwayMonths < 10 : true)
      ) {
        // If user named a runway floor, enforce burn vs runway
        if (/(12|twelve)\s*month/i.test(ct) && path.burn > 0) {
          const impliedRunway =
            signals.mrr != null && signals.mrr > 0
              ? // rough cash proxy: treat mrr*runway as buffer; high burn paths need more
                (signals.runwayMonths ?? 12) * (signals.mrr / path.burn)
              : signals.runwayMonths ?? 12;
          if (impliedRunway < 10 || path.burn > 100000) {
            violations.push(`Hard constraint violated: ${c.text} (path burn too high)`);
          }
        } else if (isAggressivePath(path) && /must|keep|require/i.test(ct)) {
          violations.push(`Hard constraint violated: ${c.text}`);
        }
      }

      if (
        /(compliance|hipaa|security|legal|soc\s*2|gdpr)/i.test(ct) &&
        isAggressivePath(path) &&
        !/(compliance|trust|hipaa|soc)/i.test(text)
      ) {
        violations.push(`Hard constraint violated: ${c.text} (aggressive path skips compliance sequencing)`);
      }
    }

    // Signal-level hard policy even without explicit constraint text
    if (signals.raiseForbidden && isRaiseHeavyPath(path) && !/bootstrap|wedge|bottom-up|conserv/i.test(text)) {
      if (!violations.some((v) => /raise|fund/i.test(v))) {
        violations.push("Hard policy: raise/funding path incompatible with bootstrap constraints");
      }
    }

    return [...new Set(violations)];
  }

  private evaluatePath(
    path: Path,
    input: SimulationEngineInput,
    objective: string,
    signals: DecisionSignals
  ): FutureRecord {
    const name = path.name ?? "Future";
    const thesis = path.thesis ?? "";
    const probability = typeof path.probability === "number" ? path.probability : 0.1;
    const violations = this.hardConstraintViolations(path, input.constraints, signals);

    if (violations.length > 0) {
      return {
        id: asPersistedId(path.id),
        simulation_id: input.simulationId,
        name,
        score: 0,
        risk: 1,
        confidence: 0.05,
        summary: `Infeasible under hard constraints. ${thesis} (${violations[0]})`,
      };
    }

    // Economics-based EV score (normalized)
    const arrFactor = clamp01(path.arr / 3_000_000);
    const ltvCac = path.ltv / Math.max(path.cac, 1);
    const unitEcon = clamp01(ltvCac / 12);
    const burnPressure = clamp01(path.burn / 150_000);
    const speed = clamp01(1 - (path.monthsToPmf - 3) / 18);

    let score =
      probability * 0.4 + arrFactor * 0.25 + unitEcon * 0.15 + speed * 0.1 + (1 - burnPressure) * 0.1;
    let risk = clamp01(1 - probability + burnPressure * 0.25);
    let conf = clamp01(probability + unitEcon * 0.15);

    // Workspace signals
    if (signals.runwayMonths != null && signals.runwayMonths < 9 && isAggressivePath(path)) {
      score = clamp01(score - 0.12);
      risk = clamp01(risk + 0.1);
    }
    if (signals.runwayMonths != null && signals.runwayMonths >= 14 && isConservativePath(path)) {
      // Deep runway: optionality paths are fine but don't dominate growth
      score = clamp01(score - 0.03);
    }
    if (signals.bootstrapPreferred && (isConservativePath(path) || /bootstrap|wedge|bottom-up/i.test(name))) {
      score = clamp01(score + 0.08);
      conf = clamp01(conf + 0.05);
    }
    if (signals.raisePreferred && isRaiseHeavyPath(path)) {
      score = clamp01(score + 0.05);
    }
    if (signals.complianceHeavy && /compliance|trust|hipaa|enterprise/i.test(pathText(path))) {
      score = clamp01(score + 0.06);
      conf = clamp01(conf + 0.04);
    }
    if (signals.mrr != null && signals.mrr > 0 && path.arr > 0) {
      // Prefer paths whose ARR scale is plausible vs current MRR (not 100× overnight without capital)
      const mrrArr = signals.mrr * 12;
      const multiple = path.arr / mrrArr;
      if (multiple > 40 && !isRaiseHeavyPath(path)) {
        score = clamp01(score - 0.06);
        conf = clamp01(conf - 0.05);
      }
    }

    // Soft constraints: penalize mismatch, never zero
    for (const c of input.constraints.filter((x) => x.kind === "soft")) {
      const token = c.text.toLowerCase().slice(0, 32).trim();
      const hay = `${name} ${thesis} ${objective}`.toLowerCase();
      if (token.length >= 4 && !hay.includes(token.slice(0, Math.min(12, token.length)))) {
        // Semantic soft matches
        if (/(runway|bootstrap|raise|enterprise|compliance)/i.test(token)) {
          const wantsBootstrap = /bootstrap|runway/i.test(token);
          const wantsRaise = /raise|fund/i.test(token);
          if (wantsBootstrap && isAggressivePath(path)) {
            score = clamp01(score - 0.05);
          }
          if (wantsRaise && isConservativePath(path)) {
            score = clamp01(score - 0.04);
          }
        } else {
          score = clamp01(score - 0.03);
          conf = clamp01(conf - 0.02);
        }
      }
    }

    // Knowledge title overlap small boost
    const titleCorpus = input.knowledge.map((item) => item.title.toLowerCase()).join(" ");
    if (
      titleCorpus &&
      name
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.length > 4 && titleCorpus.includes(word))
    ) {
      score = clamp01(score + 0.03);
      conf = clamp01(conf + 0.02);
    }

    return {
      id: asPersistedId(path.id),
      simulation_id: input.simulationId,
      name,
      score: Math.round(score * 1000) / 1000,
      risk: Math.round(risk * 1000) / 1000,
      confidence: Math.round(conf * 1000) / 1000,
      summary: thesis,
    };
  }

  private collectRisks(
    best: FutureRecord,
    bestPath: Path,
    constraints: readonly SimulationConstraint[],
    signals: DecisionSignals,
    disqualifiedCount: number
  ): string[] {
    const risks = [...(bestPath.risks ?? [])];
    if (best.risk >= 0.55) risks.push("Elevated execution risk relative to confidence.");
    for (const c of constraints.filter((x) => x.kind === "hard")) {
      risks.push(`Hard constraint in force: ${c.text}`);
    }
    if (disqualifiedCount > 0) {
      risks.push(`${disqualifiedCount} path(s) disqualified by hard constraints.`);
    }
    if (signals.runwayMonths != null && signals.runwayMonths < 9) {
      risks.push(`Short runway signal (~${signals.runwayMonths} months) limits aggressive paths.`);
    }
    return [...new Set(risks)].slice(0, 8);
  }

  private buildRecommendation(
    best: FutureRecord,
    input: SimulationEngineInput,
    risks: string[],
    signals: DecisionSignals
  ): string {
    const goal = input.goal?.title ?? input.objective;
    const riskNote = risks[0] ? ` Watch: ${risks[0]}` : "";
    const policy =
      signals.raiseForbidden
        ? " (raise disallowed)"
        : signals.bootstrapPreferred
          ? " (bootstrap-biased)"
          : "";
    return `Best path for “${goal}”${policy}: ${best.name}. ${best.summary}${riskNote}`;
  }

  private buildTimeline(
    simulationId: string,
    objective: string,
    futures: FutureRecord[],
    plannerTasks: string[]
  ): TimelineNodeRecord[] {
    const rootId = id("node");
    const nodes: TimelineNodeRecord[] = [
      {
        id: rootId,
        simulation_id: simulationId,
        parent_id: null,
        title: `Objective: ${objective}`,
        depth: 0,
        score: 1,
      },
    ];
    let parent = rootId;
    for (const [index, title] of plannerTasks.slice(0, 4).entries()) {
      const nodeId = id("node");
      nodes.push({
        id: nodeId,
        simulation_id: simulationId,
        parent_id: parent,
        title: `Plan: ${title}`,
        depth: index + 1,
        score: 1 - index * 0.05,
      });
      parent = nodeId;
    }
    for (const [index, future] of futures.entries()) {
      nodes.push({
        id: id("node"),
        simulation_id: simulationId,
        parent_id: rootId,
        title: `${index === 0 ? "★ " : future.score <= 0 ? "✕ " : ""}${future.name}`,
        depth: 1,
        score: future.score,
      });
    }
    return nodes;
  }
}

export const simulationEngine = new SimulationEngine();
