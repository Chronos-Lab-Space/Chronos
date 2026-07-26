import { FUTURES, type FutureKey } from '../data/futures'
import { useWorkspace } from '../workspace/workspace-context'

const EDGE_FAINT = 'rgba(242,237,234,0.3)'
const EDGE_TAIL = 'rgba(242,237,234,0.2)'
const EDGE_ACCENT = 'rgba(96,137,155,0.45)'

/** Branch nodes, top to bottom. Geometry is transcribed from the design. */
const NODES: {
  key: FutureKey
  cy: number
  r: number
  textX: number
  pctSize: number
  pctFill: string
  stroke: string
}[] = [
  { key: 'b', cy: 72, r: 7, textX: 272, pctSize: 13, pctFill: '#C4C2AA', stroke: EDGE_FAINT },
  { key: 'a', cy: 158, r: 9, textX: 274, pctSize: 14, pctFill: '#60899B', stroke: '#60899B' },
  { key: 'c', cy: 244, r: 7, textX: 272, pctSize: 13, pctFill: '#C4C2AA', stroke: EDGE_FAINT },
  { key: 'd', cy: 330, r: 7, textX: 272, pctSize: 13, pctFill: '#C4C2AA', stroke: EDGE_FAINT },
]

/** Terminal outcomes on the right edge. */
const OUTCOMES = [
  { cy: 46, r: 4, label: 'CHURN SPIKE', fill: 'rgba(242,237,234,0.12)', stroke: EDGE_FAINT, dim: true },
  { cy: 102, r: 4, label: 'COST BREACH', fill: 'rgba(242,237,234,0.12)', stroke: EDGE_FAINT, dim: true },
  {
    cy: 140,
    r: 5,
    label: 'D+30 · 43% RET',
    fill: 'rgba(42,77,95,0.55)',
    stroke: EDGE_ACCENT,
    dim: false,
  },
  {
    cy: 192,
    r: 5,
    label: 'D+30 · 38% RET',
    fill: 'rgba(42,77,95,0.55)',
    stroke: EDGE_ACCENT,
    dim: false,
  },
  { cy: 252, r: 4, label: 'FLAT GROWTH', fill: 'rgba(242,237,234,0.12)', stroke: EDGE_FAINT, dim: true },
  { cy: 330, r: 4, label: 'WINDOW LOST', fill: 'rgba(242,237,234,0.12)', stroke: EDGE_FAINT, dim: true },
]

export function FutureGraph() {
  const { selected, selectFuture } = useWorkspace()

  return (
    <svg viewBox="0 0 560 400" className="block h-auto w-full font-mono">
      {/* root → branch */}
      <line x1="70" y1="200" x2="250" y2="72" stroke={EDGE_FAINT} strokeWidth="1" />
      <line x1="70" y1="200" x2="250" y2="158" stroke="#60899B" strokeWidth="1.4" />
      <line x1="70" y1="200" x2="250" y2="244" stroke={EDGE_FAINT} strokeWidth="1" />
      <line x1="70" y1="200" x2="250" y2="330" stroke={EDGE_FAINT} strokeWidth="1" />
      {/* branch → outcome */}
      <line x1="250" y1="72" x2="440" y2="46" stroke={EDGE_TAIL} strokeWidth="1" />
      <line x1="250" y1="72" x2="440" y2="102" stroke={EDGE_TAIL} strokeWidth="1" />
      <line x1="250" y1="158" x2="440" y2="140" stroke={EDGE_ACCENT} strokeWidth="1" />
      <line x1="250" y1="158" x2="440" y2="192" stroke={EDGE_ACCENT} strokeWidth="1" />
      <line x1="250" y1="244" x2="440" y2="252" stroke={EDGE_TAIL} strokeWidth="1" />
      <line x1="250" y1="330" x2="440" y2="330" stroke={EDGE_TAIL} strokeWidth="1" />

      <circle cx="70" cy="200" r="9" fill="#60899B" />
      <circle cx="70" cy="200" r="17" fill="none" stroke={EDGE_ACCENT} />
      <text x="70" y="238" fill="#989898" fontSize="10" letterSpacing="1.6" textAnchor="middle">
        NOW
      </text>

      {NODES.map((node) => {
        const future = FUTURES[node.key]
        return (
          <g
            key={node.key}
            onClick={() => selectFuture(node.key)}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label={`${future.shortLabel}, ${future.pct}`}
          >
            {/* Hit target covering the node and its labels, so clicks in the gaps
                between them don't fall through to the edges underneath. */}
            <rect x="230" y={node.cy - 19} width="200" height="38" fill="transparent" />
            <circle
              cx="250"
              cy={node.cy}
              r={node.r}
              fill={selected === node.key ? '#60899B' : '#111111'}
              stroke={node.stroke}
            />
            <text x={node.textX} y={node.cy - 2} fill={node.pctFill} fontSize={node.pctSize}>
              {future.pct}
            </text>
            <text x={node.textX} y={node.cy + 14} fill="#989898" fontSize="10">
              {future.graphLabel}
            </text>
          </g>
        )
      })}

      {OUTCOMES.map((outcome) => (
        <g key={outcome.cy}>
          <circle cx="440" cy={outcome.cy} r={outcome.r} fill={outcome.fill} stroke={outcome.stroke} />
          <text
            x="455"
            y={outcome.cy + 4}
            fill={outcome.dim ? 'rgba(152,152,152,0.75)' : '#989898'}
            fontSize="10"
          >
            {outcome.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
