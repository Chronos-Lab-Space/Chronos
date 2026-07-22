import { ScrollReveal } from "./ScrollReveal";

const steps = [
  {
    num: "01",
    title: "Connect",
    time: "~2 minutes",
    body: "Install the SDK for your language. Authenticate with a single API key. Chronos auto-detects your region and provisions a temporal cluster in milliseconds.",
    code: `import { chronos } from "@chronos/sdk";

const client = await chronos.connect({
  key: process.env.CHRONOS_KEY,
  region: "auto",  // auto-selects nearest
});`,
    color: "#c6f0ff",
  },
  {
    num: "02",
    title: "Fork",
    time: "~0.3ms",
    body: "Snapshot your agent's state. Chronos clones it into N isolated branches — one per candidate action. Each branch is deterministic and byte-level isolated.",
    code: `const branches = await fork(client.state, {
  actions: plan.candidates,  // 10,000 futures
  horizon: "100y",           // simulated depth
});`,
    color: "#c6f0ff",
  },
  {
    num: "03",
    title: "Evaluate",
    time: "~1.4ms",
    body: "Run your scoring function across every branch in parallel. Chronos's scheduler prunes redundant work on the fly, routing high-entropy tasks to the deepest layer.",
    code: `const scored = await branches.evaluate(async (ctx) => {
  const outcome = await world.simulate(ctx);
  return score(outcome);  // your logic
});`,
    color: "#b79bff",
  },
  {
    num: "04",
    title: "Collapse",
    time: "~0.4ms",
    body: "A built-in strategy function picks the highest-scoring branch. You can override with custom logic — max-utility, risk-adjusted, ensemble, or your own.",
    code: `const winner = await collapse(scored, {
  strategy: "max-utility",  // or custom
  archive: true,            // keep all for replay
});`,
    color: "#ffd7a3",
  },
  {
    num: "05",
    title: "Commit",
    time: "~instant",
    body: "The winning branch is merged back into your canonical state. Every byte is cryptographically anchored. You can replay any moment, on any branch, forever.",
    code: `await client.commit(winner);

// Later, replay any branch
const replay = await chronos.replay("branch_0x4a");`,
    color: "#ffd7a3",
  },
];

export function Journey() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Steps */}
        <div className="space-y-4">
          {steps.map((s, i) => (
            <ScrollReveal key={s.num} delay={i * 60} variant="up">
            <div
              className="group relative overflow-hidden rounded-2xl border border-line bg-bg-soft transition hover:border-line-strong"
            >
              <div className="grid grid-cols-1 gap-8 p-8 lg:grid-cols-12 lg:gap-12 lg:p-10">
                {/* Left: meta */}
                <div className="lg:col-span-4">
                  <div className="flex items-baseline gap-3">
                    <span
                      className="font-mono text-[11px] uppercase tracking-[0.25em]"
                      style={{ color: s.color }}
                    >
                      Step {s.num}
                    </span>
                    <span className="font-mono text-[11px] text-ink-faint">
                      · {s.time}
                    </span>
                  </div>
                  <h3 className="mt-3 font-serif text-3xl leading-tight">
                    {s.title}
                    <span className="ml-1 text-ink-faint">.</span>
                  </h3>
                  <p className="mt-4 text-[14px] leading-[1.7] text-ink-dim">
                    {s.body}
                  </p>
                </div>

                {/* Right: code */}
                <div className="lg:col-span-8">
                  <div className="overflow-hidden rounded-lg border border-line bg-bg">
                    <div className="flex items-center justify-between border-b border-line px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-ink-faint/50" />
                        <span className="h-2 w-2 rounded-full bg-ink-faint/50" />
                        <span className="h-2 w-2 rounded-full bg-ink-faint/50" />
                      </div>
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.2em]"
                        style={{ color: s.color }}
                      >
                        {s.title.toLowerCase()}.ts
                      </span>
                    </div>
                    <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-[1.8]">
                      <JourneyCode code={s.code} color={s.color} />
                    </pre>
                  </div>
                </div>
              </div>
            </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Total time */}
        <ScrollReveal delay={100} variant="scale" className="mt-8">
        <div className="flex items-center justify-between rounded-2xl border border-line bg-bg-soft p-8">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
              Total end-to-end
            </div>
            <div className="mt-2 font-serif text-4xl text-ink">
              ~2.1ms
              <span className="ml-3 font-mono text-xs text-ink-dim">
                from connect to commit
              </span>
            </div>
          </div>
          <div className="hidden text-right md:block">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
              Equivalent human reasoning
            </div>
            <div className="mt-2 font-serif text-4xl gradient-text">
              47 years
            </div>
          </div>
        </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function JourneyCode({ code, color }: { code: string; color: string }) {
  const lines = code.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const isComment = line.trim().startsWith("//");
        return (
          <div key={i}>
            {isComment ? (
              <span className="text-ink-faint italic">{line}</span>
            ) : (
              <span>
                {line.split(/(\b(?:import|from|const|await|async|function|return|true|false)\b|"[^"]*")/g).map((part, j) => {
                  if (/\b(import|from|const|await|async|function|return|true|false)\b/.test(part)) {
                    return <span key={j} style={{ color }}>{part}</span>;
                  }
                  if (/^"[^"]*"$/.test(part)) {
                    return <span key={j} className="text-accent-warm">{part}</span>;
                  }
                  return <span key={j} className="text-ink">{part}</span>;
                })}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
