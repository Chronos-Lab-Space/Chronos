import { PageHeader } from "./PageHeader";

export type Release = {
  version: string;
  date: string;
  tag: "major" | "minor" | "patch";
  title: string;
  summary: string;
  highlights: { label: string; detail: string }[];
};

const releases: Release[] = [
  {
    version: "4.5.0",
    date: "2026-07-15",
    tag: "minor",
    title: "Grok workspace advisor",
    summary:
      "Grok (xAI) is wired into the private workspace through a Supabase Edge Function proxy. Advisors and simulation briefs stay grounded in goal, knowledge, and run history — API keys never reach the browser.",
    highlights: [
      { label: "Grok", detail: "Authenticated Edge Function grok → api.x.ai chat completions (model grok-4.5)" },
      { label: "Advisor", detail: "/workspace/advisor chat with workspace context attached" },
      { label: "Reports", detail: "Enhance with Grok on simulation detail for executive brief + 7-day plan" },
      { label: "Security", detail: "XAI_API_KEY stored as function secret; JWT required" },
    ],
  },
  {
    version: "4.4.0",
    date: "2026-07-15",
    tag: "minor",
    title: "Private workspace MVP",
    summary:
      "A usable path from sign-in to cumulative decisions: workspace HQ, knowledge library, simulation engine, future cards, and versioned memory—each gate shippable before the next, without building a full Workspace OS upfront.",
    highlights: [
      { label: "HQ", detail: "Authenticated /workspace dashboard: goal, quick actions, recent runs, knowledge summary, MVP progress rail" },
      { label: "Schema", detail: "Supabase tables for workspaces, goals, simulations, futures, knowledge, notes, timeline_nodes (+ RLS)" },
      { label: "Knowledge", detail: "RAG-lite library: PDF/MD/TXT upload, website & GitHub README import, markdown notes, keyword search" },
      { label: "Engine", detail: "Plan → generate → evaluate → rank → best future; five ranked futures, risks, confidence, pipeline tasks" },
      { label: "Timeline", detail: "Card timeline (not a graph): Goal → Future A ⭐ … D; click for summary, risk, confidence, next steps" },
      { label: "Memory", detail: "Every run saved with lineage versions (v1/v2/v3); reopen report, re-run, compare across sessions" },
      { label: "Auth", detail: "BrowserRouter + magic-link callback + password sign-in; sessions persist; GH Pages SPA 404 fallback" },
    ],
  },
  {
    version: "4.3.0",
    date: "2026-07-08",
    tag: "minor",
    title: "Workspace intelligence",
    summary:
      "Chronos workspaces now retain the evidence behind decisions. Successful futures feed the next plan; recurring failure patterns become guardrails instead of being forgotten after a run.",
    highlights: [
      { label: "Workspace", detail: "knowledge graph links assumptions, simulations, outcomes, and recurring patterns" },
      { label: "Memory", detail: "validated winning futures are promoted into reusable planning evidence" },
      { label: "Guardrails", detail: "repeated failure signals are derived into recommended constraints for future plans" },
      { label: "Access", detail: "private workspace preview replaces public runtime execution while Cohort 04 is onboarded" },
    ],
  },
  {
    version: "4.2.1",
    date: "2026-06-18",
    tag: "patch",
    title: "Temporal task graph",
    summary:
      "Chronos now decomposes objectives into dependency-aware task graphs, resolves registered capabilities, and ranks timeline outcomes without requiring users to choose individual agents.",
    highlights: [
      { label: "Planner", detail: "Launch startup decomposes into research, market, roadmap, adoption, financial, and risk tasks" },
      { label: "Runtime", detail: "capability registration replaces engine-owned named agents" },
      { label: "Timeline", detail: "subbranch, merge, and collapse records are replayable" },
      { label: "Tests", detail: "engine lifecycle, task graph, temporal versioning, cache, and learning-loop coverage added" },
    ],
  },
  {
    version: "4.2.0",
    date: "2026-05-22",
    tag: "minor",
    title: "Temporal Compute Platform",
    summary:
      "Chronos expands from a decision engine into a platform surface: SDK, API, CLI, editor extension, Agent Runtime, and Simulation Cloud share one temporal contract.",
    highlights: [
      { label: "SDK", detail: "typed task, timeline, branch, and memory contracts across supported languages" },
      { label: "API", detail: "platform routes defined for task planning, execution, replay, and inspection" },
      { label: "CLI", detail: "objective planning and timeline replay added to terminal workflow" },
      { label: "Authoring", detail: "Visual Studio extension preview introduced for Chronos programs" },
    ],
  },
  {
    version: "4.1.3",
    date: "2026-04-09",
    tag: "patch",
    title: "Runtime reliability",
    summary:
      "Hardened deterministic execution, cache identity, and branch archive behavior before the platform surface rollout.",
    highlights: [
      { label: "Runtime", detail: "idempotent run, branch, and timeline identifiers added to service handoffs" },
      { label: "Cache", detail: "prompt, workspace, model version, and configuration now determine cache identity" },
      { label: "Replay", detail: "timeline snapshots preserve canonical state and event ordering" },
    ],
  },
  {
    version: "4.1.0",
    date: "2026-03-12",
    tag: "minor",
    title: "Temporal versioning",
    summary:
      "A decision can now retain its complete temporal history: root branches, subbranches, merge evidence, and a final collapse record.",
    highlights: [
      { label: "Branch", detail: "parent lineage and depth added for nested what-if exploration" },
      { label: "Merge", detail: "compatible branches can converge before canonical state is committed" },
      { label: "Collapse", detail: "discarded timelines remain replayable evidence after ranking" },
    ],
  },
  {
    version: "4.0.0",
    date: "2026-02-10",
    tag: "major",
    title: "Temporal runtime foundation",
    summary:
      "The first Chronos runtime ships with deterministic fork, evaluate, collapse, commit, replay, and query primitives.",
    highlights: [
      { label: "Core", detail: "six temporal primitives establish the canonical decision lifecycle" },
      { label: "Language", detail: "state, action, score, and run constructs establish the first authoring model" },
      { label: "Workspace", detail: "initial simulation, memory, scenario, and timeline persistence ports introduced" },
      { label: "Runtime", detail: "fork · evaluate · collapse · commit · replay · query are available as a deterministic lifecycle" },
      { label: "SDK", detail: "initial TypeScript SDK contract and CLI workflow released" },
    ],
  },
  {
    version: "3.5.0",
    date: "2026-01-17",
    tag: "minor",
    title: "Temporal fork primitive",
    summary:
      "First public primitive. Branch a world state into N isolated futures with byte-level isolation.",
    highlights: [
      { label: "Engine", detail: "fork primitive — clone any state into N isolated branches" },
      { label: "Engine", detail: "deterministic replay with cryptographic state anchoring" },
    ],
  },
];

export function ChangelogPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ changelog"
        title={<>What's new<span className="text-ink-faint">.</span></>}
        subtitle="Ship notes from the Chronos Lab team. Every release, every primitive, every fix — in reverse chronological order."
      />

      <section className="relative py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          {/* Summary stats */}
          <div className="mb-12 grid grid-cols-3 gap-4 rounded-xl border border-line bg-bg-soft p-5">
            <Stat label="Releases" value={releases.length} />
            <Stat label="Current" value={releases[0].version} />
            <Stat label="Last shipped" value={releases[0].date.slice(0, 7)} />
          </div>

          {/* Timeline */}
          <div className="relative space-y-8">
            {/* Vertical line */}
            <div className="absolute left-[27px] top-3 bottom-3 w-px bg-line" />

            {releases.map((r) => (
              <ReleaseCard key={r.version} release={r} />
            ))}
          </div>

          {/* Subscribe */}
          <div className="mt-16 rounded-xl border border-line bg-bg-soft p-6">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-chronos">
              Stay up to date
            </div>
            <div className="text-[15px] leading-[1.65] text-ink-dim">
              Every release ships to our Telegram group and X feed first.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="https://t.me/+I9MN0GfvgwllZGRh"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
              >
                Telegram group →
              </a>
              <a
                href="https://x.com/chronoslabspace"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
              >
                Follow on X →
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl text-ink tabular-nums">{value}</div>
    </div>
  );
}

function ReleaseCard({ release }: { release: Release }) {
  const tagStyles = {
    major: "border-accent-warm/40 bg-accent-warm/10 text-accent-warm",
    minor: "border-accent-2/40 bg-accent-2/10 text-accent-2",
    patch: "border-chronos/40 bg-chronos/10 text-chronos",
  }[release.tag];

  return (
    <div className="relative pl-16">
      {/* Node */}
      <div className="absolute left-4 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-bg">
        <span
          className={`h-2 w-2 rounded-full ${
            release.tag === "major"
              ? "bg-accent-warm"
              : release.tag === "minor"
              ? "bg-accent-2"
              : "bg-chronos"
          }`}
        />
      </div>

      <div className="rounded-xl border border-line bg-bg-soft p-5">
        {/* Header */}
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <code className="font-mono text-lg text-ink">v{release.version}</code>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${tagStyles}`}
            >
              {release.tag}
            </span>
          </div>
          <span className="font-mono text-[11px] text-ink-faint">
            {release.date}
          </span>
        </div>

        {/* Title + summary */}
        <div className="mt-3">
          <div className="font-serif text-xl text-ink">{release.title}</div>
          <p className="mt-1 text-[13px] leading-[1.6] text-ink-dim">
            {release.summary}
          </p>
        </div>

        {/* Highlights */}
        <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
          {release.highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-3 text-[12px] leading-[1.6]">
              <span className="mt-0.5 shrink-0 rounded bg-bg px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-chronos">
                {h.label}
              </span>
              <span className="text-ink-dim">{h.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
