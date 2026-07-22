# Chronos Frontend Architecture

The project follows a lightweight Clean Architecture layout. It keeps temporal
decision rules independent from React, Supabase, routing, and rendering.

## Product surfaces (logical split — not a monorepo move yet)

Treat Chronos as three products under one tree when choosing where to change code:

```text
app/        → presentation/features/* (Workspace HQ, dashboard, onboarding, reports UI)
engine/     → application/simulation + application/chronos + domain/chronos (sim, evaluate, timeline)
platform/   → infrastructure/* + .agents/skills + APIs/SDK later
```

Evolve the **engine** without UI churn; evolve the **app** without rewiring scoring.
Do not add new domains until Decision Report · Pulse · Comparison · History · Onboarding feel finished.

```text
src/
├── domain/
│   └── chronos/
│       ├── types.ts          # Core entities and value types
│       ├── agents.ts         # Agent world-model definitions
│       ├── scenarios.ts      # Reusable domain scenarios
│       ├── startup-sim.ts    # Deterministic startup simulation model
│       └── language.ts       # Chronos language parser and compiler
├── application/
│   └── chronos/
│       └── engine.ts         # fork / evaluate / collapse use cases
├── infrastructure/
│   ├── supabase/
│   │   └── client.ts         # Supabase bootstrap and configuration only
│   ├── repositories/         # Supabase, SQLite, and in-memory persistence adapters
│   ├── auth/                 # Supabase Auth boundary
│   ├── storage/              # Supabase Storage boundary
│   └── queries/              # Read models and analytics query helpers
├── presentation/
│   ├── App.tsx               # Router and presentation composition root
│   ├── components/           # React UI components and dashboard views
│   └── pages/                # Route-level page compositions
├── main.tsx                  # Browser bootstrap
└── index.css                 # Global styles and visual motion
```

## Dependency rules

```text
presentation  -> application -> domain
presentation  -> infrastructure
infrastructure -> domain
domain         -> nothing outside domain
```

- **Domain** describes what Chronos is: world state, branches, actions,
  scenarios, agents, and the Chronos language. It must not import React,
  Supabase, or browser APIs.
- **Application** describes what Chronos does: fork a state, evaluate futures,
  collapse the winning path, reset a run. It depends only on domain types.
- **Infrastructure** implements external concerns such as Supabase, browser
  persistence, authentication, object storage, read queries, and future API clients.
- **Presentation** renders the UI and coordinates user interactions. It may
  invoke application use cases and infrastructure adapters, but it owns no
  temporal decision rules.

## Supabase Boundaries

The former all-in-one Supabase module has been split by responsibility:

```text
infrastructure/
├── supabase/client.ts
│   └── Client creation and environment configuration only
├── repositories/
│   ├── SupabaseRepository.ts
│   └── SupabaseAccessRequestRepository.ts
├── auth/SupabaseAuthService.ts
├── storage/SupabaseStorageService.ts
└── queries/
    ├── SupabaseAnalyticsQueries.ts
    └── SupabaseSimulationQueries.ts
```

This division prevents React components from knowing table names, storage
buckets, authentication SDK methods, or analytics schemas. Presentation calls
the appropriate adapter; adapters call the Supabase client.

## Adding a feature

1. Add entities/value types in `src/domain/chronos` if the feature changes the
   decision model.
2. Add a use case to `src/application/chronos` if the feature changes runtime
   behavior.
3. Add adapters in `src/infrastructure` for external systems.
4. Add React components and route composition under `src/presentation`.

This keeps the Temporal Engine portable: the same domain and application code
can later run behind an API Gateway, Simulation Service, Planner, Agent Runtime,
and Storage layer without being tied to this web interface.

## Target AI Service Architecture

The runtime evolves from a single in-process engine into independently deployable
services connected by stable run IDs, branch IDs, and event contracts:

```text
Planner Agent
  ↓  decision plan
Scenario Generator
  ↓  candidate scenarios
Branch Generator
  ↓  isolated state branches
Simulation Runtime
  ↓  future traces
Outcome Evaluator
  ↓  outcome scores
Ranking Engine
  ↓  selected path
Memory
```

| Service | Responsibility | Consumes | Produces |
|---|---|---|---|
| Planner Agent | Defines goals, constraints, and search depth | Goal + constraints | Decision plan |
| Scenario Generator | Creates concrete what-if worlds | Decision plan | Candidate scenarios |
| Branch Generator | Expands scenarios into isolated alternatives | Candidate scenarios | State branches |
| Simulation Runtime | Executes world-model and tool calls | State branches | Future traces |
| Outcome Evaluator | Scores reward, risk, confidence, and policy | Future traces | Outcome scores |
| Ranking Engine | Selects and explains the best viable future | Outcome scores | Selected path |
| Memory | Persists decisions and learned context | Selected path + traces | Learned context |

Each service should be independently deployable, observable, horizontally
scalable, and safe to retry. In practice this means every handoff carries a
stable `runId`, `branchId`, input hash, and idempotency key.

## Agent Operating System

The Temporal Engine is task-oriented. It does not model or invoke individual
agents. External providers register capabilities, and the operating system
resolves tasks to those capabilities:

```text
Planner
  ↓
Task Graph
  ↓
Scheduler
  ↓
Execution Runtime
  ↓
Memory
  ↓
Evaluation
  ↓
Timeline Ranking
```

| OS component | Responsibility |
|---|---|
| `Planner` | Converts a decision goal and constraints into a validated `TaskGraph` |
| `TaskGraph` | Dependency-aware DAG of atomic work; rejects missing dependencies and cycles |
| `Scheduler` | Selects dependency-ready tasks by priority and concurrency budget |
| `ExecutionRuntime` | Resolves each task kind to a registered capability and records execution output |
| `Memory` | Supplies workspace evidence and retains reusable context |
| `OutcomeEvaluator` | Assigns score, confidence, rationale, and policy compliance to execution results |
| `RankingEngine` | Ranks evaluated timelines and selects the next canonical path |

`CapabilityRegistration` is the only place a provider enters the system. A
provider can be an LLM agent, a tool server, a human approval service, or a
deterministic program. The Temporal Engine receives only `Task` objects and
never needs provider-specific logic.

### Objective decomposition

Users do not choose individual agents. They state an objective; the Planner
decomposes it into a dependency-aware task graph and the Runtime resolves each
task to registered capabilities.

```text
Launch startup
  ↓
Research competitors
  ↓
Estimate market
  ↓
Build roadmap
  ↓
Predict adoption
  ↓
Financial simulation
  ↓
Risk analysis
  ↓
Timeline ranking
```

`StartupLaunchPlanner` is the first concrete decomposition. It is deliberately
task-oriented: a research capability, financial model, or risk evaluator can be
replaced without changing the planner or temporal engine.

## Temporal Versioning

Every decision is versioned as a replayable temporal lifecycle:

```text
Timeline
  ↓
Branch
  ↓
Subbranch
  ↓
Merge
  ↓
Collapse
```

- A **Timeline** owns canonical state, event history, merge records, and
  collapse records.
- A **Branch** captures a hypothesis and isolated state. A **Subbranch** adds
  parent lineage and depth to continue exploration from any branch.
- A **Merge** is an explicit, reversible convergence of compatible branch
  evidence; it does not commit the timeline.
- A **Collapse** selects one ranked branch as canonical state while retaining
  discarded branch IDs for replay and audit.

This branch history is difficult to replicate because ranking, merge evidence,
and collapse decisions remain connected to the original assumptions and task
executions rather than being discarded after each run.

## Repository ports

The domain defines five persistence ports in
`src/domain/chronos/repositories.ts`:

```ts
SimulationRepository
AgentRepository
MemoryRepository
ScenarioRepository
WorkspaceRepository
KnowledgeGraphRepository
TaskGraphRepository
CapabilityRepository
TaskExecutionRepository
EvaluationRepository
```

All extend one generic `Repository<T>` contract:

```ts
get(id)
list(options?)
save(record)
delete(id)
```

The infrastructure layer currently provides three interchangeable adapters:

```text
MemoryRepository<T>    // local demos, tests, offline use
SQLiteRepository<T>    // desktop, edge, or mobile local persistence
SupabaseRepository<T>  // authenticated cloud persistence
```

Only serializable records cross this boundary. Executable agent behavior and
scenario action functions stay in the domain/runtime and are reconstructed from
stored definitions when a run begins.

## Explicit Domain Objects

Chronos does not model its core concepts as anonymous bags of data. The domain
entities in `src/domain/chronos/entities.ts` make the decision lifecycle
explicit:

```text
Workspace
  ├── Agent
  ├── Memory
  └── Simulation
        ├── Decision
        │     ├── Hypothesis[]
        │     └── Constraint[]
        ├── Branch[]
        │     └── Outcome
        └── Timeline
```

| Object | Responsibility |
|---|---|
| `Workspace` | Tenant boundary for agents, simulations, and durable state |
| `Agent` | Bounded decision-maker with a scenario and world model |
| `Simulation` | Aggregate root for one temporal decision run |
| `Decision` | Goal, collapse strategy, constraints, and candidate hypotheses |
| `Hypothesis` | Testable claim about an action's possible future |
| `Constraint` | Hard or soft rule that shapes the decision space |
| `Branch` | Isolated possible future generated from a hypothesis |
| `Outcome` | Evaluated reward, risk, score, and explanation for a branch |
| `Timeline` | Immutable, replayable event sequence and committed state |
| `Memory` | Durable learned context available to the next planning cycle |
| `KnowledgeGraph` | Workspace-level causal graph connecting evidence, assumptions, and outcomes |

The application engine works with `Simulation` and `Branch` entity methods
(`withOutcome`, `select`, `prune`, `Timeline.commit`) rather than spreading and
mutating plain objects. This keeps lifecycle invariants in the domain layer.

## Workspace Intelligence Flywheel

Chronos treats simulation as a learning loop rather than disposable compute:

```text
Workspace
  ↓
Knowledge Graph
  ↓
Past Simulations
  ↓
Successful Futures
  ↓
Failure Patterns
  ↓
Next planning cycle
```

- **Past simulations** preserve branch traces, evaluator scores, assumptions,
  and selected outcomes.
- **Successful futures** become higher-priority hypotheses or reusable planning
  strategies when reality validates their prediction.
- **Failure patterns** become constraints or guardrails when an assumption,
  action, or branch shape repeatedly produces a poor outcome.
- **KnowledgeGraph** connects the evidence, making it available to the Planner
  Agent before new scenarios and branches are generated.

The result is a workspace where every completed run improves the priors of the
next run without changing the deterministic meaning of an individual simulation.

The dashboard's **Workspace Intelligence** feature is a read model over this
service: it shows past runs, graph nodes, promoted successful futures, and
derived failure patterns without placing learning rules in presentation code.

## Performance Boundaries

Feature-level presentation boundaries keep expensive tools isolated:

```text
presentation/features/
├── planner/        # startup simulation orchestration
├── timeline/       # virtualized event and replay views
├── visualization/  # virtualized branch rendering
└── workspace/      # workspace intelligence loop
```

- **Virtualization:** `VirtualBranchList` takes over when a run exceeds 60
  branches; `VirtualTimelineEvents` renders only visible replay rows. DOM work
  remains proportional to viewport size rather than branch count.
- **Lazy boundaries:** dashboard engine, Chronos language tooling, docs,
  changelog, and system architecture are loaded through React lazy/Suspense
  boundaries rather than eagerly by the dashboard shell.
- **Cache identity:** simulation cache keys are deterministic hashes of
  `prompt + workspaceId + modelVersion + configuration`. The browser uses an
  in-memory session cache for demos; shared Supabase caching runs in trusted
  API/edge processes to avoid exposing prompts across tenants.

See [PERFORMANCE.md](./PERFORMANCE.md) for operational details and invalidation
rules.

Repository implementations remain interchangeable at the composition root:

```ts
const simulations: SimulationRepository =
  new MemoryRepository<Simulation>();

// Same port, local durable persistence.
const localSimulations: SimulationRepository =
  new SQLiteRepository<Simulation>(database, "simulations");

// Same port, authenticated cloud persistence.
const cloudSimulations: SimulationRepository =
  new SupabaseRepository<Simulation>(supabase, "simulations");
```