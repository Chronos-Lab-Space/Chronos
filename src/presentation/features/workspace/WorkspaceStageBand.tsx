import type { BriefStage } from "../../../domain/workspace/decisionBrief";

function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * Persistent decision lifecycle band — Draft → Simulating → Evaluating →
 * Collapsed → Observed → Learned — shown on every workspace page.
 * Stages come from deriveDecisionBrief; the shell owns placement.
 */
export function WorkspaceStageBand({ stages }: { stages: BriefStage[] }) {
  return (
    <div
      data-testid="stage-band"
      className="mb-6 flex items-start overflow-x-auto border-b border-line pb-4"
    >
      {stages.map((stage, i) => {
        const date = formatDay(stage.at);
        return (
          <div
            key={stage.id}
            aria-current={stage.state === "current" ? "step" : undefined}
            className={`min-w-[124px] flex-1 border-t-2 pt-2.5 pr-3 last:pr-0 ${
              stage.state === "current"
                ? "border-chronos"
                : stage.state === "past"
                  ? "border-chronos/45 opacity-70"
                  : "border-line opacity-40"
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-[9px] tracking-[0.16em] text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[13px] text-ink">{stage.label}</span>
            </div>
            <div className="text-[11px] text-ink-faint">
              {stage.sub}
              {date ? ` · ${date}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
