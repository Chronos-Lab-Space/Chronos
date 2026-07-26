import { layoutFutureGraph } from "../../../domain/workspace/futureGraph";
import type { FutureRecord } from "../../../domain/workspace/types";

/**
 * Future graph — the branching visualization from the decision-workspace
 * design: NOW forks into ranked futures, each ending in a risk node.
 * Clicking a branch selects that future everywhere on the page.
 */
export function FutureGraph({
  futures,
  bestName,
  chosenFutureId,
  selectedId,
  onSelect,
}: {
  futures: readonly FutureRecord[];
  bestName: string | null;
  chosenFutureId: string | null;
  selectedId: string | null;
  onSelect: (futureId: string) => void;
}) {
  const layout = layoutFutureGraph(futures, { bestName, chosenId: chosenFutureId });
  if (!layout) return null;

  const { root, nodes, width, height } = layout;

  return (
    <section data-testid="future-graph" className="mt-6">
      <div className="flex items-baseline justify-between gap-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          Future graph
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          Click a branch to inspect
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-line bg-bg-soft/15 p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full font-mono"
          role="img"
          aria-label="Branching graph of simulated futures"
        >
          {/* edges first so nodes sit on top */}
          {nodes.map((node) => (
            <g key={`edges-${node.id}`}>
              <line
                x1={root.x}
                y1={root.y}
                x2={node.x}
                y2={node.y}
                stroke={node.recommended ? "#60899B" : "rgba(242,237,234,0.25)"}
                strokeWidth={node.recommended ? 1.4 : 1}
              />
              <line
                x1={node.x}
                y1={node.y}
                x2={node.tail.x}
                y2={node.tail.y}
                stroke={node.recommended ? "rgba(96,137,155,0.45)" : "rgba(242,237,234,0.16)"}
                strokeWidth={1}
              />
            </g>
          ))}

          <circle cx={root.x} cy={root.y} r={9} fill="#60899B" />
          <circle cx={root.x} cy={root.y} r={17} fill="none" stroke="rgba(96,137,155,0.45)" />
          <text
            x={root.x}
            y={root.y + 36}
            fill="#989898"
            fontSize={10}
            letterSpacing={1.6}
            textAnchor="middle"
          >
            NOW
          </text>

          {nodes.map((node) => {
            const active = selectedId === node.id;
            return (
              // biome-ignore lint/a11y/useSemanticElements: SVG has no <button>; role + aria-label is the accessible pattern for clickable graph nodes
              <g
                key={node.id}
                data-testid="future-graph-node"
                role="button"
                aria-label={`${node.name}, ${node.scorePct}%`}
                onClick={() => onSelect(node.id)}
                style={{ cursor: "pointer" }}
              >
                {/* hit target so clicks between node and labels don't fall through */}
                <rect
                  x={node.x - 20}
                  y={node.y - 22}
                  width={node.tail.x - node.x + 130}
                  height={44}
                  fill="transparent"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.recommended ? 9 : 7}
                  fill={active || node.chosen ? "#60899B" : "#111111"}
                  stroke={node.recommended ? "#60899B" : "rgba(242,237,234,0.3)"}
                />
                <text
                  x={node.x + 22}
                  y={node.y - 2}
                  fill={node.recommended ? "#60899B" : "#C4C2AA"}
                  fontSize={node.recommended ? 14 : 13}
                >
                  {node.scorePct}%
                </text>
                <text x={node.x + 22} y={node.y + 14} fill="#989898" fontSize={10}>
                  {node.name.length > 24
                    ? `${node.name.slice(0, 24).toUpperCase()}…`
                    : node.name.toUpperCase()}
                  {node.chosen ? " · CHOSEN" : ""}
                </text>
                <circle
                  cx={node.tail.x}
                  cy={node.tail.y}
                  r={node.recommended ? 5 : 4}
                  fill={node.recommended ? "rgba(42,77,95,0.55)" : "rgba(242,237,234,0.12)"}
                  stroke={node.recommended ? "rgba(96,137,155,0.45)" : "rgba(242,237,234,0.3)"}
                />
                <text
                  x={node.tail.x + 14}
                  y={node.tail.y + 4}
                  fill="rgba(152,152,152,0.8)"
                  fontSize={10}
                >
                  {node.tail.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
