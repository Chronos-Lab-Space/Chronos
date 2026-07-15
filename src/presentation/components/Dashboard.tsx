import { Link } from "react-router-dom";
import { ChronosCMark } from "./ChronosCMark";

/**
 * Private-dashboard. Protected by Supabase authentication.
 * Only authenticated users can access this route.
 */
export function Dashboard() {
  return (
    <section className="relative overflow-hidden bg-bg py-10 lg:py-16">
      <div className="mx-auto max-w-[1500px] px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ChronosCMark size={28} className="chronos-brand-mark" />
            <div>
              <div className="font-chronos-wordmark text-[25px] text-ink">Chronos</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-faint">Private workspace dashboard</div>
            </div>
          </div>
          <Link to="/core" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim transition hover:text-ink">Back to Core →</Link>
        </div>

        <div className="relative min-h-[680px] overflow-hidden rounded-2xl border border-line bg-bg-soft">
          {/* Authenticated users see the full dashboard. */}
          <div className="select-none p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim"><span className="rounded bg-chronos/15 px-3 py-2 text-chronos">Task OS</span><span className="px-3 py-2">Workspace</span><span className="px-3 py-2">Language</span></div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">workspace: acme</div>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-4">
                <PreviewPanel title="Objective" rows={["Launch startup", "18 month runway", "Decision: strategy"]} />
                <PreviewPanel title="Planner task graph" rows={["Research competitors", "Estimate market", "Build roadmap", "Predict adoption", "Financial simulation", "Risk analysis"]} />
              </div>
              <div className="lg:col-span-5"><PreviewTopology /></div>
              <div className="space-y-4 lg:col-span-3"><PreviewPanel title="Timeline ranking" rows={["branch_0x4a · 0.942", "branch_0x1f · 0.718", "branch_0x2b · 0.603"]} /><PreviewPanel title="Workspace intelligence" rows={["Past simulations: 24", "Success signals: 8", "Failure patterns: 5"]} /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewPanel({ title, rows }: { title: string; rows: readonly string[] }) {
  return <div className="rounded-xl border border-line bg-bg p-4"><div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">{title}</div><div className="mt-4 space-y-2">{rows.map((row) => <div key={row} className="rounded-md border border-line bg-bg-soft/50 px-3 py-2 font-mono text-[11px] text-ink-dim">{row}</div>)}</div></div>;
}

function PreviewTopology() {
  return <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-line bg-bg"><svg viewBox="0 0 420 280" className="h-auto w-full p-5"><circle cx="55" cy="140" r="6" fill="#60899B" /><path d="M61 140C140 140 145 55 230 55M61 140C140 140 145 140 230 140M61 140C140 140 145 225 230 225" stroke="#60899B" strokeWidth="1" fill="none" opacity="0.6" /><circle cx="230" cy="55" r="5" fill="#CDCAB2" /><circle cx="230" cy="140" r="6" fill="#E2DDDA" /><circle cx="230" cy="225" r="5" fill="#CDCAB2" /><path d="M236 140L350 140" stroke="#E2DDDA" strokeWidth="1.5" /><circle cx="360" cy="140" r="9" fill="#E2DDDA" opacity="0.8" /><text x="55" y="170" fill="#989898" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">OBJECTIVE</text><text x="360" y="170" fill="#989898" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">RANKED</text></svg></div>;
}