# Chronos — agent instructions

Chronos is **decision infrastructure** (branch → simulate → evaluate → collapse), not a chatbot.

Prefer technical accuracy, systems thinking, scalability, and minimal design. Distinguish current implementation from roadmap.

## Skills

Project skills live in [`.agents/skills/`](./.agents/skills/) (symlinked for Grok/Claude at `.grok/skills` and `.claude/skills`).

| Source | Skills |
|--------|--------|
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | 24 lifecycle skills (spec → plan → build → test → review → ship) |
| Supabase | `supabase`, `supabase-postgres-best-practices`, `supabase-server` |

Lockfile: [`skills-lock.json`](./skills-lock.json). Restore/update:

```bash
npx skills experimental_install          # from lockfile
npx skills update -p -y                  # project skills to latest
npx skills add addyosmani/agent-skills --skill '*' -y -a grok
```

### Lifecycle commands

Flat slash commands in [`.agents/commands/`](./.agents/commands/):

| Command | Primary skill |
|---------|----------------|
| `/spec` | `spec-driven-development` |
| `/plan` | `planning-and-task-breakdown` |
| `/build` | `incremental-implementation` + TDD |
| `/test` | `test-driven-development` |
| `/review` | `code-review-and-quality` |
| `/code-simplify` | `code-simplification` |
| `/ship` | `shipping-and-launch` |
| `/webperf` | web performance auditor persona |

Load skills **selectively** by task — do not dump the whole pack into context.

### Meta

Start ambiguous sessions with `using-agent-skills` to map work to the right workflow.

### References & personas

- Checklists: [`references/`](./references/)
- Review personas: [`agents/`](./agents/) (`code-reviewer`, `test-engineer`, `security-auditor`, `web-performance-auditor`)

## Chronos stack (current)

| Layer | Location |
|-------|----------|
| Temporal engine | `src/application/chronos/engine.ts` — `fork` / `evaluate` / `collapse` / `run` |
| Agent run orchestration | `src/application/chronos/AgentSimulationRunner.ts` (pure; no LLM) |
| Product decision sims | `src/application/simulation/SimulationEngine.ts` (deterministic; optional AI prose enrich) |
| Public Monte Carlo demo | `src/domain/chronos/startup-sim.ts` + `publicStartupSimulator` (no LLM) |
| Scenario demos (Forge / Oracle / Atlas) | `src/domain/chronos/agents.ts` — **scripted world models**, not LLM agents |
| Specialist agents | `src/agents/*` — real eval/memory/sim; research optional AI; others stubs |
| Capability registry (live) | `src/application/agent-os/createDefaultCapabilityRegistry.ts` |
| Agent dispatch (live) | `src/core/runtime/` — `bootstrap.ts` registers all seven; `WorkspaceService` runs `simulation.execute` + `outcome.evaluate` |
| Workspace dual-write | `src/application/workspace/WorkspaceService.ts` |
| AI port (default noop) | `src/infrastructure/ai/createAIPort.ts` |
| Supabase client | `src/infrastructure/supabase/client.ts` |

Do not claim that Forge/Oracle/Atlas or the public simulator call an LLM. Ranking is engine-owned.

## Quality bar

- Prefer tests that prove decision outcomes (unit on engine/scorers; E2E on auth + decision loop).
- Never commit secrets. Browser env is `VITE_SUPABASE_*` only; server secrets never use `VITE_`.
- Empty/missing Supabase env must not crash the SPA (`isSupabaseConfigured`).


## Coding agent architecture

Chronos orchestrates specialized engineering agents instead of relying on a single coding model.

### Engineering agents

- **Coder** — understands tasks, edits code, runs terminal commands, and iterates until validation succeeds.
- **Reviewer** — reviews architecture, style, and complexity before changes are accepted.
- **Test Engineer** — generates tests, reproduces bugs, and prevents regressions.
- **Security Auditor** — checks secrets, dependencies, authentication, and common vulnerabilities.
- **DevOps** — manages CI/CD, containers, infrastructure, and deployments.
- **Documentation** — maintains docs, changelogs, and migration guides.

### Coding principles

Every implementation should:

1. Understand the objective.
2. Inspect the codebase before editing.
3. Plan the smallest safe change.
4. Implement incrementally.
5. Run lint, typecheck, and tests.
6. Automatically iterate on failures.
7. Present a concise diff and summary.
8. Clearly distinguish current implementation from roadmap proposals.

### Decision-driven implementation

Chronos may evaluate multiple implementation strategies before selecting one:

- Branch candidate implementations.
- Execute validation (tests, lint, performance, security).
- Score outcomes.
- Collapse to the highest-confidence solution.
