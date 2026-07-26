import { useEffect } from "react";
import { Link } from "react-router-dom";

/**
 * /whitepaper — "Chronos: A Temporal Compute Layer for Decisions", v1.0.
 *
 * Rendered as a document, not a marketing page: a letter-width paper sheet
 * (8.5in, 0.8in margin) laid on the site's dark desk. Typography and the
 * print palette live in the `.wp-*` block at the end of `src/index.css`;
 * printing the route produces the paper document with no site chrome.
 */
export function WhitepaperPage() {
  // Marks the document route so print CSS can swap the dark UI canvas — which
  // propagates to the printed page — for paper.
  useEffect(() => {
    document.documentElement.classList.add("wp-route");
    return () => document.documentElement.classList.remove("wp-route");
  }, []);

  return (
    <div className="wp-desk">
      <DocumentToolbar />

      <article className="wp-sheet">
        {/* A table wrapper is the one structure browsers repeat across printed
            pages: the tfoot at the end prints as a running footer on every
            sheet, with its height reserved so body text never lands under it.
            On screen every part is display:block, so this is a plain document
            flow. (WebKit does not repeat table footers — there the strip
            prints once, at the end.) */}
        <table className="wp-frame">
          <tbody>
            <tr>
              <td>
                <header className="wp-masthead">
                  <span className="wp-wordmark">
                    Chronos <span>LAB</span>
                  </span>
                  <div className="wp-masthead-meta">
                    <span>Whitepaper · v1.0</span>
                    <span>July 2026</span>
                  </div>
                </header>

                <h1 className="wp-title">Chronos: A Temporal Compute Layer for Decisions</h1>
                <p className="wp-lede">
                  Branch, simulate, evaluate, collapse — deterministic decision infrastructure for
                  humans and agents.
                </p>

                <section className="wp-abstract">
                  <div className="wp-label">Abstract</div>
                  <p>
                    AI systems have become remarkably good at generating answers, yet long-term work
                    with them still fails — not because models lack intelligence, but because every
                    session discards the context, decisions, and reasoning that came before. This
                    paper argues that the bottleneck in AI-assisted work has shifted from
                    intelligence to continuity, and that the missing layer is not another model but
                    decision infrastructure. We introduce Chronos, a temporal compute platform that
                    treats a decision as a first-class computation: it decomposes an objective into
                    a task graph, branches it into isolated possible futures, simulates and scores
                    each future for reward, risk, and confidence, and collapses to the highest
                    expected-value path — while preserving the full lineage of every alternative for
                    audit and replay. We describe the temporal engine, its service architecture, the
                    versioned decision memory that compounds across runs, and the current public
                    beta.
                  </p>
                </section>

                {/* 01 — The Continuity Problem */}
                <h2 className="wp-h2">
                  <span className="wp-num">01</span>The Continuity Problem
                </h2>
                <div className="wp-rule" />
                <p className="wp-p">
                  Foundation models answer well. Ask a hard question and a frontier model returns a
                  plausible, often excellent response in seconds. But real work is not a question —
                  it is a project: weeks or months of interdependent goals, constraints, evidence,
                  and decisions, each building on the last.
                </p>
                <p className="wp-p">
                  Against that shape of work, today's AI interfaces fail structurally. Every new
                  conversation starts with incomplete context. Users re-explain their projects,
                  reconstruct previous decisions from memory, and search across documents, chats,
                  and notes to recover information the model has already been told. The cost of this
                  reconstruction grows with project complexity, and it grows faster than the value
                  of any single answer.
                </p>
                <p className="wp-p">
                  There is a second, subtler failure: even within a session, a model produces{" "}
                  <em>one</em> answer — a single sampled path through an enormous space of possible
                  strategies. When the cost of a wrong path is high (a product launch, capital
                  allocation, research strategy, an agent about to act), a single unexamined path is
                  not a decision. It is a guess with good grammar.
                </p>
                <div className="wp-claim">
                  <span className="wp-label">Claim</span>
                  <p>
                    As projects grow more complex, the bottleneck is no longer intelligence — it is
                    continuity.
                  </p>
                </div>

                {/* 02 — Decision Infrastructure */}
                <h2 className="wp-h2">
                  <span className="wp-num">02</span>Decision Infrastructure
                </h2>
                <div className="wp-rule" />
                <p className="wp-p">
                  The industry's default response to every AI limitation has been a better model. We
                  believe the next layer of value comes from somewhere else. Generating answers is
                  no longer the primary challenge; preserving context, structuring reasoning, and
                  maintaining continuity across weeks, months, and years of work is. The missing
                  layer isn't another model — it's decision infrastructure.
                </p>
                <p className="wp-p wp-p-lead">
                  Decision infrastructure, as we define it, must do four things no chat interface
                  does:
                </p>
                <ol className="wp-list">
                  <li>
                    <strong>Persist.</strong> Goals, knowledge, decisions, tasks, and timelines
                    remain connected over time, so reasoning starts from the complete history of a
                    project rather than a blank prompt.
                  </li>
                  <li>
                    <strong>Branch.</strong> An objective is expanded into multiple isolated
                    possible futures — not one sampled answer — each a testable hypothesis about
                    what could happen.
                  </li>
                  <li>
                    <strong>Evaluate.</strong> Futures are simulated and scored on reward, risk,
                    confidence, and policy compliance, making trade-offs explicit and comparable.
                  </li>
                  <li>
                    <strong>Commit with lineage.</strong> The system collapses to one canonical path
                    while retaining every discarded branch, so any decision can be audited,
                    replayed, and learned from.
                  </li>
                </ol>
                <p className="wp-p">
                  Chronos is a purpose-built implementation of this layer: a persistent AI workspace
                  in which the unit of computation is not the message but the decision.
                </p>

                {/* 03 — The Temporal Engine */}
                <h2 className="wp-h2">
                  <span className="wp-num">03</span>The Temporal Engine
                </h2>
                <div className="wp-rule" />
                <p className="wp-p wp-p-wide">
                  At the core of Chronos is the temporal engine: a deterministic runtime that
                  executes the decision lifecycle as a pipeline.
                </p>
                <figure className="wp-figure">
                  <div className="wp-flow">
                    <span className="wp-chip">Timeline</span>
                    <span className="wp-arrow">→</span>
                    <span className="wp-chip">Branch</span>
                    <span className="wp-arrow">→</span>
                    <span className="wp-chip">Evaluate</span>
                    <span className="wp-arrow">→</span>
                    <span className="wp-chip">Prune</span>
                    <span className="wp-arrow">→</span>
                    <span className="wp-chip-strong">Collapse</span>
                    <span className="wp-arrow">→</span>
                    <span className="wp-chip">Memory</span>
                  </div>
                  <figcaption className="wp-figcaption">
                    Figure 1 — The temporal decision lifecycle executed by the Chronos engine.
                  </figcaption>
                </figure>

                <h3 className="wp-h3">3.1 &nbsp;From objective to task graph</h3>
                <p className="wp-p">
                  Users do not orchestrate agents. They state an objective. A planner decomposes it
                  into a dependency-aware task graph — a validated DAG of atomic work that rejects
                  missing dependencies and cycles. A scheduler selects dependency-ready tasks by
                  priority and concurrency budget, and the execution runtime resolves each task kind
                  to a registered capability. A capability may be an LLM agent, a tool server, a
                  deterministic program, or a human approval service; the engine receives only task
                  objects and never contains provider-specific logic.
                </p>

                <h3 className="wp-h3">3.2 &nbsp;Branching and evaluation</h3>
                <p className="wp-p">
                  Each candidate strategy becomes a <strong>branch</strong>: an isolated possible
                  future generated from an explicit hypothesis, executed against the project's world
                  model. The simulation runtime produces future traces; an outcome evaluator scores
                  each trace on reward, risk, confidence, and policy compliance. Ranking is
                  expected-value based — outcome magnitude weighted by its probability — so a
                  spectacular but improbable future loses to a solid, likely one. In the public
                  startup simulator, a single objective expands into roughly a thousand sampled
                  futures across strategy archetypes before ranking.
                </p>
                <figure className="wp-figure wp-figure-spaced">
                  <svg
                    viewBox="0 0 680 250"
                    className="wp-branch-svg"
                    role="img"
                    aria-label="An objective branching into four futures scored by expected value; the branch scoring 0.82 is selected and collapses into the canonical path, while branches scoring 0.31, 0.54, and 0.17 are pruned."
                  >
                    <title>Branches ranked by expected value, collapsing to a canonical path</title>
                    <path
                      d="M 60 128 C 200 128 260 44 420 44"
                      fill="none"
                      stroke="#c4c2aa"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M 60 128 C 200 128 260 100 420 100"
                      fill="none"
                      stroke="#2a4d5f"
                      strokeWidth="2.6"
                    />
                    <path
                      d="M 60 128 C 200 128 260 156 420 156"
                      fill="none"
                      stroke="#c4c2aa"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M 60 128 C 200 128 260 212 420 212"
                      fill="none"
                      stroke="#c4c2aa"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M 420 100 C 500 100 530 128 600 128"
                      fill="none"
                      stroke="#2a4d5f"
                      strokeWidth="2.6"
                    />
                    <circle cx="60" cy="128" r="6" fill="#1c1b19" />
                    <circle cx="420" cy="44" r="4.5" fill="#c4c2aa" />
                    <circle cx="420" cy="100" r="5.5" fill="#2a4d5f" />
                    <circle cx="420" cy="156" r="4.5" fill="#c4c2aa" />
                    <circle cx="420" cy="212" r="4.5" fill="#c4c2aa" />
                    <circle cx="600" cy="128" r="7" fill="#60899b" />
                    <text
                      x="60"
                      y="112"
                      textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="11"
                      fill="#1c1b19"
                    >
                      objective
                    </text>
                    <text
                      x="436"
                      y="48"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="11"
                      fill="#989898"
                    >
                      EV 0.31 · pruned
                    </text>
                    <text
                      x="436"
                      y="88"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="11"
                      fill="#2a4d5f"
                    >
                      EV 0.82 · selected
                    </text>
                    <text
                      x="436"
                      y="160"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="11"
                      fill="#989898"
                    >
                      EV 0.54 · pruned
                    </text>
                    <text
                      x="436"
                      y="216"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="11"
                      fill="#989898"
                    >
                      EV 0.17 · pruned
                    </text>
                    <text
                      x="600"
                      y="152"
                      textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="11"
                      fill="#2a4d5f"
                    >
                      canonical path
                    </text>
                  </svg>
                  <figcaption className="wp-figcaption">
                    Figure 2 — Branches are scored by expected value; the timeline collapses to the
                    strongest path while pruned branches are retained for replay.
                  </figcaption>
                </figure>

                <h3 className="wp-h3">3.3 &nbsp;Determinism and auditability</h3>
                <p className="wp-p">
                  A decision you cannot reproduce is a decision you cannot trust. Chronos
                  simulations are deterministic for a given prompt and sample budget: cache identity
                  is a hash of prompt, workspace, model version, and configuration, so identical
                  inputs yield identical rankings and results are cacheable. When the timeline
                  collapses, the selected branch becomes canonical state — but discarded branch IDs,
                  evaluator scores, and original assumptions are all retained. Any past decision can
                  be replayed, re-scored under new evidence, or audited branch by branch.
                </p>

                <h3 className="wp-h3">3.4 &nbsp;Memory that compounds</h3>
                <p className="wp-p">
                  Chronos treats simulation as a learning loop rather than disposable compute. Past
                  runs preserve branch traces, scores, and assumptions in a workspace-level
                  knowledge graph. Futures that reality validates are promoted into higher-priority
                  hypotheses for the next planning cycle; branch shapes that repeatedly fail become
                  constraints and guardrails. Every completed run improves the priors of the next
                  without changing the deterministic meaning of any individual simulation — a data
                  asset that is difficult to replicate precisely because ranking, evidence, and
                  collapse decisions stay connected to their original assumptions.
                </p>

                {/* 04 — System Architecture */}
                <h2 className="wp-h2 wp-break-before">
                  <span className="wp-num">04</span>System Architecture
                </h2>
                <div className="wp-rule" />
                <p className="wp-p">
                  Chronos follows a clean-architecture layout that keeps temporal decision rules
                  independent of any interface or vendor: a pure domain layer (world state,
                  branches, hypotheses, constraints, the Chronos language) with no external imports;
                  an application layer of use cases (fork, evaluate, collapse); interchangeable
                  infrastructure adapters; and a presentation layer that owns no decision logic. The
                  same engine can run behind a web workspace today and an API gateway, simulation
                  service, or agent runtime tomorrow.
                </p>
                <p className="wp-p">
                  The runtime is designed to evolve from a single in-process engine into
                  independently deployable services connected by stable run IDs, branch IDs, and
                  idempotent event contracts:
                </p>
                <figure className="wp-figure">
                  <div className="wp-table-scroll">
                    <table className="wp-table">
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th>Responsibility</th>
                          <th>Produces</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SERVICES.map((service) => (
                          <tr key={service.name}>
                            <td>{service.name}</td>
                            <td>{service.responsibility}</td>
                            <td>{service.produces}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <figcaption className="wp-figcaption">
                    Table 1 — Target service decomposition of the temporal engine.
                  </figcaption>
                </figure>

                <h3 className="wp-h3">4.1 &nbsp;Temporal versioning</h3>
                <p className="wp-p">
                  Every decision is versioned as a replayable lifecycle:{" "}
                  <span className="wp-mono-inline">
                    Timeline → Branch → Subbranch → Merge → Collapse
                  </span>
                  . A timeline owns canonical state and event history; branches capture hypotheses
                  in isolated state; subbranches add lineage and depth so exploration can continue
                  from any point; merges are explicit, reversible convergences of compatible
                  evidence; and a collapse commits one ranked branch as canonical while retaining
                  everything it displaced. This is git-like semantics applied to decisions rather
                  than code.
                </p>

                <h3 className="wp-h3">4.2 &nbsp;Persistence and portability</h3>
                <p className="wp-p">
                  The domain defines generic repository ports; infrastructure supplies
                  interchangeable adapters — in-memory for demos and tests, SQLite for desktop and
                  edge, Supabase Postgres for authenticated cloud persistence. The product runs
                  local-first with cloud dual-write: local storage gives instant resume, the cloud
                  gives durable multi-session memory, and loads merge remote and local history. Only
                  serializable records cross the boundary; executable behavior stays in the runtime
                  and is reconstructed from stored definitions when a run begins.
                </p>

                {/* 05 — Product */}
                <h2 className="wp-h2">
                  <span className="wp-num">05</span>Product
                </h2>
                <div className="wp-rule" />
                <p className="wp-p">
                  Chronos is live in public beta at{" "}
                  <a href="https://chronoslab.space">chronoslab.space</a>. The product has three
                  surfaces: a public site with a live simulator that anyone can run against a real
                  objective; a private workspace — goals, knowledge library, simulations, timeline,
                  and versioned decision memory; and product documentation. The workspace loop is
                  deliberately simple: state a goal, attach knowledge, run a simulation, keep the
                  decision report, save the path, and log the real-world outcome — closing the loop
                  that trains the next cycle.
                </p>
                <div className="wp-split">
                  <div>
                    <div className="wp-label">Shipped — public beta</div>
                    <ul>
                      <li>Persistent workspaces</li>
                      <li>Goal &amp; task management</li>
                      <li>Knowledge library &amp; context pipeline</li>
                      <li>Decision engine &amp; simulations</li>
                      <li>Timeline &amp; versioned memory</li>
                      <li>Authentication</li>
                    </ul>
                  </div>
                  <div>
                    <div className="wp-label wp-label-muted">Next</div>
                    <ul>
                      <li>Deep LLM integration, multi-model support</li>
                      <li>Persistent AI memory</li>
                      <li>Decision recommendations</li>
                      <li>Team collaboration</li>
                      <li>Agent orchestration &amp; developer APIs</li>
                    </ul>
                  </div>
                </div>
                <p className="wp-p">
                  Chronos is built for people managing long-term projects with AI — founders,
                  developers, researchers, product teams, and knowledge workers — and, increasingly,
                  for autonomous agents that must think before they act.
                </p>

                {/* 06 — Business Model */}
                <h2 className="wp-h2">
                  <span className="wp-num">06</span>Business Model
                </h2>
                <div className="wp-rule" />
                <p className="wp-p">
                  Chronos is a SaaS platform. Revenue comes from subscriptions, premium AI
                  capabilities, enterprise collaboration features, developer APIs, and future
                  platform services. The strategic position mirrors the architecture: as agent
                  systems proliferate, every serious deployment will need a layer that plans,
                  simulates, and audits decisions before acting. Chronos aims to be that layer — the
                  decision infrastructure other systems build on — with the workspace as its first
                  proof and its first market.
                </p>
                <p className="wp-p">
                  The compounding moat is the versioned decision history itself. Because ranking,
                  merge evidence, and collapse records stay connected to their original assumptions
                  and executions, a mature Chronos workspace carries priors that cannot be
                  reconstructed by pointing a fresh model at the same documents.
                </p>

                {/* 07 — Status & Traction */}
                <h2 className="wp-h2">
                  <span className="wp-num">07</span>Status &amp; Traction
                </h2>
                <div className="wp-rule" />
                <p className="wp-p">
                  Chronos is early, and deliberately honest about it. The public beta is live with
                  the core workspace, decision engine, and context pipeline complete. The first
                  cohort of early users is onboarded and shaping the product through continuous
                  iteration. Development happens in public — the product surface is open source
                  under MIT — with an active community on GitHub, X, and Telegram.
                </p>
                <div className="wp-stats">
                  {STATS.map((stat) => (
                    <div className="wp-stat" key={stat.label}>
                      <div className="wp-stat-value">{stat.value}</div>
                      <div className="wp-stat-label">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* 08 — Vision */}
                <h2 className="wp-h2">
                  <span className="wp-num">08</span>Vision
                </h2>
                <div className="wp-rule" />
                <p className="wp-p">
                  We are not building another AI chatbot. We are building the infrastructure that
                  lets humans and AI collaborate across the lifetime of a project — where every
                  goal, every branch explored, every trade-off weighed, and every outcome logged
                  makes the next decision better than the last.
                </p>
                <blockquote className="wp-quote">
                  <p>
                    The future of AI isn't better answers.
                    <br />
                    It's better decisions.
                  </p>
                </blockquote>

                <div className="wp-colophon">
                  <span>
                    Web · <a href="https://chronoslab.space">chronoslab.space</a>
                  </span>
                  <span>
                    Source ·{" "}
                    <a href="https://github.com/Chronos-Lab-Space/Chronos">
                      github.com/Chronos-Lab-Space/Chronos
                    </a>
                  </span>
                  <span>
                    X · <a href="https://x.com/chronoslabspace">@chronoslabspace</a>
                  </span>
                  <span>© 2026 Chronos Lab · MIT</span>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>
                <div className="wp-runfoot">
                  <span>Chronos Lab — A Temporal Compute Layer for Decisions</span>
                  <span>chronoslab.space</span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </article>
    </div>
  );
}

/** Site-side chrome: breadcrumb and print action. Never printed. */
function DocumentToolbar() {
  return (
    <div className="mx-auto mb-8 flex w-[min(8.5in,100%)] flex-wrap items-center justify-between gap-4 print:hidden">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
        <Link to="/" className="transition hover:text-ink-dim">
          Home
        </Link>
        <span>/</span>
        <span className="text-ink-dim">Whitepaper</span>
      </div>

      <div className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.2em]">
        <span className="hidden text-ink-faint sm:inline">v1.0 · July 2026</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-line-strong px-3 py-2 text-ink-dim transition hover:border-chronos hover:text-ink"
        >
          Print / Save PDF
        </button>
      </div>
    </div>
  );
}

const SERVICES = [
  {
    name: "Planner Agent",
    responsibility: "Defines goals, constraints, and search depth",
    produces: "Decision plan",
  },
  {
    name: "Scenario Generator",
    responsibility: "Creates concrete what-if worlds",
    produces: "Candidate scenarios",
  },
  {
    name: "Branch Generator",
    responsibility: "Expands scenarios into isolated alternatives",
    produces: "State branches",
  },
  {
    name: "Simulation Runtime",
    responsibility: "Executes world-model and tool calls",
    produces: "Future traces",
  },
  {
    name: "Outcome Evaluator",
    responsibility: "Scores reward, risk, confidence, and policy",
    produces: "Outcome scores",
  },
  {
    name: "Ranking Engine",
    responsibility: "Selects and explains the best viable future",
    produces: "Selected path",
  },
  {
    name: "Memory",
    responsibility: "Persists decisions and learned context",
    produces: "Learned context",
  },
];

const STATS = [
  { value: "Live", label: "Public beta" },
  { value: "~1,000", label: "Futures per simulation" },
  { value: "Open", label: "Built in public · MIT" },
  { value: "6", label: "Early users onboarded" },
];
