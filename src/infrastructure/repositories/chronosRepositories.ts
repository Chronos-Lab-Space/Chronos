import type {
  AgentRepository,
  ChronosRepositories,
  MemoryRepository as MemoryRepositoryPort,
  KnowledgeGraphRepository,
  TaskGraphRepository,
  CapabilityRepository,
  TaskExecutionRepository,
  EvaluationRepository,
  ScenarioRepository,
  SimulationRepository,
  WorkspaceRepository,
} from "../../domain/chronos/repositories";
import { supabase } from "../supabase/client";
import { MemoryRepository } from "./MemoryRepository";
import { SupabaseRepository } from "./SupabaseRepository";

/**
 * Selects a repository implementation at the composition root. Swap this
 * factory when Chronos runs locally with SQLite, in a browser with memory, or
 * remotely with Supabase; application code remains unchanged.
 */
export function createInMemoryChronosRepositories(): ChronosRepositories {
  return {
    simulations: new MemoryRepository() as SimulationRepository,
    agents: new MemoryRepository() as AgentRepository,
    memories: new MemoryRepository() as MemoryRepositoryPort,
    scenarios: new MemoryRepository() as ScenarioRepository,
    workspaces: new MemoryRepository() as WorkspaceRepository,
    knowledgeGraphs: new MemoryRepository() as KnowledgeGraphRepository,
    taskGraphs: new MemoryRepository() as TaskGraphRepository,
    capabilities: new MemoryRepository() as CapabilityRepository,
    executions: new MemoryRepository() as TaskExecutionRepository,
    evaluations: new MemoryRepository() as EvaluationRepository,
  };
}

export function createSupabaseChronosRepositories(): ChronosRepositories {
  return {
    simulations: new SupabaseRepository(supabase, "simulations") as SimulationRepository,
    agents: new SupabaseRepository(supabase, "agents") as AgentRepository,
    memories: new SupabaseRepository(supabase, "memories") as MemoryRepositoryPort,
    scenarios: new SupabaseRepository(supabase, "scenarios") as ScenarioRepository,
    workspaces: new SupabaseRepository(supabase, "workspaces") as WorkspaceRepository,
    knowledgeGraphs: new SupabaseRepository(
      supabase,
      "knowledge_graphs"
    ) as KnowledgeGraphRepository,
    taskGraphs: new SupabaseRepository(supabase, "task_graphs") as TaskGraphRepository,
    capabilities: new SupabaseRepository(supabase, "capabilities") as CapabilityRepository,
    executions: new SupabaseRepository(supabase, "task_executions") as TaskExecutionRepository,
    evaluations: new SupabaseRepository(supabase, "evaluations") as EvaluationRepository,
  };
}
