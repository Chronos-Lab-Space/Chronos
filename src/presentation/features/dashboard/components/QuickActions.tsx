import { Link } from "react-router-dom";

const actions = [
  { to: "/workspace/simulations?new=1", label: "+ Run Simulation" },
  { to: "/workspace/knowledge?upload=1", label: "+ Upload Knowledge" },
  { to: "/workspace/notes?new=1", label: "+ Create Note" },
  { to: "/workspace/knowledge?import=url", label: "+ Import URL" },
  { to: "/workspace/advisor", label: "Ask Grok" },
] as const;

/** Primary CTAs — no hidden menus. */
export function QuickActions() {
  return (
    <section>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Quick actions
      </div>
      <div className="ws-cascade mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="inline-flex items-center rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-chronos/50 hover:text-chronos hover:shadow-[0_0_0_1px_rgba(96,137,155,0.25)]"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
