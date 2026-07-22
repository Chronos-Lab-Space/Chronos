import { Link } from "react-router-dom";
import { useAccessModal } from "../features/access/AccessModal";
import { PageHeader } from "../components/PageHeader";
import { Platform } from "../components/Platform";
import { Features } from "../components/Features";
import { Timeline } from "../features/timeline/Timeline";
import { Utilities } from "../components/Utilities";
import { CodePanel } from "../components/CodePanel";
import { Metrics } from "../components/Metrics";
import { Roadmap } from "../components/Roadmap";
import { Intelligence } from "../components/Intelligence";
import { Shift } from "../components/Shift";
import { Simulate } from "../features/planner/Simulate";
import { Journey } from "../components/Journey";
import { CTA } from "../components/CTA";

// ============================================================
// HOME
// ============================================================

export function HomePage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ chronos lab · temporal compute"
        title={
          <>
            Compute that
            <br />
            <span className="italic text-ink-dim">folds time.</span>
          </>
        }
        subtitle="Chronos is the temporal compute layer for autonomous systems. It branches, evaluates, and prunes vast decision spaces before execution — turning chatbots into strategists."
      />
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { to: "/core", num: "01", label: "Core", desc: "The working engine, three agents, and the Chronos language — all in one place.", color: "#E2DDDA" },
            { to: "/simulate", num: "02", label: "Simulate", desc: "Public demo: branch → simulate → collapse an idea into a best path with ranked alternatives.", color: "#60899B" },
            { to: "/platform", num: "03", label: "Platform", desc: "The architecture and primitives behind temporal decision systems.", color: "#CDCAB2" },
            { to: "/journey", num: "04", label: "Journey", desc: "How Chronos thinks about plan, simulate, evaluate, and decide.", color: "#E2DDDA" },
            { to: "/runtime", num: "05", label: "Runtime", desc: "The four-phase lifecycle of a simulation run.", color: "#60899B" },
            { to: "/developers", num: "06", label: "Developers", desc: "Docs and platform notes — public API & SDKs on the roadmap.", color: "#CDCAB2" },
            { to: "/metrics", num: "07", label: "Metrics", desc: "Measured, not marketed. The numbers behind the runtime.", color: "#E2DDDA" },
            { to: "/roadmap", num: "08", label: "Roadmap", desc: "Built in phases. What's live, what's in beta, what's coming.", color: "#60899B" },
            { to: "/intelligence", num: "09", label: "Intelligence", desc: "The world model that compounds over time into an unfair advantage.", color: "#CDCAB2" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="card-hover group relative overflow-hidden rounded-2xl border border-line bg-bg-soft p-8"
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.25em]" style={{ color: item.color }}>
                  {item.num}
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" className="text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ink">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mt-6 font-serif text-3xl leading-tight">{item.label}</h3>
              <p className="mt-3 text-[13px] leading-[1.65] text-ink-dim">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================
// CORE — task operating system + language (all in one)
// ============================================================

export function CorePage() {
  const { openAccessModal } = useAccessModal();
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ chronos core"
        title={
          <>
            The Temporal
            <br />
            <span className="italic text-ink-dim">Decision Engine.</span>
          </>
        }
        subtitle="Chronos Core is the task operating system for temporal work. Register capabilities, build a task graph, execute branches, evaluate outcomes, and rank timelines in milliseconds."
      />

      <section className="relative py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          {/* Dashboard features */}
          <div className="mb-12 grid grid-cols-2 gap-3 md:grid-cols-4">
            <DashFeature
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>}
              title="View simulations"
              desc="Browse every branch the engine forked."
            />
            <DashFeature
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2v5h5M2 2a6 6 0 1 1 0 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              title="Replay runs"
              desc="Step through a past run branch-by-branch."
            />
            <DashFeature
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8l4-4 3 3 5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              title="Compare branches"
              desc="Side-by-side scores, risks, and state deltas."
            />
            <DashFeature
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" /><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>}
              title="Inspect outcomes"
              desc="Drill into the winning branch's final state."
            />
          </div>

          {/* Three pillars */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Pillar
              n="01"
              title="Capabilities"
              body="External providers register planning, simulation, evaluation, and memory capabilities. The engine never needs to know individual agents."
            />
            <Pillar
              n="02"
              title="Task Graph"
              body="The planner turns a goal into dependency-aware tasks. The scheduler dispatches ready work based on priority and constraints."
            />
            <Pillar
              n="03"
              title="Timeline Ranking"
              body="Execute tasks across branches, evaluate outcomes, then rank viable timelines and commit the strongest path."
            />
          </div>

          {/* Chronos Language is part of Core: the authoring layer for temporal tasks. */}
          <div className="mt-16 grid grid-cols-1 gap-8 border-t border-line pt-16 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">/ chronos language</span>
                <div className="h-px w-10 bg-line" />
              </div>
              <h2 className="font-serif text-4xl leading-[1] tracking-tight md:text-5xl">
                Describe a future.<br />
                <span className="italic text-ink-dim">Chronos plans the work.</span>
              </h2>
              <p className="mt-6 max-w-md text-[14px] leading-[1.75] text-ink-dim">
                Chronos Language is the authoring layer for task-oriented temporal reasoning. Declare an objective, constraints, and evaluation rules; the Planner creates the task graph and resolves capabilities automatically.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/docs#platform" className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] text-ink-dim transition hover:border-line-strong hover:text-ink">Language reference →</Link>
                <button type="button" onClick={openAccessModal} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] text-ink-dim transition hover:border-line-strong hover:text-ink">Request workspace →</button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-line bg-bg-soft lg:col-span-7">
              <div className="flex items-center justify-between border-b border-line px-5 py-3"><div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-ink-faint/40" /><span className="h-2 w-2 rounded-full bg-ink-faint/40" /><span className="h-2 w-2 rounded-full bg-ink-faint/40" /></div><span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">launch.chronos</span></div>
              <pre className="overflow-x-auto p-6 font-mono text-[12px] leading-[1.8]"><code><span className="text-chronos">objective</span><span className="text-ink"> </span><span className="text-accent-warm">"Launch startup"</span><span className="text-ink"> {"{"}{"\n"}  workspace: </span><span className="text-accent-warm">"acme"</span><span className="text-ink">{"\n"}  constraints: [</span><span className="text-accent-warm">"18 month runway"</span><span className="text-ink">]{"\n"}</span><span className="text-ink">{"}"}{"\n\n"}</span><span className="text-chronos">plan</span><span className="text-ink"> {"{"}{"\n"}  research.competitors{"\n"}  market.estimate{"\n"}  roadmap.build{"\n"}  adoption.predict{"\n"}  financial.simulate{"\n"}  risk.analyze{"\n"}</span><span className="text-ink">{"}"}{"\n\n"}</span><span className="text-chronos">rank</span><span className="text-ink"> timelines </span><span className="text-accent-warm">by expected_value</span></code></pre>
              <div className="border-t border-line px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">objective → task graph → capabilities → ranked timeline</div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-16 flex flex-col items-center rounded-2xl border border-line bg-bg-soft p-10 text-center lg:p-14">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px w-8 bg-chronos/60" />
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
                Ready when you are
              </span>
              <div className="h-px w-8 bg-chronos/60" />
            </div>
            <h2 className="font-serif text-4xl leading-[1] tracking-tight md:text-5xl">
              Request workspace access
              <span className="text-ink-faint">.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[14px] leading-[1.7] text-ink-dim">
              Tell us what you are building with AI agents. We use the context
              to provision the right Chronos workspace for your workload.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={openAccessModal}
                className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-bg transition hover:bg-chronos"
              >
                Request access
                <svg width="14" height="14" viewBox="0 0 14 14" className="transition group-hover:translate-x-0.5">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <Link
                to="/simulate"
                className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 text-sm font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
              >
                Try the simulator
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// Request Access form (email-only)
// ============================================================
// SIMULATE (was /playground, now its own route)
// ============================================================

export function SimulatePage() {
  return <Simulate />;
}

// Alias — /playground redirects to /simulate content
export function PlaygroundPage() {
  return <Simulate />;
}

// ============================================================
// PRODUCT / DOCS PAGES
// ============================================================

export function PlatformPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ platform"
        title={<>The Temporal<br /><span className="italic text-ink-dim">Compute Platform.</span></>}
        subtitle="Build, author, run, inspect, and scale autonomous decisions through one temporal compute platform — from SDK and API to Agent Runtime and Simulation Cloud."
      />
      <Platform />
    </>
  );
}

export function PrimitivesPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ primitives"
        title={<>A new grammar<br /><span className="italic text-ink-dim">for computation.</span></>}
        subtitle="Six primitives. One runtime. Everything your agents need to reason across time."
      />
      <Features />
    </>
  );
}

export function JourneyPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ user journey"
        title={<>Five steps from<br /><span className="italic text-ink-dim">zero to temporal.</span></>}
        subtitle="The entire workflow fits in a single function. Here's what each step does — and how long it takes."
      />
      <Journey />
    </>
  );
}

export function RuntimePage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ runtime"
        title={<>From fork<br /><span className="italic text-ink-dim">to collapse, in 2ms.</span></>}
        subtitle="Four phases. No round-trips. The entire temporal lifecycle runs inside a single kernel invocation."
      />
      <Timeline />
    </>
  );
}

export function DevelopersPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ developers"
        title={<>Everything you need.<br /><span className="italic text-ink-dim">Nothing you don't.</span></>}
        subtitle="Four tools. One platform. Ship temporal compute in your language, your workflow, your stack."
      />
      <Utilities />
      <div className="border-t border-line">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <h2 className="font-serif text-5xl leading-[1] tracking-tight md:text-6xl">
            Three verbs.<br />
            <span className="italic text-ink-dim">Infinite futures.</span>
          </h2>
        </div>
      </div>
      <CodePanel />
    </>
  );
}

export function MetricsPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ by the numbers"
        title={<>Measured. <span className="italic text-ink-dim">Not marketed.</span></>}
        subtitle="The numbers behind the runtime. Every metric measured on live production clusters."
      />
      <Metrics />
    </>
  );
}

export function RoadmapPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ roadmap"
        title={<>Built in <span className="italic text-ink-dim">phases.</span></>}
        subtitle="We ship in tight, focused phases. Every phase is a complete, usable platform."
      />
      <Roadmap />
    </>
  );
}

export function IntelligencePage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ intelligence"
        title={<>The world model<br /><span className="italic text-ink-dim">that compounds.</span></>}
        subtitle="Every decision space Chronos prunes teaches it something about how the world works. Over time, it learns patterns no individual customer could see."
      />
      <Intelligence />
    </>
  );
}

export function ShiftPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ the shift"
        title={<>From chatbot<br /><span className="italic text-ink-dim">to strategist.</span></>}
        subtitle="Chronos introduces temporal computation — computing over possible futures before acting."
      />
      <Shift />
    </>
  );
}

export function AccessPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ access · cohort 04"
        title={<>The future is already here.<br /><span className="gradient-text italic">Ship it first.</span></>}
      />
      <CTA />
    </>
  );
}

// ============================================================
// COMPANY / INFO PAGES
// ============================================================

export function AboutPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "About" }]}
        eyebrow="/ chronos lab"
        title={<>We're building<br /><span className="italic text-ink-dim">temporal compute.</span></>}
        subtitle="Chronos Lab builds the infrastructure for autonomous systems to reason across time. We believe the next generation of AI needs to simulate consequences before acting — not react to them after."
      />
      <InfoBody>
        <div className="space-y-10">
          <Block
            title="Our thesis"
            body="Autonomous systems today are reactive. They take an input, produce an output, and hope it's right. But real intelligence doesn't work that way. Real intelligence simulates consequences before acting. Chronos gives autonomous systems the same capability — but at the speed of compute, not the speed of thought."
          />
          <Block
            title="What we build"
            body="We build the Temporal Decision Engine — a runtime that branches, evaluates, and collapses possible futures into the single best path. The engine is domain-agnostic. Agents bring their own world, their own actions, their own scoring logic. We provide the branching."
          />
          <Block
            title="The Chronos language"
            body="A domain-specific language for describing futures. Any agent can write Chronos: declare a world, define actions with risk and reward, express scoring logic in a few lines. Same engine. Every domain."
          />
          <Block
            title="Our moat"
            body="Every simulation Chronos runs teaches it something about how the world works — how software ships, how markets react, how companies grow. Over time, the world model compounds into an advantage that's difficult to replicate. A competitor could build the engine; they can't build the history."
          />
        </div>

        {/* Principles */}
        <div className="mt-16 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { k: "01", t: "Branch freely", b: "Generate multiple futures for one objective instead of a single answer." },
            { k: "02", t: "Commit with confidence", b: "Rank paths with confidence, risk, and transparent “recommended because” reasons." },
            { k: "03", t: "Archive everything", b: "Save paths and outcomes in workspace memory so decisions compound over time." },
          ].map((p) => (
            <div key={p.k} className="rounded-xl border border-line bg-bg-soft p-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
                {p.k}
              </div>
              <div className="mt-2 font-serif text-lg text-ink">{p.t}</div>
              <div className="mt-1 text-[12px] leading-[1.6] text-ink-dim">
                {p.b}
              </div>
            </div>
          ))}
        </div>
      </InfoBody>
    </>
  );
}

export function ContactPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Contact" }]}
        eyebrow="/ get in touch"
        title={<>Let's talk<span className="text-ink-faint">.</span></>}
        subtitle="We read every message. Reach us on X or join the Telegram group."
      />
      <InfoBody>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ContactCard
            label="X (Twitter)"
            value="@chronoslabspace"
            href="https://x.com/chronoslabspace"
            external
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            }
          />
          <ContactCard
            label="Telegram"
            value="Join the group"
            href="https://t.me/+I9MN0GfvgwllZGRh"
            external
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
              </svg>
            }
          />
        </div>
      </InfoBody>
    </>
  );
}

export function PrivacyPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Privacy" }]}
        eyebrow="/ legal"
        title={<>Privacy policy<span className="text-ink-faint">.</span></>}
        subtitle="Last updated: January 2026. This policy describes what we collect, how we use it, and the choices you have."
      />
      <LegalBody>
        <p><strong>1. Who we are.</strong> Chronos Lab AG is the data controller for the information you provide when using our platform.</p>
        <p><strong>2. What we collect.</strong> We collect account information (email, name), telemetry about your use of the runtime (branch counts, latency metrics, error rates), and any data you submit as world state to the engine. We do not collect the content of your branches beyond what is necessary to execute and score them.</p>
        <p><strong>3. How we use it.</strong> To operate the service, to improve the world model that powers evaluation, and to communicate with you about your account. We do not sell your data. We do not train the world model on any individual customer's data without explicit opt-in.</p>
        <p><strong>4. Retention.</strong> Branch archives are retained for as long as your account is active, or for 90 days after deletion. Telemetry is retained for 24 months. You may request deletion at any time.</p>
        <p><strong>5. Your rights.</strong> Under applicable data protection law, you have the right to access, correct, delete, and port your data. Submit a request through our <Link to="/contact" className="text-chronos">contact channels</Link>.</p>
        <p><strong>6. Cookies.</strong> We use a single first-party cookie to maintain your session. No advertising cookies. No third-party tracking.</p>
        <p><strong>7. International transfers.</strong> Data is processed in the region selected for your workspace. Appropriate contractual safeguards apply to transfers where required.</p>
        <p><strong>8. Changes.</strong> We will notify you of material changes by email at least 30 days in advance.</p>
      </LegalBody>
    </>
  );
}

export function TermsPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Terms" }]}
        eyebrow="/ legal"
        title={<>Terms of service<span className="text-ink-faint">.</span></>}
        subtitle="Last updated: January 2026. These terms govern your use of the Chronos platform."
      />
      <LegalBody>
        <p><strong>1. Acceptance.</strong> By using Chronos, you agree to these terms. If you do not agree, do not use the service.</p>
        <p><strong>2. Accounts.</strong> You are responsible for the security of your account and for all activity under it. You must be at least 18 years old and have authority to enter into these terms.</p>
        <p><strong>3. Acceptable use.</strong> You may not use Chronos to: violate any law, infringe third-party rights, build weapons, or generate harmful content. We reserve the right to suspend accounts that violate these terms.</p>
        <p><strong>4. Your data.</strong> You retain all rights to the data you submit. We process it only to operate the service and improve the world model (subject to your privacy settings).</p>
        <p><strong>5. Service levels.</strong> We target 99.99% monthly uptime for the runtime. Credits are issued for downtime beyond this threshold. See our <Link to="/security" className="text-chronos">security page</Link> for details.</p>
        <p><strong>6. Fees.</strong> Pricing is set per your plan. Usage beyond your plan's limits is billed at published rates. We will notify you before any price increase takes effect.</p>
        <p><strong>7. Termination.</strong> Either party may terminate with 30 days' written notice. On termination, you may export your data for 90 days.</p>
        <p><strong>8. Liability.</strong> To the maximum extent permitted by law, our liability is limited to the fees you paid in the 12 months preceding the claim. We are not liable for indirect, incidental, or consequential damages.</p>
        <p><strong>9. Governing law.</strong> The governing law and dispute process for paid services are specified in the applicable service agreement.</p>
      </LegalBody>
    </>
  );
}

export function SecurityPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Security" }]}
        eyebrow="/ trust"
        title={<>Built to be<br /><span className="italic text-ink-dim">trusted.</span></>}
        subtitle="Temporal compute is infrastructure. The data flowing through it is often the most sensitive in your stack. We take that seriously."
      />
      <InfoBody>
        <div className="space-y-10">
          <div>
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">Certifications</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <CertCard label="SOC 2" value="Type II · annual" />
              <CertCard label="ISO 27001" value="certified" />
              <CertCard label="GDPR" value="compliant" />
            </div>
          </div>

          <Block
            title="Encryption"
            body="Production traffic uses HTTPS. Workspace data is stored under Supabase with industry-standard encryption at rest for the managed database, plus browser local storage for offline-first memory."
          />

          <Block
            title="Isolation"
            body="Workspaces are private to authenticated accounts. Row Level Security scopes cloud data by owner/membership. Simulation futures are evaluated as separate ranked options inside your workspace — not shared across customers."
          />

          <Block
            title="Infrastructure"
            body="The Decision Workspace is a client app with dual-write memory (local + Supabase). Elastic simulation cloud and multi-region runtime are roadmap items, not current beta claims."
          />

          <Block
            title="Access control"
            body="Sign-in via Supabase Auth (Google, GitHub, email). Workspace membership roles (owner/admin/member/viewer) are in schema; full multi-user invites and SSO are expanding in beta."
          />

          <Block
            title="Vulnerability disclosure"
            body="We run a private vulnerability process. If you discover a security issue, start a private conversation through our contact channels. Do not publish sensitive exploit details in a public thread."
          />

          <div className="rounded-xl border border-chronos/30 bg-chronos/5 p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">Report a security issue</div>
            <p className="mt-2 text-[14px] leading-[1.65] text-ink-dim">
              Start a private conversation through <Link to="/contact" className="text-chronos underline-offset-4 hover:underline">our contact channels</Link>. Include a description, reproduction steps, and the impact you believe it has.
            </p>
          </div>
        </div>
      </InfoBody>
    </>
  );
}

// ============================================================
// Core page subcomponents
// ============================================================

function DashFeature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-chronos/30 bg-chronos/5 text-chronos">
        {icon}
      </div>
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink">
          {title}
        </div>
        <div className="mt-0.5 text-[11px] leading-[1.5] text-ink-dim">{desc}</div>
      </div>
    </div>
  );
}

function Pillar({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft p-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
        {n}
      </div>
      <div className="mt-3 font-serif text-2xl text-ink">{title}</div>
      <p className="mt-2 text-[13px] leading-[1.65] text-ink-dim">{body}</p>
    </div>
  );
}

// ============================================================
// Shared page bodies
// ============================================================

function InfoBody({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative pb-24 lg:pb-32">
      <div className="mx-auto max-w-4xl px-6 lg:px-10">{children}</div>
    </section>
  );
}

function LegalBody({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative pb-24 lg:pb-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-10">
        <div className="prose-chronos space-y-5 text-[14px] leading-[1.75] text-ink-dim">
          {children}
        </div>
      </div>
    </section>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="font-serif text-2xl text-ink">{title}</div>
      <p className="mt-3 text-[15px] leading-[1.7] text-ink-dim">{body}</p>
    </div>
  );
}

function ContactCard({
  label,
  value,
  href,
  icon,
  external,
}: {
  label: string;
  value: string;
  href?: string;
  icon?: React.ReactNode;
  external?: boolean;
}) {
  const inner = (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-bg-soft p-5 transition hover:border-line-strong">
      {icon && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-chronos/30 bg-chronos/5 text-chronos">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
          {label}
        </div>
        <div className="mt-1 text-[14px] text-ink break-words">{value}</div>
      </div>
    </div>
  );
  if (href) {
    const props = external
      ? { href, target: "_blank", rel: "noopener noreferrer" }
      : { href };
    return (
      <a {...props} className="block h-full">
        {inner}
      </a>
    );
  }
  return inner;
}

function CertCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-chronos">{label}</div>
      <div className="mt-2 font-serif text-xl text-ink">{value}</div>
    </div>
  );
}
