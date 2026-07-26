import type {
  Action,
  BranchStatus,
  CollapseStrategy,
  LogEntry,
  Phase,
  Scenario,
  WorldState,
} from "./types";

export type ConstraintKind = "hard" | "soft";
export type MemoryKind = "observation" | "decision" | "outcome" | "preference";
export type SimulationStatus = "pending" | "running" | "completed" | "failed";

export type ConstraintInput = {
  id: string;
  name: string;
  kind: ConstraintKind;
  description: string;
  weight?: number;
};

/** A rule a decision must respect or should prefer. */
export class Constraint {
  readonly id: string;
  readonly name: string;
  readonly kind: ConstraintKind;
  readonly description: string;
  readonly weight: number;

  constructor(input: ConstraintInput) {
    this.id = input.id;
    this.name = input.name;
    this.kind = input.kind;
    this.description = input.description;
    this.weight = input.weight ?? 1;
  }
}

export type HypothesisInput = {
  id: string;
  name: string;
  description: string;
  action: Action;
  assumptions?: readonly string[];
};

/** A testable claim about what happens if an action is applied. */
export class Hypothesis {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly action: Action;
  readonly assumptions: readonly string[];

  constructor(input: HypothesisInput) {
    this.id = input.id;
    this.name = input.name;
    this.description = input.description;
    this.action = input.action;
    this.assumptions = input.assumptions ?? [];
  }

  static fromAction(action: Action): Hypothesis {
    return new Hypothesis({
      id: action.id,
      name: action.name,
      description: action.description,
      action,
    });
  }
}

export type OutcomeInput = {
  branchId: string;
  score: number;
  reward: number;
  risk: number;
  reason: string;
  evaluatedAt?: number;
};

/** The evaluated result of a single branch. */
export class Outcome {
  readonly branchId: string;
  readonly score: number;
  readonly reward: number;
  readonly risk: number;
  readonly reason: string;
  readonly evaluatedAt: number;

  constructor(input: OutcomeInput) {
    this.branchId = input.branchId;
    this.score = Math.max(0, Math.min(1, input.score));
    this.reward = input.reward;
    this.risk = input.risk;
    this.reason = input.reason;
    this.evaluatedAt = input.evaluatedAt ?? Date.now();
  }
}

export type BranchInput = {
  id: string;
  hypothesis: Hypothesis;
  state: WorldState;
  parentId?: string;
  depth?: number;
  mergedFromIds?: readonly string[];
  status?: BranchStatus;
  outcome?: Outcome | null;
};

/**
 * An isolated possible future. Root branches originate from a timeline;
 * subbranches originate from another branch and retain parent lineage.
 */
export class Branch {
  readonly id: string;
  readonly hypothesis: Hypothesis;
  readonly state: WorldState;
  readonly parentId?: string;
  readonly depth: number;
  readonly mergedFromIds: readonly string[];
  readonly status: BranchStatus;
  readonly outcome: Outcome | null;

  constructor(input: BranchInput) {
    this.id = input.id;
    this.hypothesis = input.hypothesis;
    this.state = input.state;
    this.parentId = input.parentId;
    this.depth = input.depth ?? 0;
    this.mergedFromIds = input.mergedFromIds ?? [];
    this.status = input.status ?? "pending";
    this.outcome = input.outcome ?? null;
  }

  // Compatibility accessors keep presentation code focused on the meaning it already renders.
  get actionId() {
    return this.hypothesis.action.id;
  }

  get actionName() {
    return this.hypothesis.name;
  }

  get risk() {
    return this.outcome?.risk ?? this.hypothesis.action.baseRisk;
  }

  get reward() {
    return this.outcome?.reward ?? this.hypothesis.action.baseReward;
  }

  get score() {
    return this.outcome?.score ?? null;
  }

  get reason() {
    return this.outcome?.reason;
  }

  get isSubbranch() {
    return this.parentId !== undefined;
  }

  get isMerged() {
    return this.mergedFromIds.length > 1;
  }

  subbranch(input: { id: string; hypothesis: Hypothesis; state: WorldState }): Branch {
    return new Branch({
      id: input.id,
      hypothesis: input.hypothesis,
      state: input.state,
      parentId: this.id,
      depth: this.depth + 1,
    });
  }

  withOutcome(outcome: Outcome): Branch {
    return new Branch({ ...this, outcome, status: "evaluated" });
  }

  select(): Branch {
    return new Branch({ ...this, status: "winner" });
  }

  prune(): Branch {
    return new Branch({ ...this, status: "pruned" });
  }

  markMerged(): Branch {
    return new Branch({ ...this, status: "merged" });
  }
}

export type MergeStrategy = "highest-score" | "lowest-risk" | "prefer-target";

export type MergeInput = {
  id: string;
  timelineId: string;
  sourceBranchIds: readonly string[];
  targetBranchId: string;
  strategy: MergeStrategy;
  mergedAt?: number;
};

/**
 * Explicit record of converging compatible branch work without committing the
 * timeline. A merge is reversible in history; collapse is the final decision.
 */
export class Merge {
  readonly id: string;
  readonly timelineId: string;
  readonly sourceBranchIds: readonly string[];
  readonly targetBranchId: string;
  readonly strategy: MergeStrategy;
  readonly mergedAt: number;

  constructor(input: MergeInput) {
    if (input.sourceBranchIds.length < 2) {
      throw new Error("A merge requires at least two source branches.");
    }
    if (!input.sourceBranchIds.includes(input.targetBranchId)) {
      throw new Error("Merge target must be one of the source branches.");
    }
    this.id = input.id;
    this.timelineId = input.timelineId;
    this.sourceBranchIds = input.sourceBranchIds;
    this.targetBranchId = input.targetBranchId;
    this.strategy = input.strategy;
    this.mergedAt = input.mergedAt ?? Date.now();
  }
}

export type CollapseInput = {
  id: string;
  timelineId: string;
  selectedBranchId: string;
  discardedBranchIds: readonly string[];
  strategy: CollapseStrategy;
  collapsedAt?: number;
};

/** Finalizes one branch as canonical state while retaining discarded branches for replay. */
export class Collapse {
  readonly id: string;
  readonly timelineId: string;
  readonly selectedBranchId: string;
  readonly discardedBranchIds: readonly string[];
  readonly strategy: CollapseStrategy;
  readonly collapsedAt: number;

  constructor(input: CollapseInput) {
    if (input.discardedBranchIds.includes(input.selectedBranchId)) {
      throw new Error("A selected branch cannot also be discarded.");
    }
    this.id = input.id;
    this.timelineId = input.timelineId;
    this.selectedBranchId = input.selectedBranchId;
    this.discardedBranchIds = input.discardedBranchIds;
    this.strategy = input.strategy;
    this.collapsedAt = input.collapsedAt ?? Date.now();
  }
}

export type DecisionInput = {
  id: string;
  agentId?: string;
  goal: string;
  strategy: CollapseStrategy;
  constraints?: readonly Constraint[];
  hypothesisIds?: readonly string[];
  createdAt?: number;
};

/** A decision defines the goal, strategy, constraints, and candidate hypotheses for a run. */
export class Decision {
  readonly id: string;
  readonly agentId?: string;
  readonly goal: string;
  readonly strategy: CollapseStrategy;
  readonly constraints: readonly Constraint[];
  readonly hypothesisIds: readonly string[];
  readonly createdAt: number;

  constructor(input: DecisionInput) {
    this.id = input.id;
    this.agentId = input.agentId;
    this.goal = input.goal;
    this.strategy = input.strategy;
    this.constraints = input.constraints ?? [];
    this.hypothesisIds = input.hypothesisIds ?? [];
    this.createdAt = input.createdAt ?? Date.now();
  }

  withHypotheses(hypotheses: readonly Hypothesis[]): Decision {
    return new Decision({
      ...this,
      hypothesisIds: hypotheses.map((hypothesis) => hypothesis.id),
    });
  }
}

/** An immutable, replayable sequence of execution records. */
export class Timeline {
  readonly id: string;
  readonly canonicalState: WorldState;
  readonly events: readonly LogEntry[];
  readonly branchIds: readonly string[];
  readonly merges: readonly Merge[];
  readonly collapses: readonly Collapse[];
  readonly committedBranchId?: string;

  constructor(input: {
    id: string;
    canonicalState: WorldState;
    events?: readonly LogEntry[];
    branchIds?: readonly string[];
    merges?: readonly Merge[];
    collapses?: readonly Collapse[];
    committedBranchId?: string;
  }) {
    this.id = input.id;
    this.canonicalState = input.canonicalState;
    this.events = input.events ?? [];
    this.branchIds = input.branchIds ?? [];
    this.merges = input.merges ?? [];
    this.collapses = input.collapses ?? [];
    this.committedBranchId = input.committedBranchId;
  }

  record(event: LogEntry): Timeline {
    return new Timeline({ ...this, events: [...this.events, event] });
  }

  registerBranches(branches: readonly Branch[]): Timeline {
    return new Timeline({
      ...this,
      branchIds: [...new Set([...this.branchIds, ...branches.map((branch) => branch.id)])],
    });
  }

  recordMerge(merge: Merge): Timeline {
    if (merge.timelineId !== this.id) throw new Error("Merge belongs to another timeline.");
    return new Timeline({ ...this, merges: [...this.merges, merge] });
  }

  commit(branch: Branch, collapse?: Collapse): Timeline {
    return new Timeline({
      ...this,
      canonicalState: branch.state,
      committedBranchId: branch.id,
      collapses: collapse ? [...this.collapses, collapse] : this.collapses,
    });
  }
}

export type SimulationInput = {
  id: string;
  scenarioId: string;
  world: WorldState;
  actions: readonly Action[];
  decision: Decision;
  timeline: Timeline;
  branches?: readonly Branch[];
  phase?: Phase;
  log?: readonly LogEntry[];
  status?: SimulationStatus;
};

/** Aggregate root for one temporal decision run. */
export class Simulation {
  readonly id: string;
  readonly scenarioId: string;
  readonly world: WorldState;
  readonly actions: readonly Action[];
  readonly decision: Decision;
  readonly timeline: Timeline;
  readonly branches: readonly Branch[];
  readonly phase: Phase;
  readonly log: readonly LogEntry[];
  readonly status: SimulationStatus;

  constructor(input: SimulationInput) {
    this.id = input.id;
    this.scenarioId = input.scenarioId;
    this.world = input.world;
    this.actions = input.actions;
    this.decision = input.decision;
    this.timeline = input.timeline;
    this.branches = input.branches ?? [];
    this.phase = input.phase ?? "idle";
    this.log = input.log ?? [];
    this.status = input.status ?? "pending";
  }

  with(input: Partial<SimulationInput>): Simulation {
    return new Simulation({
      id: input.id ?? this.id,
      scenarioId: input.scenarioId ?? this.scenarioId,
      world: input.world ?? this.world,
      actions: input.actions ?? [...this.actions],
      decision: input.decision ?? this.decision,
      timeline: input.timeline ?? this.timeline,
      branches: input.branches ?? [...this.branches],
      phase: input.phase ?? this.phase,
      log: input.log ?? [...this.log],
      status: input.status ?? this.status,
    });
  }

  get winner() {
    return this.branches.find((branch) => branch.status === "winner") ?? null;
  }
}

export type AgentInput = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  icon: "forge" | "oracle" | "atlas";
  narrative: {
    problem: string;
    whatItSimulates: string[];
    stakes: string;
  };
  scenario: Scenario;
};

/** A bounded autonomous decision-maker that supplies a scenario and hypotheses. */
export class Agent {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly accent: string;
  readonly icon: "forge" | "oracle" | "atlas";
  readonly narrative: AgentInput["narrative"];
  readonly scenario: Scenario;

  constructor(input: AgentInput) {
    this.id = input.id;
    this.name = input.name;
    this.tagline = input.tagline;
    this.description = input.description;
    this.accent = input.accent;
    this.icon = input.icon;
    this.narrative = input.narrative;
    this.scenario = input.scenario;
  }
}

export type MemoryInput = {
  id: string;
  agentId: string;
  kind: MemoryKind;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

/** Durable learned context available to future planning cycles. */
export class Memory {
  readonly id: string;
  readonly agentId: string;
  readonly kind: MemoryKind;
  readonly content: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;

  constructor(input: MemoryInput) {
    this.id = input.id;
    this.agentId = input.agentId;
    this.kind = input.kind;
    this.content = input.content;
    this.metadata = input.metadata ?? {};
    this.createdAt = input.createdAt ?? new Date().toISOString();
  }
}

export type KnowledgeGraphEdge = {
  from: string;
  to: string;
  relation: "supports" | "causes" | "contradicts" | "depends_on" | "repeats";
  confidence: number;
};

export type KnowledgeGraphInput = {
  id: string;
  workspaceId: string;
  nodes?: Record<string, unknown>[];
  edges?: KnowledgeGraphEdge[];
  updatedAt?: string;
};

/**
 * A workspace-level graph of causal claims and recurring observations derived
 * from simulations. It makes prior runs useful to future planning cycles.
 */
export class KnowledgeGraph {
  readonly id: string;
  readonly workspaceId: string;
  readonly nodes: readonly Record<string, unknown>[];
  readonly edges: readonly KnowledgeGraphEdge[];
  readonly updatedAt: string;

  constructor(input: KnowledgeGraphInput) {
    this.id = input.id;
    this.workspaceId = input.workspaceId;
    this.nodes = input.nodes ?? [];
    this.edges = input.edges ?? [];
    this.updatedAt = input.updatedAt ?? new Date().toISOString();
  }
}

export type WorkspaceInput = {
  id: string;
  name: string;
  ownerId: string;
  agentIds?: readonly string[];
  simulationIds?: readonly string[];
  knowledgeGraphId?: string;
  createdAt?: string;
  updatedAt?: string;
};

/** The tenant boundary that groups agents, simulations, and durable memory. */
export class Workspace {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly agentIds: readonly string[];
  readonly simulationIds: readonly string[];
  readonly knowledgeGraphId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(input: WorkspaceInput) {
    this.id = input.id;
    this.name = input.name;
    this.ownerId = input.ownerId;
    this.agentIds = input.agentIds ?? [];
    this.simulationIds = input.simulationIds ?? [];
    this.knowledgeGraphId = input.knowledgeGraphId;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.updatedAt = input.updatedAt ?? new Date().toISOString();
  }
}
