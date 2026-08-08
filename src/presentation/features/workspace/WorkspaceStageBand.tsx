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
 *
 * Deliberately not interactive. The imported design let a click set the stage,
 * but stages are derived from real simulation state (`deriveDecisionBrief`);
 * a click that moved the band would assert lifecycle progress the workspace
 * has not made. Reading order is carried by `aria-current` instead.
 */
export function WorkspaceStageBand({ stages }: { stages: BriefStage[] }) {
  return (
    <div
      data-testid="stage-band"
      className="flex shrink-0 items-start overflow-x-auto border-b border-line px-3 pb-4 pt-4 sm:px-5 lg:px-10 lg:pb-[18px] lg:pt-5"
    >
      {stages.map((stage, i) => {
        const date = formatDay(stage.at);
        return (
          <div
            key={stage.id}
            aria-current={stage.state === "current" ? "step" : undefined}
            className={`min-w-[124px] flex-1 border-t-2 pr-3 pt-3 last:pr-0 ${
              stage.state === "current"
                ? "border-chronos"
                : stage.state === "past"
                  ? "border-chronos/45 opacity-[0.72]"
                  : "border-line opacity-40"
            }`}
          >
            <div className="mb-[5px] flex items-center gap-[7px]">
              <span className="font-mono text-[9.5px] tracking-[0.16em] text-ink-faint/75">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[13.5px] text-ink">{stage.label}</span>
            </div>
            <div className="text-[11.5px] text-ink-faint">
              {stage.sub}
              {date ? ` · ${date}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
