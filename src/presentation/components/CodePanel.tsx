const code = `import { chronos, fork, collapse } from "@chronos/sdk";

// Spin up a temporal client
const client = await chronos.connect({
  region:   "temporal-us-west-1",
  key:      process.env.CHRONOS_KEY,
  entropy:  "adaptive",
});

// Fork a branch of reality for every candidate action
const branches = await fork(client.state, {
  actions:  plan.candidates,   // 10,000 futures
  horizon:  "100y",            // simulated depth
  budget:   { ms: 2, cores: 64 },
});

// Evaluate each branch against a scoring function
const scored = await branches.evaluate(async (ctx) => {
  const outcome = await world.simulate(ctx);
  return score(outcome);
});

// Collapse to the best future
const winner = await collapse(scored, {
  strategy: "max-utility",
  archive:  true,    // keep all branches for replay
});

await client.commit(winner);`;

const lines = code.split("\n");

export function CodePanel() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left copy */}
          <div className="lg:col-span-5">
            <p className="max-w-md text-[15px] leading-[1.7] text-ink-dim">
              <span className="font-mono text-chronos">fork</span> clones state.{" "}
              <span className="font-mono text-accent-2">evaluate</span> runs every branch.{" "}
              <span className="font-mono text-accent-warm">collapse</span> merges the best one back.
              That's the whole API.
            </p>

            <div className="mt-10 space-y-4">
              {[
                {
                  lib: "@chronos/sdk",
                  v: "v4.2.1",
                  lang: "TypeScript",
                },
                {
                  lib: "@chronos/sdk-py",
                  v: "v4.2.0",
                  lang: "Python",
                },
                {
                  lib: "@chronos/sdk-rs",
                  v: "v4.2.1",
                  lang: "Rust",
                },
                {
                  lib: "@chronos/sdk-go",
                  v: "v4.1.3",
                  lang: "Go",
                },
              ].map((s) => (
                <div
                  key={s.lib}
                  className="flex items-center justify-between border-b border-line pb-3"
                >
                  <span className="font-mono text-sm text-ink">{s.lib}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[11px] text-ink-faint">{s.lang}</span>
                    <span className="font-mono text-[11px] text-chronos">{s.v}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right code panel */}
          <div className="lg:col-span-7">
            <div className="glow-border relative overflow-hidden rounded-2xl border border-line bg-bg-soft">
              {/* Window chrome */}
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-faint/50" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-faint/50" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-faint/50" />
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
                  temporal-agent.ts
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    <span className="font-mono text-[10px] text-ink-dim">compiled</span>
                  </span>
                </div>
              </div>

              {/* Code */}
              <div className="relative overflow-x-auto">
                <div className="flex min-w-full">
                  {/* Line numbers */}
                  <div className="shrink-0 select-none border-r border-line bg-[#07080c] px-4 py-5 text-right">
                    {lines.map((_, i) => (
                      <div
                        key={i}
                        className="font-mono text-[11px] leading-[1.8] text-ink-faint/60"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </div>
                    ))}
                  </div>
                  {/* Code */}
                  <pre className="flex-1 overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-[1.8]">
                    {lines.map((line, i) => (
                      <div key={i} className="whitespace-pre">
                        <Highlight line={line} />
                      </div>
                    ))}
                  </pre>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                <span>utf-8 · typescript · 42 lines</span>
                <span>chronos.lab/runtime · 2.1ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Highlight({ line }: { line: string }) {
  // A tiny, purpose-built highlighter for the specific code above
  const tokens: { re: RegExp; cls: string }[] = [
    { re: /\/\/[^\n]*/g, cls: "text-ink-faint italic" },
    { re: /"([^"\\]|\\.)*"/g, cls: "text-accent-warm" },
    { re: /'([^'\\]|\\.)*'/g, cls: "text-accent-warm" },
    {
      re: /\b(import|from|const|await|async|function|return|true|false|null|undefined)\b/g,
      cls: "text-chronos",
    },
    { re: /\b(client|branches|scored|winner|plan|world|outcome|process)\b/g, cls: "text-ink" },
    {
      re: /\b(chronos|fork|collapse|connect|evaluate|simulate|score|commit)\b/g,
      cls: "text-accent-2",
    },
    { re: /\b\d+(\.\d+)?\b/g, cls: "text-chronos" },
  ];

  if (!line.trim()) return <span>&nbsp;</span>;

  // Build segments
  type Seg = { text: string; cls?: string };
  const segs: Seg[] = [{ text: line }];

  for (const t of tokens) {
    const next: Seg[] = [];
    for (const s of segs) {
      if (s.cls) {
        next.push(s);
        continue;
      }
      let last = 0;
      const re = new RegExp(t.re.source, t.re.flags);
      for (let m = re.exec(s.text); m !== null; m = re.exec(s.text)) {
        if (m.index > last) next.push({ text: s.text.slice(last, m.index) });
        next.push({ text: m[0], cls: t.cls });
        last = m.index + m[0].length;
        if (m[0].length === 0) {
          re.lastIndex++;
          break;
        }
      }
      if (last < s.text.length) next.push({ text: s.text.slice(last) });
    }
    segs.splice(0, segs.length, ...next);
  }

  return (
    <>
      {segs.map((s, i) => (
        <span key={i} className={s.cls}>
          {s.text}
        </span>
      ))}
    </>
  );
}
