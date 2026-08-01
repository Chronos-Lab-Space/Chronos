import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "./PageHeader";

type Section =
  | "introduction"
  | "how-it-works"
  | "getting-started"
  | "auth"
  | "beta"
  | "faq"
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
      { id: "how-it-works", label: "How it works" },
      { id: "getting-started", label: "Getting started" },
      { id: "auth", label: "Auth & access" },
      { id: "beta", label: "Public beta" },
      { id: "faq", label: "FAQ" },
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
  const section: Section = isKnownSection ? (requestedSection as Section) : "introduction";

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
        subtitle="What Chronos is, how branch → simulate → collapse works, beta limits, and how to run your first decision."
      />

      <section className="relative">
        <div className="mx-auto max-w-[1400px] px-6 py-6 lg:px-10">
          {/* Mobile: horizontal nav strip */}
          <div className="mb-6 lg:hidden">
            <div
              className="-mx-6 flex gap-1.5 overflow-x-auto overscroll-x-contain px-6 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
              role="tablist"
              aria-label="Documentation sections"
            >
              {NAV.flatMap((g) =>
                g.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={section === item.id}
                    onClick={() => selectSection(item.id)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 font-mono text-[11px] transition ${
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
                              type="button"
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

            {/* Content */}
            <main className="min-w-0 lg:col-span-9">
              {section === "introduction" && <Introduction />}
              {section === "how-it-works" && <HowItWorksDocs />}
              {section === "getting-started" && <GettingStarted />}
              {section === "auth" && <AuthAccessDocs />}
              {section === "beta" && <BetaLimitationsDocs />}
              {section === "faq" && <DocsFaq />}
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
    <h3 className="mt-10 border-t border-line pt-6 font-serif text-xl text-ink">{children}</h3>
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
  tone?: "info" | "warn" | "tip" | "note";
  title?: string;
  children: React.ReactNode;
}) {
  const colors = {
    info: "border-chronos/30 bg-chronos/5 text-chronos",
    warn: "border-rose-400/30 bg-rose-400/5 text-rose-400",
    tip: "border-accent-warm/30 bg-accent-warm/5 text-accent-warm",
    note: "border-line bg-bg-soft/80 text-ink-dim",
  }[tone];
  return (
    <div className={`mt-6 rounded-lg border p-4 ${colors}`}>
      {title && (
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.25em]">{title}</div>
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
        Chronos is a decision intelligence platform. You bring a goal and context; Chronos generates
        multiple possible futures, compares trade-offs, and recommends a path — with transparent
        reasons, not a single opaque answer.
      </DocBody>

      <DocSub>The problem</DocSub>
      <DocBody>
        Most AI tools return one reply. High-stakes choices need options: risk vs speed, upside vs
        dependencies, confidence vs uncertainty. Chronos is built so you can see those trade-offs
        before you commit.
      </DocBody>

      <DocSub>What you get</DocSub>
      <TopicList
        items={[
          {
            title: "Multiple futures",
            body: "Ranked paths with confidence, risk, and distinctive hooks (Fastest path, Lower risk, Highest upside).",
          },
          {
            title: "Transparent evidence",
            body: "Every recommendation lists evidence — risk, fit to objective, dependencies, expected success, knowledge grounding.",
          },
          {
            title: "Decision Report",
            body: "The keepable artifact: Goal · Recommendation · Confidence · Evidence · Trade-offs · Risks · Next steps — copy or download as markdown.",
          },
          {
            title: "Persistent memory",
            body: "Goals, simulations, decisions, knowledge, and outcomes stay when you leave and return.",
          },
        ]}
      />

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
            body: "A run that branches futures, scores them, and collapses to a recommendation.",
          },
          {
            title: "Timeline",
            body: "Ranked futures you can compare, choose, and save.",
          },
          {
            title: "Memory",
            body: "History of goals, runs, decisions, and outcomes — Chronos’ durable advantage.",
          },
        ]}
      />

      <DocSub>Decision loop</DocSub>
      <FlowSteps
        steps={[
          "Create workspace",
          "Set goal",
          "Add knowledge",
          "Generate futures",
          "Decision Report (keepable)",
          "Compare · save path",
          "Log outcome",
        ]}
      />

      <Callout tone="tip" title="Start here">
        Read{" "}
        <Link
          to="/docs?section=how-it-works"
          className="text-chronos underline-offset-2 hover:underline"
        >
          How it works
        </Link>{" "}
        for branch → simulate → collapse, then{" "}
        <Link
          to="/docs?section=getting-started"
          className="text-chronos underline-offset-2 hover:underline"
        >
          Getting started
        </Link>
        . Beta limits are listed under{" "}
        <Link to="/docs?section=beta" className="text-chronos underline-offset-2 hover:underline">
          Beta limitations
        </Link>
        .
      </Callout>
    </div>
  );
}

// ============================================================
// How it works — branch → simulate → collapse
// ============================================================

function HowItWorksDocs() {
  return (
    <div>
      <DocTitle>How it works</DocTitle>
      <DocBody>
        Chronos does not answer in one shot. It runs a three-phase loop —
        <strong className="text-ink"> branch → simulate → collapse</strong> — so every
        recommendation is grounded in compared alternatives.
      </DocBody>

      <DocSub>Branch</DocSub>
      <DocBody>
        From your goal, knowledge, and constraints, Chronos generates multiple plausible futures
        (strategies). Each future is a distinct path: different pace, risk, dependencies, and
        upside.
      </DocBody>

      <DocSub>Simulate</DocSub>
      <DocBody>
        Each branch is evaluated against your objective and constraints. The engine scores success
        likelihood, risk, and confidence, and surfaces trade-offs — what you gain and what you give
        up relative to other futures.
      </DocBody>

      <DocSub>Collapse</DocSub>
      <DocBody>
        Futures are ranked and collapsed into a Decision Report: recommendation, confidence,
        evidence, trade-offs, risks, and next steps. You still choose which path to save — Chronos
        recommends; you decide.
      </DocBody>

      <FlowSteps
        steps={[
          "Branch (generate futures)",
          "Simulate (score & trade-offs)",
          "Collapse (rank & recommend)",
        ]}
      />

      <DocSub>Why this builds trust</DocSub>
      <DocBody>Every Decision Report includes an Evidence section. Typical bullets:</DocBody>
      <ul className="mt-4 space-y-2 text-[15px] text-ink">
        {[
          "lowest execution risk",
          "fits your stated objective",
          "requires fewer dependencies",
          "highest expected success",
          "grounded in your knowledge sources",
        ].map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className="text-chronos">•</span>
            {item}
          </li>
        ))}
      </ul>

      <Callout tone="note" title="Not a black box">
        If Chronos cannot explain a recommendation relative to alternatives and your goal, it is not
        finished product behavior. Comparison is the product.
      </Callout>
    </div>
  );
}

// ============================================================
// Auth & access (public beta)
// ============================================================

function AuthAccessDocs() {
  return (
    <div>
      <DocTitle>Auth & access</DocTitle>
      <DocBody>
        Public beta authentication is designed for speed: land, sign in with Google or GitHub, and
        reach a Decision Workspace without a tutorial maze.
      </DocBody>

      <DocSub>User flow</DocSub>
      <FlowSteps
        steps={[
          "Landing → Get started",
          "Google / GitHub (or email)",
          "Supabase Auth session (JWT)",
          "Create profile",
          "Create personal workspace + owner membership",
          "Ask: What are you trying to decide?",
          "Run first simulation → Dashboard",
        ]}
      />

      <DocSub>Data model</DocSub>
      <TopicList
        items={[
          { title: "auth.users", body: "Supabase Auth identity (Google, GitHub, email)." },
          { title: "profiles", body: "Display name, avatar, preferences, onboarded_at." },
          { title: "workspaces", body: "Private decision HQ; owner_id + memberships." },
          { title: "workspace_members", body: "Roles: owner, admin, member, viewer." },
          {
            title: "decisions",
            body: "First-class decision objects; simulations hang underneath as versions. One decision per simulation lineage — a re-run is v2 of the same question, not a new one.",
          },
          { title: "simulations / events", body: "Runs + product analytics events." },
        ]}
      />

      <DocSub>Request authorization</DocSub>
      <DocBody>
        Every workspace-scoped action should follow: verify JWT session → resolve user → load
        workspace → check membership (or owner) → execute. The browser app enforces this via
        ProtectedRoute + membership-aware RLS.
      </DocBody>

      <DocSub>Progress checklist</DocSub>
      <DocBody>
        Instead of a forced tour, Chronos unlocks progress as you act: connect LLM (optional),
        create first decision, run first simulation, save memory, share workspace.
      </DocBody>

      <Callout tone="note" title="Provider setup">
        Enable Google and GitHub under Supabase Auth → Providers. Add redirect URL{" "}
        <code className="text-chronos">https://your-host/auth/callback</code> (and localhost for
        dev). Apply migration{" "}
        <code className="text-chronos">20260721120000_public_beta_auth.sql</code>.
      </Callout>
    </div>
  );
}

// ============================================================
// Beta limitations
// ============================================================

function BetaLimitationsDocs() {
  return (
    <div>
      <DocTitle>Public beta</DocTitle>
      <DocBody>
        Chronos is decision infrastructure, not a chatbot. It explores multiple futures, scores
        trade-offs, and recommends a path — you still decide.
      </DocBody>

      <Callout tone="tip" title="Honest beta">
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink-dim">
          <li>
            <strong className="text-ink">You decide.</strong> Chronos recommends; Save decision is
            explicit and reviewable.
          </li>
          <li>
            <strong className="text-ink">Multi-future, honest N.</strong> Sample counts and
            disqualified paths match the engine — no padded “1000 paths.”
          </li>
          <li>
            <strong className="text-ink">Local-first cloud.</strong> If sync fails, work stays on
            this device; watch the cloud banner when present.
          </li>
          <li>
            <strong className="text-ink">Prefer Google / GitHub.</strong> Email signup may require
            confirmation before the workspace unlocks.
          </li>
        </ul>
      </Callout>

      <DocSub>Tester checklist (first session)</DocSub>
      <FlowSteps
        steps={[
          "Sign in with Google or GitHub",
          "Answer: What decision are you trying to make?",
          "Add one knowledge note or URL",
          "Run a simulation and open the Decision Report",
          "Review Recommendation → Evidence · Why · Expected value",
          "Save decision (choose a path), then log an outcome",
        ]}
      />
      <DocBody>
        Success = you can name the recommendation and the next step without hunting. If anything
        feels like a single chat answer, that is a bug in the product experience — tell us.
      </DocBody>

      <DocSub>Current limitations</DocSub>
      <TopicList
        items={[
          {
            title: "Simulation engine",
            body: "Workspace sims are a deterministic multi-future engine (EV scoring, hard/soft constraints). The public /simulate demo is honest Monte Carlo over strategy archetypes (sample counts match what was scored). Neither path is an LLM “thinking” about your company. Optional AI polish only rewrites recommendation prose when a provider is configured — scores stay engine-owned. Useful for structured decisions; not a calibrated model of markets or codebases.",
          },
          {
            title: "Agents & capabilities",
            body: "Forge / Oracle / Atlas on marketing pages are scripted scenario demos, not live LLM agents. The Agent OS registers real handlers for research (optional AI, else stub), simulation, evaluation, and memory; coding/plan steps are stubs in this beta. Prefer “deterministic multi-future engine” over “AI agents decide for you.”",
          },
          {
            title: "Hard constraints",
            body: "Hard constraints can disqualify futures (score 0). Soft constraints nudge ranking. Paths ruled out appear in risks when applicable.",
          },
          {
            title: "Knowledge (RAG-lite)",
            body: "Uploads, URLs, and notes ground rankings. Full semantic retrieval and large corpus search are still evolving.",
          },
          {
            title: "Collaboration",
            body: "Workspaces are private to your account. Multi-user sharing, roles, and comments are not the focus of this beta.",
          },
          {
            title: "API & automation",
            body: "Public API and CI-style automation are roadmap items. The product UI is the primary surface today.",
          },
          {
            title: "Outcome tracking",
            body: "Follow-through (Yes / Partially / No) and free-text outcomes are stored; they do not yet reweight the engine for the next run.",
          },
          {
            title: "Cloud dual-write",
            body: "Local-first with Supabase sync when signed in. If cloud fails, work stays on this device; fix env/grants and re-run for new sims. Future IDs are UUIDs for Postgres compatibility.",
          },
        ]}
      />

      <Callout tone="tip" title="What is solid today">
        Goal → Knowledge → Simulation → Decision Report → save path → log outcomes. That loop — and
        the keepable report — is the beta focus.
      </Callout>
    </div>
  );
}

// ============================================================
// Docs FAQ
// ============================================================

function DocsFaq() {
  const items: { q: string; a: string }[] = [
    {
      q: "What is Chronos?",
      a: "A decision intelligence workspace that explores multiple futures, compares trade-offs, and recommends a path with transparent reasons — plus durable memory of goals, runs, and outcomes.",
    },
    {
      q: "How is Chronos different from a chatbot?",
      a: "Chatbots usually return one answer. Chronos branches alternatives, simulates trade-offs, collapses to a ranked recommendation, and keeps Decision Reports and history you can reopen later.",
    },
    {
      q: "What does branch → simulate → collapse mean?",
      a: "Branch generates multiple futures; simulate scores them against your goal and constraints; collapse ranks them into a recommendation and Decision Report you can share and save.",
    },
    {
      q: "Why should I trust a recommendation?",
      a: "Every report includes Evidence (risk, fit to objective, dependencies, expected success, knowledge grounding) plus trade-offs, confidence, and risks — so you can disagree with receipts.",
    },
    {
      q: "What is a Decision Report?",
      a: "The keepable product artifact: Goal · Recommendation · Confidence · Evidence · Trade-offs · Risks · Next steps. Copy or download as markdown from the workspace.",
    },
    {
      q: "Does Chronos remember past work?",
      a: "Yes. Goals, simulations, saved paths, knowledge, and outcomes persist locally and dual-write to Supabase when signed in. Simulation history is grouped Today / Yesterday / Last week.",
    },
    {
      q: "Is Chronos production-ready?",
      a: "It is public beta. The core decision loop is usable; see Public beta for the tester checklist and known edges (engine depth, collab, API, etc.).",
    },
    {
      q: "Does Chronos use an LLM for every recommendation?",
      a: "No. Ranking is deterministic by default. Optional AI polish (env-only) may rewrite recommendation wording; scores and futures stay engine-owned.",
    },
    {
      q: "Who is it for?",
      a: "Founders, PMs, researchers, and teams making high-stakes choices where one-shot answers are not enough.",
    },
  ];

  return (
    <div>
      <DocTitle>Frequently asked questions</DocTitle>
      <DocBody>
        Short answers for product understanding. A longer public FAQ also lives at{" "}
        <Link to="/faq" className="text-chronos underline-offset-2 hover:underline">
          /faq
        </Link>
        .
      </DocBody>
      <div className="mt-8 space-y-6">
        {items.map((item, i) => (
          <div key={item.q} className="border-b border-line pb-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
              {String(i + 1).padStart(2, "0")}
            </div>
            <h3 className="mt-2 font-serif text-xl text-ink">{item.q}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-dim">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Getting Started
// ============================================================

function GettingStarted() {
  return (
    <div>
      <DocTitle>Getting started</DocTitle>
      <DocBody>
        This is the shortest path from zero to a recommendation. Public beta is open — create an
        account to unlock the full Decision Workspace.
      </DocBody>

      <FlowSteps
        steps={[
          "Join public beta (prefer Google / GitHub)",
          "What decision are you trying to make?",
          "Add knowledge",
          "Generate futures",
          "Review Decision Report (Evidence · Why · Expected value)",
          "Save decision · log outcome",
        ]}
      />

      <DocSub>1. Join public beta</DocSub>
      <DocBody>
        From the landing page choose <strong className="text-ink">Join public beta</strong>. No
        account is needed to start: Chronos creates a workspace on this device and takes you
        straight to the decision. Signing in is how work becomes durable, not how it begins.
      </DocBody>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/workspace"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg transition hover:bg-chronos"
        >
          Join public beta
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
        >
          Sign in
        </Link>
      </div>

      <DocSub>2. State the decision</DocSub>
      <DocBody>
        One field: what are you deciding? Submitting runs the simulation — Chronos scores strategy
        futures against an honest sample budget and opens the Decision Report. An objective the
        catalog cannot model is refused rather than answered confidently.
      </DocBody>

      <DocSub>3. Keep the Decision Report</DocSub>
      <DocBody>
        The report is the product: Goal · Recommendation · Confidence · Evidence · Trade-offs ·
        Risks · Next steps. Copy or download markdown, choose a path to save, then log whether you
        followed it and how it turned out.
      </DocBody>

      <DocSub>4. Add context, once you have something to argue with</DocSub>
      <DocBody>
        Under the report, add a note or import a source — facts, constraints, assumptions. Chronos
        weighs them on the next run. Optional, asked once per decision, and dismissible.
      </DocBody>

      <DocSub>5. Sign in to save</DocSub>
      <DocBody>
        Until you sign in, the workspace lives on this device only. Signing in claims the work you
        have already done and makes it durable across devices.
      </DocBody>

      <Callout tone="info" title="First simulation checklist">
        State the decision · run · leave with a report you can keep. Context and an account are
        additions, not prerequisites.
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
        A workspace is where your goals, knowledge, simulations, and decision history live. Treat it
        as the home base for a decision domain — not a one-off chat thread.
      </DocBody>

      <DocSub>Creating workspaces</DocSub>
      <DocBody>
        Create a workspace after sign-in. Give it a clear name that reflects the decision surface
        (for example, “Series A strategy” or “Product launch Q3”). You can open it anytime from the
        workspace dashboard.
      </DocBody>

      <DocSub>Managing goals</DocSub>
      <DocBody>
        Each workspace holds active goals. Goals drive simulations: when you run a simulation,
        Chronos uses the current goal plus knowledge and constraints. Update goals as strategy
        shifts rather than starting from scratch every time.
      </DocBody>

      <DocSub>Organization</DocSub>
      <DocBody>
        Keep one workspace per major decision domain when possible. That keeps knowledge, simulation
        history, and memory coherent. Use notes and clear goal titles so future you can find the
        right context quickly.
      </DocBody>

      <DocSub>Settings</DocSub>
      <DocBody>
        Workspace settings cover identity and configuration for your private environment. Use
        settings to review workspace details and keep your decision space tidy as the product grows.
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
        Goals define what Chronos optimizes for. A strong goal is specific enough to rank futures,
        but open enough to explore more than one strategy.
      </DocBody>

      <DocSub>Creating goals</DocSub>
      <DocBody>
        Write the outcome you want in plain language. Example: “Reach $50k MRR in 12 months without
        raising more than $1M.” Avoid vague goals like “grow the business.”
      </DocBody>

      <DocSub>Goal priorities</DocSub>
      <DocBody>
        Priorities tell Chronos what matters most when futures conflict — speed vs. risk, growth vs.
        runway, quality vs. cost. State ranked priorities so trade-offs can be scored consistently.
      </DocBody>

      <DocSub>Constraints</DocSub>
      <DocBody>
        Constraints are hard or soft limits: budget caps, team size, deadlines, regulatory
        requirements, or “must not do X.” Clear constraints reduce unrealistic futures and improve
        recommendation quality.
      </DocBody>

      <DocSub>Success criteria</DocSub>
      <DocBody>
        Define how you will know a path worked. Criteria can be metrics (revenue, retention),
        milestones (shipped feature, signed pilot), or qualitative outcomes (team capacity
        preserved). These become the yardstick for ranking.
      </DocBody>

      <Callout tone="tip" title="Goal quality tip">
        Better inputs → better futures. Spend five minutes on priorities and constraints before you
        run a large simulation.
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
        The Knowledge Library stores documents, notes, and web resources that provide context for
        simulations. Chronos is only as grounded as the material you give it.
      </DocBody>

      <DocSub>Upload PDF</DocSub>
      <DocBody>
        Upload PDFs such as pitch decks, research reports, contracts summaries, or strategy memos.
        Use them when the source of truth lives in a document you already have.
      </DocBody>

      <DocSub>Markdown</DocSub>
      <DocBody>
        Import markdown files for specs, READMEs, and structured notes. Markdown is ideal for
        technical context and product definitions.
      </DocBody>

      <DocSub>Notes</DocSub>
      <DocBody>
        Write lightweight notes inside the workspace. Capture assumptions, interview takeaways, or
        decision constraints that do not yet live in a formal document.
      </DocBody>

      <DocSub>URL import</DocSub>
      <DocBody>
        Import web resources and public GitHub README content when external context matters — market
        pages, competitor pages, or product docs.
      </DocBody>

      <DocSub>Search</DocSub>
      <DocBody>
        Search the library by keywords to find the right source before a run. Keep titles
        descriptive so search stays useful as the library grows.
      </DocBody>

      <DocSub>Organization</DocSub>
      <DocBody>
        Prefer fewer high-signal sources over dumping everything. Group related notes, retire
        outdated material, and refresh knowledge when the world changes — then re-run simulations.
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
        Simulations are the core of Chronos. Each run takes your goal, context, and constraints,
        then explores multiple futures instead of producing a single answer.
      </DocBody>

      <DocSub>Inputs</DocSub>
      <DocBody>
        Primary inputs are the active goal, knowledge library content, and any explicit constraints
        or success criteria. Richer, cleaner inputs produce more actionable recommendations.
      </DocBody>

      <DocSub>Constraints</DocSub>
      <DocBody>
        Constraints bound the search space. They prevent futures that violate hard rules (budget,
        time, policy) and help the ranking step prefer realistic paths.
      </DocBody>

      <DocSub>How futures are generated</DocSub>
      <DocBody>
        Chronos generates multiple candidate strategies from your goal and context. Each future is a
        coherent path: what you might do, what could happen, and what trade-offs come with that
        path.
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
        Confidence signals how strongly the evaluation supports a given future relative to
        alternatives and available evidence. Use confidence as a guide — not a guarantee —
        especially when knowledge is incomplete.
      </DocBody>

      <DocSub>Trade-offs</DocSub>
      <DocBody>
        Every strong path has costs. Chronos surfaces trade-offs so you can see what you gain and
        what you give up (speed, risk, capital, focus, or optionality).
      </DocBody>

      <DocSub>Decision reports</DocSub>
      <DocBody>
        After a run, open the decision report for the recommended path, ranked alternatives, risks,
        and reasoning. Reports are saved so you can return later or compare versions.
      </DocBody>

      <Callout tone="info" title="Core loop">
        Goal → context → multiple futures → trade-offs → ranking → recommendation. Re-run when goals
        or knowledge change.
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
        The timeline is how you inspect futures after a simulation — not as a chat transcript, but
        as ranked paths you can compare over time.
      </DocBody>

      <DocSub>Timeline view</DocSub>
      <DocBody>
        The timeline presents the goal and the set of generated futures as cards or nodes you can
        open. Each future includes summary, risk, confidence, and next steps.
      </DocBody>

      <DocSub>Future comparison</DocSub>
      <DocBody>
        Chronos does not return a single answer. Each ranked future gets a distinctive hook —
        Fastest path, Lower risk, or Highest upside — with confidence so you can see trade-offs at a
        glance. Comparison is the product: decide which future fits, then save it to the timeline.
      </DocBody>

      <DocSub>Version history</DocSub>
      <DocBody>
        Simulations are versioned as context evolves. Revisit earlier versions of a decision to see
        how recommendations changed when goals, knowledge, or constraints shifted.
      </DocBody>

      <DocSub>Re-running simulations</DocSub>
      <DocBody>
        Re-run when you add knowledge, tighten constraints, or revise the goal. New runs keep
        lineage so you can track how the decision space moved.
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
        Memory is what makes Chronos cumulative. Past simulations and decisions stay attached to the
        workspace so you do not start from zero every time.
      </DocBody>

      <DocSub>Simulation history</DocSub>
      <DocBody>
        Every simulation is saved. Browse prior runs, reopen details, and see how recommendations
        evolved across versions.
      </DocBody>

      <DocSub>Saved reports</DocSub>
      <DocBody>
        Decision reports remain available after a run. Use them for reviews, stakeholder updates, or
        as context for the next simulation.
      </DocBody>

      <DocSub>Decision history</DocSub>
      <DocBody>
        Over time, the workspace becomes a record of what you considered, what you preferred, and
        why — useful for audits, retros, and learning.
      </DocBody>

      <DocSub>Workspace continuity</DocSub>
      <DocBody>
        Goals, knowledge, timeline, and memory stay connected. That continuity is the difference
        between a one-off AI answer and an evolving decision system.
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
        The Decision Report is the <strong className="text-ink">product centerpiece</strong> — the
        keepable artifact after simulation. It is not a chat reply. Dashboard HQ and simulation
        detail both lead with the report so you leave with something you can copy, download, and
        reopen.
      </DocBody>

      <TopicList
        items={[
          {
            title: "Goal",
            body: "The decision surface — usually your active workspace goal.",
          },
          {
            title: "Recommendation",
            body: "The ranked path to commit (or the path you already saved).",
          },
          {
            title: "Confidence",
            body: "How strongly the ranking is supported (0–100%).",
          },
          {
            title: "Evidence",
            body: "Why this path: risk, fit to objective, dependencies, expected success, knowledge grounding — plus supporting detail.",
          },
          {
            title: "Trade-offs",
            body: "What each future gains or gives up vs the ranked best, including Future A★ / B / C cards.",
          },
          {
            title: "Risks",
            body: "Where uncertainty remains, including hard constraints and disqualified paths when relevant.",
          },
          {
            title: "Next steps",
            body: "What to do next — save path, log follow-through, or re-run with tighter constraints.",
          },
        ]}
      />

      <Callout tone="tip" title="How to use a report">
        Copy or download markdown, share with stakeholders, challenge weak assumptions with new
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
        A public API is planned so you can drive Chronos programmatically — run simulations, manage
        workspaces and knowledge, and read timelines from your own tools. This page is a directional
        preview, not a live contract.
      </DocBody>

      <Callout tone="warn" title="Status">
        Endpoints below are illustrative. Paths, payloads, and auth details will be finalized when
        the API ships. Join the public beta for product access today; API & SDK are on the roadmap.
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
        When the API launches, this section will expand into auth, rate limits, SDKs, and full
        request/response schemas.
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
        Chronos ships in focused phases. Below is what is available now versus what is planned — so
        you can trust the product status, not marketing blur.
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
        Chronos is in active development and public beta. See the{" "}
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
        Users will trust Chronos with important information. This section documents how we think
        about storage, encryption, authentication, ownership, and privacy.
      </DocBody>

      <DocSub>Data storage</DocSub>
      <DocBody>
        Workspace data — goals, knowledge, simulations, timelines, and reports — is stored in your
        private workspace environment. Product data is not treated as a public feed.
      </DocBody>

      <DocSub>Encryption</DocSub>
      <DocBody>
        Data is protected in transit (TLS) and at rest using modern encryption practices. Secrets
        such as AI provider keys are kept server-side (for example via edge functions) and are not
        exposed to the browser.
      </DocBody>

      <DocSub>Authentication</DocSub>
      <DocBody>
        Access requires an authenticated session (magic link / password sign-in). Workspace routes
        are protected so only signed-in users can reach private product surfaces.
      </DocBody>

      <DocSub>Privacy policy</DocSub>
      <DocBody>
        Our privacy policy describes what we collect, how we use it, retention, and your rights.
        Read the full policy on the privacy page.
      </DocBody>
      <div className="mt-4">
        <Link to="/privacy" className="text-[13px] text-chronos underline-offset-2 hover:underline">
          Privacy policy →
        </Link>
      </div>

      <DocSub>Data ownership</DocSub>
      <DocBody>
        You retain rights to the content you submit. Chronos processes it to operate the product and
        run simulations. We do not sell your data. See Terms for the legal framing of service use.
      </DocBody>
      <div className="mt-4 flex flex-wrap gap-4">
        <Link to="/terms" className="text-[13px] text-chronos underline-offset-2 hover:underline">
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
        If you discover a vulnerability, contact us privately through our support channels. Do not
        post exploit details publicly.
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
        Need help, found a bug, or want to request a feature? Use the channels below. We read every
        message.
      </DocBody>

      <TopicList
        items={[
          {
            title: "Contact",
            body: "General questions and public beta support via our contact page.",
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
        Public GitHub issues and Discord will be linked here when community channels open. Until
        then, use Contact, Telegram, or X.
      </Callout>
    </div>
  );
}
