import { useCallback } from "react";
import { Link } from "react-router-dom";
import { CTA } from "./CTA";
import { BranchingAnimation } from "./BranchingAnimation";
import { ScrollReveal } from "./ScrollReveal";
import { HomeLiveDemo } from "../features/planner/HomeLiveDemo";
import { useAccessModal } from "../features/access/AccessModal";

export function HomePage() {
  const { openAccessModal } = useAccessModal();
  const scrollToDemo = useCallback(() => {
    document.getElementById("live-demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  return (
    <>
      {/* HERO: what it is, why it matters, and why it is different. */}
      <section className="relative overflow-x-hidden">
        <div className="pointer-events-none absolute inset-0"><div className="absolute inset-0 line-grid opacity-30" /></div>
        <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-20 lg:px-10 lg:pt-28 lg:pb-28">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="min-w-0 lg:col-span-6">
              <div className="mb-6 flex items-center gap-3 sm:mb-8">
                <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-chronos blink" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim sm:text-[11px] sm:tracking-[0.25em]">Temporal Compute Platform</span>
              </div>
              <h1 className="font-serif text-[clamp(2.4rem,8vw,6.5rem)] leading-[0.98] tracking-[-0.025em]">
                Make agents think
                <br />
                <span className="gradient-text italic">before they act.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[15px] leading-[1.7] text-ink-dim sm:mt-8 sm:text-[17px] sm:leading-[1.75]">
                Chronos turns one objective into ranked possible futures. Instead of producing a single response, it plans tasks, simulates outcomes, and commits the strongest path before execution.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3 sm:mt-10 sm:gap-4">
                <button type="button" onClick={openAccessModal} className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos sm:px-6 sm:py-3">
                  Request access
                  <svg width="14" height="14" viewBox="0 0 14 14" className="transition group-hover:translate-x-0.5"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button type="button" onClick={scrollToDemo} className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-dim transition hover:border-line-strong hover:text-ink sm:px-6 sm:py-3">
                  Try it live
                </button>
                <Link to="/login" className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-dim transition hover:border-line-strong hover:text-ink sm:px-6 sm:py-3">
                  Sign in
                </Link>
              </div>
            </div>
            <div className="relative min-w-0 overflow-hidden lg:col-span-6"><BranchingAnimation /></div>
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <div id="live-demo" className="scroll-mt-20"><ScrollReveal><HomeLiveDemo /></ScrollReveal></div>

      {/* HOW CHRONOS WORKS */}
      <ScrollReveal><section className="relative py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <SectionHeading
            eyebrow="/ how Chronos works"
            title={<>One objective.<br /><span className="italic text-ink-dim">A decision system.</span></>}
            body="Chronos treats an objective as work to be decomposed, simulated, evaluated, and ranked — not a prompt to answer once."
          />
          <div className="mt-10 grid grid-cols-1 gap-0 divide-y divide-line border-y border-line sm:mt-14 md:grid-cols-2 md:divide-x lg:grid-cols-4 lg:divide-y-0">
            <ProcessStep number="01" title="Plan" detail="The Planner turns a goal into a dependency-aware task graph." color="#60899B" />
            <ProcessStep number="02" title="Simulate" detail="The Runtime forks tasks into branches and executes registered capabilities." color="#CDCAB2" />
            <ProcessStep number="03" title="Evaluate" detail="Outcomes are scored for reward, risk, confidence, and constraints." color="#E2DDDA" />
            <ProcessStep number="04" title="Rank" detail="Timelines converge, then the best path becomes canonical and replayable." color="#60899B" />
          </div>
        </div>
      </section></ScrollReveal>

      {/* USE CASES */}
      <ScrollReveal><section className="relative border-y border-line bg-bg-soft/30 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <SectionHeading
            eyebrow="/ use cases"
            title={<>Where decisions<br /><span className="italic text-ink-dim">have consequences.</span></>}
            body="Chronos is built for goals that require more than a plausible answer: they require a plan with evidence."
          />
          <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-0">
            <UseCase index="01" title="Launch a startup" question="Should we raise, build enterprise, cut prices, or extend runway?" output="Competitor research → market estimate → roadmap → adoption → financial simulation → risk analysis" color="#E2DDDA" />
            <UseCase index="02" title="Ship a release" question="Should the team ship now, write tests, refactor, or defer?" output="Change-risk analysis → dependency check → test plan → release simulation → rollback constraints" color="#60899B" />
            <UseCase index="03" title="Manage a position" question="Should a trading system add, trim, hedge, or flatten before an event?" output="Event scenarios → market simulation → downside analysis → risk ranking → execution plan" color="#CDCAB2" />
          </div>
        </div>
      </section></ScrollReveal>

      {/* DEVELOPER API */}
      <ScrollReveal><section className="relative py-24 lg:py-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 lg:grid-cols-12 lg:gap-16 lg:px-10">
          <div className="lg:col-span-5">
            <div className="mb-4 flex items-center gap-3"><span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">/ developer API</span><div className="h-px w-10 bg-line" /></div>
            <h2 className="font-serif text-4xl leading-[1] tracking-tight md:text-5xl">Ship temporal<br /><span className="italic text-ink-dim">reasoning anywhere.</span></h2>
            <p className="mt-6 max-w-md text-[15px] leading-[1.75] text-ink-dim">Use the SDK, API, CLI, or Visual Studio extension. Every surface shares the same task, timeline, branch, and memory contract.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/docs?section=platform" className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm text-ink-dim transition hover:border-line-strong hover:text-ink">Read the platform docs →</Link>
              <Link to="/developers" className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm text-ink-dim transition hover:border-line-strong hover:text-ink">View SDKs →</Link>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-line bg-bg-soft">
              <div className="flex items-center justify-between border-b border-line px-5 py-3"><div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-ink-faint/40" /><span className="h-2 w-2 rounded-full bg-ink-faint/40" /><span className="h-2 w-2 rounded-full bg-ink-faint/40" /></div><span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">launch-startup.ts</span></div>
              <pre className="overflow-x-auto p-6 font-mono text-[12px] leading-[1.9]"><code className="text-ink-dim">{`const plan = await chronos.plan({
  objective: "Launch startup",
  workspace: "acme",
  constraints: ["18 month runway"],
});

const outcome = await chronos.execute(plan);

await chronos.commit(outcome.bestTimeline);`}</code></pre>
              <div className="border-t border-line px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">task graph → capability runtime → ranked timeline</div>
            </div>
          </div>
        </div>
      </section></ScrollReveal>

      {/* RESEARCH */}
      <ScrollReveal><section className="relative border-y border-line bg-bg-soft/30 py-24 lg:py-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 lg:grid-cols-12 lg:gap-16 lg:px-10">
          <div className="lg:col-span-6"><div className="mb-4 flex items-center gap-3"><span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">/ research</span><div className="h-px w-10 bg-line" /></div><h2 className="font-serif text-4xl leading-[1] tracking-tight md:text-5xl">The more it runs,<br /><span className="italic text-ink-dim">the more it learns.</span></h2><p className="mt-6 max-w-xl text-[15px] leading-[1.75] text-ink-dim">Every workspace builds a knowledge graph from past simulations. Validated futures become reusable strategies. Failure patterns become guardrails for the next planner run.</p></div>
          <div className="lg:col-span-6"><div className="divide-y divide-line border-y border-line">{[["Past simulations", "Replayable branch traces and outcome evidence"], ["Successful futures", "Higher-priority hypotheses for similar decisions"], ["Failure patterns", "Constraints that prevent expensive repetition"], ["Knowledge graph", "Causal context delivered to the next plan"]].map(([title, detail], index) => <div key={title} className="grid grid-cols-[36px_1fr] gap-x-4 py-4"><span className="font-mono text-[10px] text-chronos">{String(index + 1).padStart(2, "0")}</span><div><div className="font-serif text-xl text-ink">{title}</div><div className="mt-1 text-[13px] text-ink-dim">{detail}</div></div></div>)}</div><Link to="/intelligence" className="mt-6 inline-flex font-mono text-[11px] uppercase tracking-[0.2em] text-chronos hover:text-ink">Explore the intelligence layer →</Link></div>
        </div>
      </section></ScrollReveal>

      {/* CTA */}
      <CTA />
    </>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: React.ReactNode; body: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-6"><div><div className="mb-4 flex items-center gap-3"><span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">{eyebrow}</span><div className="h-px w-10 bg-line" /></div><h2 className="font-serif text-4xl leading-[1] tracking-tight md:text-5xl">{title}</h2></div><p className="max-w-sm text-[14px] leading-[1.7] text-ink-dim">{body}</p></div>;
}

function ProcessStep({ number, title, detail, color }: { number: string; title: string; detail: string; color: string }) {
  return (
    <div className="min-w-0 p-5 sm:p-6 md:p-7">
      <div className="font-mono text-[10px] uppercase tracking-[0.23em]" style={{ color }}>{number}</div>
      <h3 className="mt-3 font-serif text-2xl text-ink sm:text-3xl">{title}</h3>
      <p className="mt-3 text-[13px] leading-[1.7] text-ink-dim">{detail}</p>
    </div>
  );
}

function UseCase({ index, title, question, output, color }: { index: string; title: string; question: string; output: string; color: string }) {
  return <div className="border-line px-0 md:border-r md:px-8 md:first:pl-0 md:last:border-0 md:last:pr-0"><div className="font-mono text-[10px] uppercase tracking-[0.23em]" style={{ color }}>{index}</div><h3 className="mt-3 font-serif text-3xl text-ink">{title}</h3><p className="mt-4 text-[14px] leading-[1.65] text-ink">{question}</p><p className="mt-5 border-t border-line pt-4 font-mono text-[10px] uppercase leading-[1.8] tracking-[0.16em] text-ink-faint">{output}</p></div>;
}