import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "./PageHeader";
import { useAccessModal } from "../features/access/AccessModal";

type Section =
  | "introduction"
  | "getting-started"
  | "workspaces"
  | "goals"
  | "knowledge"
  | "simulations"
  | "timeline"
  | "memory"
  | "decision-reports"
  | "api"
  | "roadmap"
  | "security"
  | "support";

const NAV: {
  group: string;
  items: { id: Section; label: string; badge?: string }[];
}[] = [
  {
    group: "Introduction",
    items: [
      { id: "introduction", label: "What is Chronos?" },
    ],
  },
  {
    group: "Getting Started",
    items: [
      { id: "getting-started", label: "First simulation" },
    ],
  },
  {
    group: "Features",
    items: [
      { id: "workspaces", label: "Workspaces" },
      { id: "goals", label: "Goals" },
      { id: "knowledge", label: "Knowledge Library" },
      { id: "simulations", label: "Simulations" },
      { id: "timeline", label: "Timeline" },
      { id: "memory", label: "Memory" },
      { id: "decision-reports", label: "Decision Reports" },
    ],
  },
  {
    group: "Platform",
    items: [
      { id: "api", label: "API", badge: "Soon" },
      { id: "roadmap", label: "Roadmap" },
      { id: "security", label: "Security & Privacy" },
      { id: "support", label: "Support" },
    ],
  },
];

export function Docs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get("section");
  const isKnownSection = NAV.flatMap((group) => group.items).some(
    (item) => item.id === requestedSection
  );
  const section: Section = isKnownSection
    ? (requestedSection as Section)
    : "introduction";

  const selectSection = (next: Section) => {
    setSearchParams({ section: next }, { replace: true });
  };

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Docs" }]}
        eyebrow="/ documentation"
        title={
          <>
            Cerebrum<span className="text-ink-faint">.</span>
          </>
        }
        subtitle="How Chronos works — from workspaces and knowledge to simulations, timelines, and decision reports."
      />

      <section className="relative">
        <div className="mx-auto max-w-[1400px] px-6 py-6 lg:px-10">
          {/* Mobile: horizontal nav strip */}
          <div className="mb-6 lg:hidden">
            <div className="-mx-6 flex gap-1.5 overflow-x-auto px-6 pb-2">
              {NAV.flatMap((g) =>
                g.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectSection(item.id)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 font-mono text-[11px] transition ${
                      section === item.id
                        ? "bg-chronos/15 text-chronos"
                        : "border border-line text-ink-dim hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    {item.label}
                    {item.badge ? ` · ${item.badge}` : ""}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Desktop sidebar */}
            <aside className="hidden lg:col-span-3 lg:block">
              <div className="sticky top-20">
                <nav className="space-y-6">
                  {NAV.map((group) => (
                    <div key={group.group}>
                      <div className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                        {group.group}
                      </div>
                      <ul className="space-y-0.5">
                        {group.items.map((item) => (
                          <li key={item.id}>
                            <button
                              onClick={() => selectSection(item.id)}
                              className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-[13px] transition ${
                                section === item.id
                                  ? "bg-chronos/10 text-chronos"
                                  : "text-ink-dim hover:bg-bg-soft hover:text-ink"
                              }`}
                            >
                              <span>{item.label}</span>
                              {item.badge && (
                                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-faint">
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </nav>

                <div className="mt-8 border-t border-line pt-6">
                  <div className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                    Jump to
                  </div>
                  <ul className="space-y-1.5 text-[12px]">
                    <li>
                      <Link to="/faq" className="text-ink-dim hover:text-ink">
                        FAQ →
                      </Link>
                    </li>
                    <li>
                      <Link to="/login" className="text-ink-dim hover:text-ink">
                        Sign in →
                      </Link>
                    </li>
                    <li>
                      <Link to="/contact" className="text-ink-dim hover:text-ink">
                        Contact →
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </aside>

            {/* Content — fade when section changes */}
            <main className="min-w-0 lg:col-span-9">
              <div key={section} className="page-enter">
                {section === "introduction" && <Introduction />}
                {section === "getting-started" && <GettingStarted />}
                {section === "workspaces" && <WorkspacesDocs />}
                {section === "goals" && <GoalsDocs />}
                {section === "knowledge" && <KnowledgeDocs />}
                {section === "simulations" && <SimulationsDocs />}
                {section === "timeline" && <TimelineDocs />}
                {section === "memory" && <MemoryDocs />}
                {section === "decision-reports" && <DecisionReportsDocs />}
                {section === "api" && <ApiDocs />}
                {section === "roadmap" && <RoadmapDocs />}
                {section === "security" && <SecurityDocs />}
                {section === "support" && <SupportDocs />}
              </div>
            </main>
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// Shared building blocks
// ============================================================

function DocTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-3xl leading-tight tracking-tight text-ink md:text-4xl">
      {children}
    </h2>
  );
}

function DocSub({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-10 border-t border-line pt-6 font-serif text-xl text-ink">
      {children}
    </h3>
  );
}

function DocBody({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 max-w-2xl text-[14px] leading-[1.75] text-ink-dim">{children}</p>;
}

function Code({ children, lang = "http" }: { children: string; lang?: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line bg-bg">
      <div className="flex items-center justify-between border-b border-line px-4 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-faint/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-ink-faint/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-ink-faint/40" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          {lang}
        </span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-[1.7]">
        <code className="text-ink-dim">{children}</code>
      </pre>
    </div>
  );
}

function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "tip";
  title?: string;
  children: React.ReactNode;
}) {
  const colors = {
    info: "border-chronos/30 bg-chronos/5 text-chronos",
    warn: "border-rose-400/30 bg-rose-400/5 text-rose-400",
    tip: "border-accent-warm/30 bg-accent-warm/5 text-accent-warm",
  }[tone];
  return (
    <div className={`mt-6 rounded-lg border p-4 ${colors}`}>
      {title && (
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.25em]">
          {title}
        </div>
      )}
      <div className="text-[13px] leading-[1.65] text-ink-dim">{children}</div>
    </div>
  );
}

function Endpoint({
  method,
  path,
  desc,
}: {
  method: "GET" | "POST" | "DELETE";
  path: string;
  desc: string;
}) {
  const colors = {
    GET: "bg-chronos/15 text-chronos",
    POST: "bg-accent-2/15 text-accent-2",
    DELETE: "bg-rose-400/15 text-rose-400",
  }[method];
  return (
    <div className="rounded-lg border border-line bg-bg-soft/60 p-4">
      <div className="flex items-baseline gap-3">
        <span
          className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${colors}`}
        >
          {method}
        </span>
        <code className="font-mono text-[13px] text-ink">{path}</code>
      </div>
      <div className="mt-2 text-[12px] leading-[1.6] text-ink-dim">{desc}</div>
    </div>
  );
}

function FlowSteps({ steps }: { steps: string[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-line bg-bg-soft">
      <ol className="divide-y divide-line">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-4 px-5 py-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-chronos/30 bg-chronos/10 font-mono text-[11px] text-chronos">
              {i + 1}
            </span>
            <span className="text-[14px] text-ink">{step}</span>
            {i < steps.length - 1 && (
              <span className="ml-auto hidden font-mono text-[10px] text-ink-faint sm:inline">
                ↓
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function TopicList({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.title} className="rounded-xl border border-line bg-bg-soft p-5">
          <div className="font-serif text-lg text-ink">{item.title}</div>
          <p className="mt-2 text-[13px] leading-[1.65] text-ink-dim">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Introduction
// ============================================================

function Introduction() {
  return (
    <div>
      <DocTitle>What is Chronos?</DocTitle>
      <DocBody>
        Chronos is a decision intelligence platform that helps people and AI
        explore multiple possible futures before making important decisions.
        Instead of a single answer, Chronos generates strategies, compares
        trade-offs, and recommends the strongest path for your goals and context.
      </DocBody>

      <DocSub>Vision</DocSub>
      <DocBody>
        Important decisions should not be one-shot guesses. Chronos exists so
        founders, product teams, researchers, and autonomous agents can simulate
        consequences first — then commit with clearer reasoning, ranked options,
        and an audit trail of what was considered.
      </DocBody>

      <DocSub>Core concepts</DocSub>
      <TopicList
        items={[
          {
            title: "Workspace",
            body: "Your private space for goals, knowledge, simulations, and decision history.",
          },
          {
            title: "Goal",
            body: "The outcome you want — with priorities, constraints, and success criteria.",
          },
          {
            title: "Knowledge Library",
            body: "Documents, notes, and URLs that ground simulations in real context.",
          },
          {
            title: "Simulation",
            body: "A run that generates multiple futures, scores them, and ranks recommendations.",
          },
          {
            title: "Timeline",
            body: "A view of ranked futures and how they relate across versions of a decision.",
          },
          {
            title: "Memory",
            body: "Saved history so past simulations, reports, and outcomes stay reusable.",
          },
        ]}
      />

      <DocSub>Architecture overview</DocSub>
      <DocBody>
        Chronos follows a simple decision loop. Every simulation moves through
        the same stages so results stay comparable over time.
      </DocBody>
      <FlowSteps
        steps={[
          "Set a goal",
          "Gather context",
          "Generate multiple futures",
          "Evaluate trade-offs",
          "Rank outcomes",
          "Recommend the best path",
        ]}
      />

      <Callout tone="tip" title="Start here">
        New to Chronos? Follow{" "}
        <Link
          to="/docs?section=getting-started"
          className="text-chronos underline-offset-2 hover:underline"
        >
          Getting Started
        </Link>{" "}
        to create a workspace and run your first simulation. For short answers,
        see the{" "}
        <Link to="/faq" className="text-chronos underline-offset-2 hover:underline">
          FAQ
        </Link>
        .
      </Callout>
    </div>
  );
}

// ============================================================
// Getting Started
// ============================================================

function GettingStarted() {
  const { openAccessModal } = useAccessModal();

  return (
    <div>
      <DocTitle>Getting started</DocTitle>
      <DocBody>
        This is the shortest path from zero to a recommendation. Private beta
        access is required for the full workspace product.
      </DocBody>

      <FlowSteps
        steps={[
          "Create account",
          "Create workspace",
          "Set goal",
          "Upload knowledge",
          "Run simulation",
          "Review recommendation",
        ]}
      />

      <DocSub>1. Create account</DocSub>
      <DocBody>
        Request private beta access, then sign in. Your session stays private to
        your account — workspaces are not public by default.
      </DocBody>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openAccessModal}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg transition hover:bg-chronos"
        >
          Request access
        </button>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
        >
          Sign in
        </Link>
      </div>

      <DocSub>2. Create workspace</DocSub>
      <DocBody>
        A workspace is the container for everything related to a decision
        surface: goals, knowledge, simulations, timeline, and memory. Create one
        for a company, product, research question, or personal project.
      </DocBody>

      <DocSub>3. Set goal</DocSub>
      <DocBody>
        Write a clear goal in plain language. Add priorities, constraints, and
        what “success” looks like. Better goals produce more useful futures.
      </DocBody>

      <DocSub>4. Upload knowledge</DocSub>
      <DocBody>
        Ground the simulation with PDFs, markdown, notes, or imported URLs.
        Chronos uses this library as context when generating and ranking futures.
      </DocBody>

      <DocSub>5. Run simulation</DocSub>
      <DocBody>
        Launch a simulation from your workspace. Chronos generates multiple
        possible strategies, evaluates trade-offs, and ranks outcomes against
        your goal.
      </DocBody>

      <DocSub>6. Review recommendation</DocSub>
      <DocBody>
        Open the decision report: best path, confidence signals, risks, and
        alternatives. Compare futures on the timeline, then save or re-run as
        context changes.
      </DocBody>

      <Callout tone="info" title="First simulation checklist">
        Goal defined · at least one knowledge source · constraints listed ·
        success criteria stated. Then run.
      </Callout>
    </div>
  );
}

// ============================================================
// Workspaces
// ============================================================

function WorkspacesDocs() {
  return (
    <div>
      <DocTitle>Workspaces</DocTitle>
      <DocBody>
        A workspace is where your goals, knowledge, simulations, and decision
        history live. Treat it as the home base for a decision domain — not a
        one-off chat thread.
      </DocBody>

      <DocSub>Creating workspaces</DocSub>
      <DocBody>
        Create a workspace after sign-in. Give it a clear name that reflects the
        decision surface (for example, “Series A strategy” or “Product launch
        Q3”). You can open it anytime from the workspace dashboard.
      </DocBody>

      <DocSub>Managing goals</DocSub>
      <DocBody>
        Each workspace holds active goals. Goals drive simulations: when you run
        a simulation, Chronos uses the current goal plus knowledge and
        constraints. Update goals as strategy shifts rather than starting from
        scratch every time.
      </DocBody>

      <DocSub>Organization</DocSub>
      <DocBody>
        Keep one workspace per major decision domain when possible. That keeps
        knowledge, simulation history, and memory coherent. Use notes and clear
        goal titles so future you can find the right context quickly.
      </DocBody>

      <DocSub>Settings</DocSub>
      <DocBody>
        Workspace settings cover identity and configuration for your private
        environment. Use settings to review workspace details and keep your
        decision space tidy as the product grows.
      </DocBody>

      <TopicList
        items={[
          {
            title: "Dashboard (HQ)",
            body: "Goal snapshot, quick actions, recent simulations, and knowledge summary.",
          },
          {
            title: "Continuity",
            body: "Simulations and reports stay attached to the workspace so history compounds.",
          },
        ]}
      />
    </div>
  );
}

// ============================================================
// Goals
// ============================================================

function GoalsDocs() {
  return (
    <div>
      <DocTitle>Goals</DocTitle>
      <DocBody>
        Goals define what Chronos optimizes for. A strong goal is specific enough
        to rank futures, but open enough to explore more than one strategy.
      </DocBody>

      <DocSub>Creating goals</DocSub>
      <DocBody>
        Write the outcome you want in plain language. Example: “Reach $50k MRR
        in 12 months without raising more than $1M.” Avoid vague goals like
        “grow the business.”
      </DocBody>

      <DocSub>Goal priorities</DocSub>
      <DocBody>
        Priorities tell Chronos what matters most when futures conflict — speed
        vs. risk, growth vs. runway, quality vs. cost. State ranked priorities so
        trade-offs can be scored consistently.
      </DocBody>

      <DocSub>Constraints</DocSub>
      <DocBody>
        Constraints are hard or soft limits: budget caps, team size, deadlines,
        regulatory requirements, or “must not do X.” Clear constraints reduce
        unrealistic futures and improve recommendation quality.
      </DocBody>

      <DocSub>Success criteria</DocSub>
      <DocBody>
        Define how you will know a path worked. Criteria can be metrics
        (revenue, retention), milestones (shipped feature, signed pilot), or
        qualitative outcomes (team capacity preserved). These become the yardstick
        for ranking.
      </DocBody>

      <Callout tone="tip" title="Goal quality tip">
        Better inputs → better futures. Spend five minutes on priorities and
        constraints before you run a large simulation.
      </Callout>
    </div>
  );
}

// ============================================================
// Knowledge Library
// ============================================================

function KnowledgeDocs() {
  return (
    <div>
      <DocTitle>Knowledge Library</DocTitle>
      <DocBody>
        The Knowledge Library stores documents, notes, and web resources that
        provide context for simulations. Chronos is only as grounded as the
        material you give it.
      </DocBody>

      <DocSub>Upload PDF</DocSub>
      <DocBody>
        Upload PDFs such as pitch decks, research reports, contracts summaries,
        or strategy memos. Use them when the source of truth lives in a document
        you already have.
      </DocBody>

      <DocSub>Markdown</DocSub>
      <DocBody>
        Import markdown files for specs, READMEs, and structured notes. Markdown
        is ideal for technical context and product definitions.
      </DocBody>

      <DocSub>Notes</DocSub>
      <DocBody>
        Write lightweight notes inside the workspace. Capture assumptions,
        interview takeaways, or decision constraints that do not yet live in a
        formal document.
      </DocBody>

      <DocSub>URL import</DocSub>
      <DocBody>
        Import web resources and public GitHub README content when external
        context matters — market pages, competitor pages, or product docs.
      </DocBody>

      <DocSub>Search</DocSub>
      <DocBody>
        Search the library by keywords to find the right source before a run.
        Keep titles descriptive so search stays useful as the library grows.
      </DocBody>

      <DocSub>Organization</DocSub>
      <DocBody>
        Prefer fewer high-signal sources over dumping everything. Group related
        notes, retire outdated material, and refresh knowledge when the world
        changes — then re-run simulations.
      </DocBody>
    </div>
  );
}

// ============================================================
// Simulations
// ============================================================

function SimulationsDocs() {
  return (
    <div>
      <DocTitle>Simulations</DocTitle>
      <DocBody>
        Simulations are the core of Chronos. Each run takes your goal, context,
        and constraints, then explores multiple futures instead of producing a
        single answer.
      </DocBody>

      <DocSub>Inputs</DocSub>
      <DocBody>
        Primary inputs are the active goal, knowledge library content, and any
        explicit constraints or success criteria. Richer, cleaner inputs produce
        more actionable recommendations.
      </DocBody>

      <DocSub>Constraints</DocSub>
      <DocBody>
        Constraints bound the search space. They prevent futures that violate
        hard rules (budget, time, policy) and help the ranking step prefer
        realistic paths.
      </DocBody>

      <DocSub>How futures are generated</DocSub>
      <DocBody>
        Chronos generates multiple candidate strategies from your goal and
        context. Each future is a coherent path: what you might do, what could
        happen, and what trade-offs come with that path.
      </DocBody>
      <FlowSteps
        steps={[
          "Set a goal",
          "Gather context",
          "Generate multiple futures",
          "Evaluate trade-offs",
          "Rank outcomes",
          "Recommend the best path",
        ]}
      />

      <DocSub>Confidence</DocSub>
      <DocBody>
        Confidence signals how strongly the evaluation supports a given future
        relative to alternatives and available evidence. Use confidence as a
        guide — not a guarantee — especially when knowledge is incomplete.
      </DocBody>

      <DocSub>Trade-offs</DocSub>
      <DocBody>
        Every strong path has costs. Chronos surfaces trade-offs so you can see
        what you gain and what you give up (speed, risk, capital, focus, or
        optionality).
      </DocBody>

      <DocSub>Decision reports</DocSub>
      <DocBody>
        After a run, open the decision report for the recommended path, ranked
        alternatives, risks, and reasoning. Reports are saved so you can return
        later or compare versions.
      </DocBody>

      <Callout tone="info" title="Core loop">
        Goal → context → multiple futures → trade-offs → ranking → recommendation.
        Re-run when goals or knowledge change.
      </Callout>
    </div>
  );
}

// ============================================================
// Timeline
// ============================================================

function TimelineDocs() {
  return (
    <div>
      <DocTitle>Timeline</DocTitle>
      <DocBody>
        The timeline is how you inspect futures after a simulation — not as a
        chat transcript, but as ranked paths you can compare over time.
      </DocBody>

      <DocSub>Timeline view</DocSub>
      <DocBody>
        The timeline presents the goal and the set of generated futures as cards
        or nodes you can open. Each future includes summary, risk, confidence,
        and next steps.
      </DocBody>

      <DocSub>Future comparison</DocSub>
      <DocBody>
        Compare alternatives side by side: which path maximizes upside, which
        protects runway, which is fastest. Comparison is how Chronos helps you
        decide — not just generate options.
      </DocBody>

      <DocSub>Version history</DocSub>
      <DocBody>
        Simulations are versioned as context evolves. Revisit earlier versions
        of a decision to see how recommendations changed when goals, knowledge,
        or constraints shifted.
      </DocBody>

      <DocSub>Re-running simulations</DocSub>
      <DocBody>
        Re-run when you add knowledge, tighten constraints, or revise the goal.
        New runs keep lineage so you can track how the decision space moved.
      </DocBody>
    </div>
  );
}

// ============================================================
// Memory
// ============================================================

function MemoryDocs() {
  return (
    <div>
      <DocTitle>Memory</DocTitle>
      <DocBody>
        Memory is what makes Chronos cumulative. Past simulations and decisions
        stay attached to the workspace so you do not start from zero every time.
      </DocBody>

      <DocSub>Simulation history</DocSub>
      <DocBody>
        Every simulation is saved. Browse prior runs, reopen details, and see
        how recommendations evolved across versions.
      </DocBody>

      <DocSub>Saved reports</DocSub>
      <DocBody>
        Decision reports remain available after a run. Use them for reviews,
        stakeholder updates, or as context for the next simulation.
      </DocBody>

      <DocSub>Decision history</DocSub>
      <DocBody>
        Over time, the workspace becomes a record of what you considered, what
        you preferred, and why — useful for audits, retros, and learning.
      </DocBody>

      <DocSub>Workspace continuity</DocSub>
      <DocBody>
        Goals, knowledge, timeline, and memory stay connected. That continuity is
        the difference between a one-off AI answer and an evolving decision
        system.
      </DocBody>
    </div>
  );
}

// ============================================================
// Decision Reports
// ============================================================

function DecisionReportsDocs() {
  return (
    <div>
      <DocTitle>Decision reports</DocTitle>
      <DocBody>
        A decision report is the packaged outcome of a simulation: the
        recommended path, why it won, what alternatives were close, and what
        risks remain.
      </DocBody>

      <TopicList
        items={[
          {
            title: "Recommendation",
            body: "The strongest path ranked against your goal, priorities, and constraints.",
          },
          {
            title: "Reasoning",
            body: "Supporting rationale so you can inspect why Chronos preferred one future.",
          },
          {
            title: "Trade-offs",
            body: "What you gain and what you give up relative to other futures.",
          },
          {
            title: "Risks & confidence",
            body: "Where uncertainty remains and how strongly the ranking is supported.",
          },
          {
            title: "Next steps",
            body: "Concrete actions suggested by the winning path so you can execute.",
          },
          {
            title: "Persistence",
            body: "Reports stay in memory for comparison, re-runs, and decision history.",
          },
        ]}
      />

      <Callout tone="tip" title="How to use a report">
        Share the report with stakeholders, challenge weak assumptions with new
        knowledge, then re-run if the ranking still feels fragile.
      </Callout>
    </div>
  );
}

// ============================================================
// API (Coming Soon)
// ============================================================

function ApiDocs() {
  return (
    <div>
      <DocTitle>
        API{" "}
        <span className="align-middle font-mono text-[12px] uppercase tracking-[0.2em] text-ink-faint">
          Coming soon
        </span>
      </DocTitle>
      <DocBody>
        A public API is planned so you can drive Chronos programmatically —
        run simulations, manage workspaces and knowledge, and read timelines from
        your own tools. This page is a directional preview, not a live contract.
      </DocBody>

      <Callout tone="warn" title="Status">
        Endpoints below are illustrative. Paths, payloads, and auth details will
        be finalized when the API ships. Join the private beta for product access
        today; API & SDK are on the roadmap.
      </Callout>

      <DocSub>Planned endpoints</DocSub>
      <div className="mt-4 space-y-3">
        <Endpoint
          method="POST"
          path="/simulate"
          desc="Start a simulation for a workspace goal with optional constraints and knowledge scope."
        />
        <Endpoint
          method="GET"
          path="/workspaces"
          desc="List workspaces available to the authenticated account."
        />
        <Endpoint
          method="POST"
          path="/knowledge"
          desc="Upload or register knowledge sources (documents, notes, URLs) into a workspace library."
        />
        <Endpoint
          method="GET"
          path="/timeline"
          desc="Fetch timeline futures, rankings, and version history for a simulation."
        />
      </div>

      <DocSub>Example (illustrative)</DocSub>
      <Code lang="http">{`POST /simulate
Authorization: Bearer <token>
Content-Type: application/json

{
  "workspace_id": "ws_...",
  "goal": "Reach $50k MRR in 12 months",
  "constraints": ["budget <= 1000000", "team_size <= 8"]
}`}</Code>

      <DocBody>
        When the API launches, this section will expand into auth, rate limits,
        SDKs, and full request/response schemas.
      </DocBody>
    </div>
  );
}

// ============================================================
// Roadmap
// ============================================================

function RoadmapDocs() {
  return (
    <div>
      <DocTitle>Roadmap</DocTitle>
      <DocBody>
        Chronos ships in focused phases. Below is what is available now versus
        what is planned — so you can trust the product status, not marketing
        blur.
      </DocBody>

      <DocSub>Available now</DocSub>
      <TopicList
        items={[
          {
            title: "Workspaces",
            body: "Private workspace HQ for goals, knowledge, and decision continuity.",
          },
          {
            title: "Knowledge Library",
            body: "PDFs, markdown, notes, and URL import with search.",
          },
          {
            title: "Simulations",
            body: "Multi-future generation, evaluation, ranking, and recommendations.",
          },
          {
            title: "Timeline",
            body: "Inspect and compare futures with versioned runs.",
          },
          {
            title: "Decision reports",
            body: "Saved reports with reasoning, risks, confidence, and next steps.",
          },
        ]}
      />

      <DocSub>Planned</DocSub>
      <TopicList
        items={[
          {
            title: "Team collaboration",
            body: "Shared workspaces and multi-user decision workflows.",
          },
          {
            title: "API & SDK",
            body: "Programmatic simulate, knowledge, workspace, and timeline access.",
          },
          {
            title: "Enterprise features",
            body: "Org controls, admin tooling, and deployment options for larger teams.",
          },
          {
            title: "CLAB integration",
            body: "Ecosystem-level access, incentives, and coordination capabilities.",
          },
          {
            title: "Advanced analytics",
            body: "Deeper cross-run analysis and decision performance insights.",
          },
        ]}
      />

      <Callout tone="info" title="Product status">
        Chronos is in active development and private beta. See the{" "}
        <Link to="/roadmap" className="text-chronos underline-offset-2 hover:underline">
          public roadmap
        </Link>{" "}
        and{" "}
        <Link to="/changelog" className="text-chronos underline-offset-2 hover:underline">
          changelog
        </Link>{" "}
        for shipping notes.
      </Callout>
    </div>
  );
}

// ============================================================
// Security & Privacy
// ============================================================

function SecurityDocs() {
  return (
    <div>
      <DocTitle>Security & privacy</DocTitle>
      <DocBody>
        Users will trust Chronos with important information. This section
        documents how we think about storage, encryption, authentication,
        ownership, and privacy.
      </DocBody>

      <DocSub>Data storage</DocSub>
      <DocBody>
        Workspace data — goals, knowledge, simulations, timelines, and reports —
        is stored in your private workspace environment. Product data is not
        treated as a public feed.
      </DocBody>

      <DocSub>Encryption</DocSub>
      <DocBody>
        Data is protected in transit (TLS) and at rest using modern encryption
        practices. Secrets such as AI provider keys are kept server-side (for
        example via edge functions) and are not exposed to the browser.
      </DocBody>

      <DocSub>Authentication</DocSub>
      <DocBody>
        Access requires an authenticated session (magic link / password sign-in).
        Workspace routes are protected so only signed-in users can reach private
        product surfaces.
      </DocBody>

      <DocSub>Privacy policy</DocSub>
      <DocBody>
        Our privacy policy describes what we collect, how we use it, retention,
        and your rights. Read the full policy on the privacy page.
      </DocBody>
      <div className="mt-4">
        <Link
          to="/privacy"
          className="text-[13px] text-chronos underline-offset-2 hover:underline"
        >
          Privacy policy →
        </Link>
      </div>

      <DocSub>Data ownership</DocSub>
      <DocBody>
        You retain rights to the content you submit. Chronos processes it to
        operate the product and run simulations. We do not sell your data. See
        Terms for the legal framing of service use.
      </DocBody>
      <div className="mt-4 flex flex-wrap gap-4">
        <Link
          to="/terms"
          className="text-[13px] text-chronos underline-offset-2 hover:underline"
        >
          Terms of service →
        </Link>
        <Link
          to="/security"
          className="text-[13px] text-chronos underline-offset-2 hover:underline"
        >
          Security overview →
        </Link>
      </div>

      <Callout tone="warn" title="Security reports">
        If you discover a vulnerability, contact us privately through our
        support channels. Do not post exploit details publicly.
      </Callout>
    </div>
  );
}

// ============================================================
// Support
// ============================================================

function SupportDocs() {
  return (
    <div>
      <DocTitle>Support</DocTitle>
      <DocBody>
        Need help, found a bug, or want to request a feature? Use the channels
        below. We read every message.
      </DocBody>

      <TopicList
        items={[
          {
            title: "Contact",
            body: "General questions and private beta support via our contact page.",
          },
          {
            title: "X (Twitter)",
            body: "@chronoslabspace — product updates and public conversation.",
          },
          {
            title: "Telegram",
            body: "Community group for early users, shipping notes, and discussion.",
          },
          {
            title: "FAQ",
            body: "Short answers on Chronos, simulations, workspaces, and CLAB.",
          },
          {
            title: "Bug reports",
            body: "Describe steps to reproduce, expected vs. actual behavior, and workspace context.",
          },
          {
            title: "Feature requests",
            body: "Tell us the decision problem you are trying to solve — not only the UI control you want.",
          },
        ]}
      />

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg transition hover:bg-chronos"
        >
          Contact
        </Link>
        <Link
          to="/faq"
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
        >
          FAQ
        </Link>
        <a
          href="https://x.com/chronoslabspace"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
        >
          X
        </a>
        <a
          href="https://t.me/+I9MN0GfvgwllZGRh"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
        >
          Telegram
        </a>
      </div>

      <Callout tone="info" title="GitHub & Discord">
        Public GitHub issues and Discord will be linked here when community
        channels open. Until then, use Contact, Telegram, or X.
      </Callout>
    </div>
  );
}
