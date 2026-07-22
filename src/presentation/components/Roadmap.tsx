import { Link } from "react-router-dom";
import { ScrollReveal } from "./ScrollReveal";

const phases = [
  {
    num: "Phase 01",
    name: "Foundation",
    status: "Shipped",
    statusColor: "#60899B",
    date: "January–March 2026",
    intent: "Prove the temporal kernel and make a decision replayable.",
    outcome: "Core engine + public simulator",
    items: [
      "Temporal fork primitive",
      "Parallel branch evaluation",
      "Collapse engine (max-utility)",
      "Public startup simulator (demo)",
      "Branch topology and timeline replay",
      "Deterministic local evaluation",
    ],
  },
  {
    num: "Phase 02",
    name: "Decision Workspace",
    status: "Shipped",
    statusColor: "#60899B",
    date: "July 2026",
    intent:
      "Answer “What am I working on?” with a mandatory path from workspace to Decision Report—not a chat product.",
    outcome: "Onboard → simulate → Decision Report → timeline",
    items: [
      "Mandatory onboarding + OAuth get-started path",
      "Workspace Pulse + Decision Report (Recommended because, risks, next actions)",
      "Multi-future comparison · choose/save path · outcome tracking",
      "Timeline cards + Memory (goals, decisions, versions)",
      "Primary nav: Dashboard · Knowledge · Sims · Timeline · Memory · Settings",
      "Knowledge library + dual-write persistence (local + Supabase RLS)",
    ],
  },
  {
    num: "Phase 03",
    name: "Simulation Cloud",
    status: "Next",
    statusColor: "#CDCAB2",
    date: "August–September 2026",
    intent: "Move temporal workloads from browser-local persistence to elastic production infrastructure.",
    outcome: "Managed simulation capacity",
    items: [
      "Deeper cloud sync and multi-device conflict UX",
      "Elastic simulation workers",
      "Shared result cache by workspace + model",
      "Workspace-level audit trails",
      "Public API + TypeScript/Python SDK preview",
      "Roles, invites, and access controls",
    ],
  },
  {
    num: "Phase 04",
    name: "Ecosystem",
    status: "Later",
    statusColor: "#989898",
    date: "October–December 2026",
    intent: "Make temporal computation native to the agent development workflow.",
    outcome: "Authoring and deployment ecosystem",
    items: [
      "Timeline tree, branches, merge, collapse, compare (beyond cards)",
      "Visual Studio extension",
      "Capability marketplace",
      "Cross-workspace evaluation benchmarks",
      "Model and policy version registry",
      "Simulation Cloud regions · enterprise deploy",
    ],
  },
];

export function Roadmap() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <ScrollReveal variant="fade" className="mb-8 rounded-xl border border-line bg-bg-soft/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            <span>Project timeline · 2026</span>
            <span className="flex items-center gap-2 text-chronos"><span className="h-1.5 w-1.5 rounded-full bg-chronos blink" /> Current point: Workspace MVP shipped · Cloud next</span>
            <Link to="/changelog" className="transition hover:text-ink">View changelog →</Link>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {phases.map((phase, index) => (
              <div key={phase.num} className="relative">
                <div className="h-1.5 rounded-full" style={{ background: index < 2 ? phase.statusColor : `${phase.statusColor}55` }} />
                <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">{phase.date.split("–")[0]}</div>
              </div>
            ))}
          </div>
        </ScrollReveal>
        {/* Phases */}
        <ScrollReveal stagger className="grid grid-cols-1 gap-4 md:grid-cols-2" variant="fade">
          {phases.map((p) => (
            <div
              key={p.num}
              className="group relative overflow-hidden rounded-2xl border border-line bg-bg-soft p-8 transition hover:border-line-strong"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                    {p.num}
                  </div>
                  <h3 className="mt-2 font-serif text-3xl leading-tight text-ink">
                    {p.name}
                  </h3>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em]"
                  style={{
                    borderColor: `${p.statusColor}40`,
                    color: p.statusColor,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: p.statusColor }}
                  />
                  {p.status}
                </span>
              </div>

              <div className="mt-3 font-mono text-[11px] text-ink-faint">
                {p.date}
              </div>

              <div className="mt-5 border-l-2 pl-4" style={{ borderColor: `${p.statusColor}70` }}>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">Why this phase</div>
                <p className="mt-1 text-[13px] leading-[1.6] text-ink-dim">{p.intent}</p>
              </div>

              {/* Items */}
              <ul className="mt-6 space-y-3 border-t border-line pt-6">
                {p.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-[13px] leading-[1.5] text-ink-dim"
                  >
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                      style={{ background: p.statusColor, opacity: 0.7 }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex items-center justify-between rounded-lg border border-line bg-bg/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                <span>Outcome</span>
                <span className="max-w-[65%] text-right" style={{ color: p.statusColor }}>{p.outcome}</span>
              </div>

              {/* Footer */}
              <div className="mt-8 border-t border-line pt-4">
                <Link
                  to="/changelog"
                  className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim transition hover:text-ink"
                >
                  View changelog
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path
                      d="M2 5h6M5 2l3 3-3 3"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </ScrollReveal>

        {/* Bottom note */}
        <ScrollReveal delay={100} variant="fade" className="mt-12 flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 blink" />
          <span>All phases ship with backward compatibility guarantees</span>
        </ScrollReveal>
      </div>
    </section>
  );
}
