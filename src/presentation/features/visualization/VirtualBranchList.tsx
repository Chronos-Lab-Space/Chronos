import type { Branch } from "../../../domain/chronos/entities";
import { VirtualList } from "./VirtualList";

type VirtualBranchListProps = {
  branches: readonly Branch[];
};

/** DOM-efficient branch view for simulations with hundreds or thousands of paths. */
export function VirtualBranchList({ branches }: VirtualBranchListProps) {
  return (
    <VirtualList
      items={branches}
      height={440}
      rowHeight={76}
      getKey={(branch) => branch.id}
      className="px-4 py-3"
      renderRow={(branch) => {
        const color =
          branch.status === "winner"
            ? "#E2DDDA"
            : branch.status === "evaluated"
              ? "#CDCAB2"
              : branch.status === "pruned"
                ? "#989898"
                : "#60899B";

        return (
          <div
            className="mx-1 flex h-[68px] items-center gap-3 rounded-lg border border-line bg-bg/70 px-3"
            style={{ opacity: branch.status === "pruned" ? 0.45 : 1 }}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[12px] text-ink">{branch.actionName}</div>
              <div className="mt-1 truncate font-mono text-[10px] text-ink-faint">
                branch_{branch.id}
                {branch.reason ? ` · ${branch.reason}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[12px]" style={{ color }}>
                {branch.score === null ? "pending" : branch.score.toFixed(3)}
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                {branch.status}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
