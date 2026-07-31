import type { Agent, KnowledgeGraph, Memory, Simulation, Workspace } from "./entities";
import type { CapabilityRegistration, Evaluation, TaskExecution, TaskGraph } from "./task-os";

/** Every persisted Chronos record has a stable identifier. */
export type RepositoryRecord = {
  id: string;
};

export type RepositoryListOptions = {
  limit?: number;
  offset?: number;
};

/**
 * Storage port shared by all Chronos entities. Infrastructure decides whether
 * records live in Supabase, SQLite, or memory; the application only sees this contract.
 */
export interface Repository<T extends RepositoryRecord> {
  get(id: string): Promise<T | null>;
  list(options?: RepositoryListOptions): Promise<T[]>;
  save(record: T): Promise<T>;
  delete(id: string): Promise<void>;
}

/** Serializable scenario action; executable behavior is reconstructed by the runtime. */
export type StoredScenarioAction = {
  id: string;
  name: string;
  description: string;
  risk: number;
  reward: number;
  mutations: Record<string, unknown>;
};

export type StoredScenario = RepositoryRecord & {
  name: string;
  description: string;
  initialState: Record<string, unknown>;
  actions: StoredScenarioAction[];
  createdAt: string;
  updatedAt: string;
};

// Entity-specific ports deliberately inherit the same CRUD contract. This
// makes an adapter interchangeable without coupling domain code to a database.
export interface SimulationRepository extends Repository<Simulation> {}

export interface AgentRepository extends Repository<Agent> {}

export interface MemoryRepository extends Repository<Memory> {}

export interface ScenarioRepository extends Repository<StoredScenario> {}

export interface WorkspaceRepository extends Repository<Workspace> {}

export interface KnowledgeGraphRepository extends Repository<KnowledgeGraph> {}

// Agent OS persistence ports. These let Planner, Runtime, and Evaluator
// services retain state without coupling to a concrete database.
// Ports are contracts only — see createDefaultCapabilityRegistry for the live
// in-process handlers used in beta (not every port is product-wired to Postgres yet).
export interface TaskGraphRepository extends Repository<TaskGraph> {}

export interface CapabilityRepository extends Repository<CapabilityRegistration> {}

export interface TaskExecutionRepository extends Repository<TaskExecution> {}

export interface EvaluationRepository extends Repository<Evaluation> {}

export type ChronosRepositories = {
  simulations: SimulationRepository;
  agents: AgentRepository;
  memories: MemoryRepository;
  scenarios: ScenarioRepository;
  workspaces: WorkspaceRepository;
  knowledgeGraphs: KnowledgeGraphRepository;
  taskGraphs: TaskGraphRepository;
  capabilities: CapabilityRepository;
  executions: TaskExecutionRepository;
  evaluations: EvaluationRepository;
};
