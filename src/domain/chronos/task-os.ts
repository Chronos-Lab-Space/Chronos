/**
 * Chronos Agent Operating System domain model.
 *
 * The Temporal Engine operates on tasks. Named agents are external capability
 * providers that register task handlers; they never become part of engine state.
 */

export type TaskKind =
  | "plan"
  | "research.competitors"
  | "market.estimate"
  | "roadmap.build"
  | "adoption.predict"
  | "financial.simulate"
  | "risk.analyze"
  | "scenario.generate"
  | "branch.generate"
  | "simulation.execute"
  | "outcome.evaluate"
  | "timeline.rank"
  | "memory.write";

export type TaskStatus = "queued" | "scheduled" | "running" | "completed" | "failed" | "skipped";

export type TaskInput = {
  id: string;
  kind: TaskKind;
  title: string;
  capability: string;
  input: Record<string, unknown>;
  dependencies?: readonly string[];
  priority?: number;
  status?: TaskStatus;
};

/** An atomic unit of work. The temporal engine schedules tasks, never agents. */
export class Task {
  readonly id: string;
  readonly kind: TaskKind;
  readonly title: string;
  readonly capability: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly dependencies: readonly string[];
  readonly priority: number;
  readonly status: TaskStatus;

  constructor(input: TaskInput) {
    this.id = input.id;
    this.kind = input.kind;
    this.title = input.title;
    this.capability = input.capability;
    this.input = input.input;
    this.dependencies = input.dependencies ?? [];
    this.priority = input.priority ?? 0;
    this.status = input.status ?? "queued";
  }

  withStatus(status: TaskStatus): Task {
    return new Task({ ...this, status });
  }
}

export type TaskGraphInput = {
  id: string;
  workspaceId: string;
  decisionId: string;
  tasks: readonly Task[];
  createdAt?: string;
};

/** A validated DAG defining all work required to reach a temporal decision. */
export class TaskGraph {
  readonly id: string;
  readonly workspaceId: string;
  readonly decisionId: string;
  readonly tasks: readonly Task[];
  readonly createdAt: string;

  constructor(input: TaskGraphInput) {
    this.id = input.id;
    this.workspaceId = input.workspaceId;
    this.decisionId = input.decisionId;
    this.tasks = input.tasks;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.assertValid();
  }

  readyTasks(completedTaskIds: ReadonlySet<string>): Task[] {
    return this.tasks
      .filter((task) => task.status === "queued")
      .filter((task) => !completedTaskIds.has(task.id))
      .filter((task) => task.dependencies.every((dependency) => completedTaskIds.has(dependency)))
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  withTask(task: Task): TaskGraph {
    return new TaskGraph({
      ...this,
      tasks: this.tasks.map((existing) => (existing.id === task.id ? task : existing)),
    });
  }

  private assertValid() {
    const ids = new Set<string>();
    for (const task of this.tasks) {
      if (ids.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
      ids.add(task.id);
    }
    for (const task of this.tasks) {
      for (const dependency of task.dependencies) {
        if (!ids.has(dependency)) {
          throw new Error(`Task ${task.id} depends on unknown task: ${dependency}`);
        }
      }
    }
    this.assertAcyclic();
  }

  private assertAcyclic() {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const byId = new Map(this.tasks.map((task) => [task.id, task]));

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error(`Task graph cycle detected at: ${id}`);
      visiting.add(id);
      for (const dependency of byId.get(id)?.dependencies ?? []) visit(dependency);
      visiting.delete(id);
      visited.add(id);
    };

    for (const task of this.tasks) visit(task.id);
  }
}

export type CapabilityRegistrationInput = {
  id: string;
  providerId: string;
  name: string;
  version: string;
  taskKinds: readonly TaskKind[];
  capabilityKeys?: readonly string[];
  description: string;
};

/** An external agent registers capabilities; the engine only resolves tasks to these contracts. */
export class CapabilityRegistration {
  readonly id: string;
  readonly providerId: string;
  readonly name: string;
  readonly version: string;
  readonly taskKinds: readonly TaskKind[];
  readonly capabilityKeys: readonly string[];
  readonly description: string;

  constructor(input: CapabilityRegistrationInput) {
    this.id = input.id;
    this.providerId = input.providerId;
    this.name = input.name;
    this.version = input.version;
    this.taskKinds = input.taskKinds;
    this.capabilityKeys = input.capabilityKeys ?? [];
    this.description = input.description;
  }

  supports(kind: TaskKind): boolean {
    return this.taskKinds.includes(kind);
  }

  supportsTask(task: Task): boolean {
    return (
      this.supports(task.kind) &&
      (this.capabilityKeys.length === 0 || this.capabilityKeys.includes(task.capability))
    );
  }
}

export type TaskExecutionInput = {
  id: string;
  taskId: string;
  capabilityId: string;
  status: Extract<TaskStatus, "running" | "completed" | "failed">;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

/** Immutable execution record emitted by the runtime. */
export class TaskExecution {
  readonly id: string;
  readonly taskId: string;
  readonly capabilityId: string;
  readonly status: TaskExecutionInput["status"];
  readonly output: Readonly<Record<string, unknown>>;
  readonly error?: string;
  readonly startedAt: string;
  readonly completedAt?: string;

  constructor(input: TaskExecutionInput) {
    this.id = input.id;
    this.taskId = input.taskId;
    this.capabilityId = input.capabilityId;
    this.status = input.status;
    this.output = input.output ?? {};
    this.error = input.error;
    this.startedAt = input.startedAt ?? new Date().toISOString();
    this.completedAt = input.completedAt;
  }
}

export type EvaluationInput = {
  id: string;
  executionId: string;
  score: number;
  confidence: number;
  rationale: string;
  policyCompliant: boolean;
};

/** Evaluation is separate from execution so ranking can compare heterogeneous tasks. */
export class Evaluation {
  readonly id: string;
  readonly executionId: string;
  readonly score: number;
  readonly confidence: number;
  readonly rationale: string;
  readonly policyCompliant: boolean;

  constructor(input: EvaluationInput) {
    this.id = input.id;
    this.executionId = input.executionId;
    this.score = Math.max(0, Math.min(1, input.score));
    this.confidence = Math.max(0, Math.min(1, input.confidence));
    this.rationale = input.rationale;
    this.policyCompliant = input.policyCompliant;
  }
}

export type RankedTimeline = {
  timelineId: string;
  score: number;
  rank: number;
  evaluationIds: readonly string[];
};

/** Sorts evaluated timelines into an explainable decision order. */
export class TimelineRanking {
  static rank(entries: readonly Omit<RankedTimeline, "rank">[]): RankedTimeline[] {
    return [...entries]
      .sort(
        (left, right) => right.score - left.score || left.timelineId.localeCompare(right.timelineId)
      )
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }
}
