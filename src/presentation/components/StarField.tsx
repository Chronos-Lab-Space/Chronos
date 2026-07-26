const stars = [
  [4, 8, 1.1, 0.35],
  [9, 27, 0.8, 0.25],
  [14, 13, 0.65, 0.4],
  [19, 48, 1.15, 0.32],
  [24, 20, 0.7, 0.28],
  [29, 68, 0.9, 0.34],
  [34, 37, 0.6, 0.26],
  [39, 7, 1.35, 0.38],
  [45, 56, 0.65, 0.3],
  [49, 31, 0.8, 0.25],
  [55, 14, 1.1, 0.34],
  [61, 76, 0.65, 0.25],
  [67, 43, 1.2, 0.4],
  [72, 20, 0.7, 0.3],
  [78, 62, 0.9, 0.35],
  [83, 9, 0.6, 0.28],
  [89, 35, 1.1, 0.36],
  [94, 71, 0.7, 0.3],
  [7, 83, 0.65, 0.26],
  [17, 92, 1.1, 0.33],
  [28, 79, 0.8, 0.29],
  [37, 88, 0.6, 0.25],
  [48, 95, 1.25, 0.4],
  [59, 85, 0.7, 0.28],
  [70, 94, 0.9, 0.32],
  [81, 82, 0.65, 0.27],
  [91, 91, 1.05, 0.35],
  [97, 51, 0.6, 0.24],
] as const;

const flares = [
  [18, 18],
  [74, 31],
  [52, 72],
  [90, 62],
] as const;

/** Low-contrast spatial depth for the full platform, deliberately behind all UI. */
export function StarField() {
  return (
    <svg
      className="star-field fixed inset-0 z-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="star-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#E2DDDA" stopOpacity="0.8" />
          <stop offset="0.22" stopColor="#60899B" stopOpacity="0.35" />
          <stop offset="1" stopColor="#60899B" stopOpacity="0" />
        </radialGradient>
      </defs>
      {stars.map(([x, y, radius, opacity], index) => (
        <circle
          key={index}
          className="star-field-dot"
          cx={x}
          cy={y}
          r={radius / 5}
          fill={index % 7 === 0 ? "#CDCAB2" : index % 11 === 0 ? "#E2DDDA" : "#60899B"}
          opacity={opacity}
          style={{ animationDelay: `${(index % 9) * 0.7}s` }}
        />
      ))}
      {flares.map(([x, y], index) => (
        <g
          key={`flare-${index}`}
          className="star-field-flare"
          style={{ animationDelay: `${index * 1.4}s` }}
        >
          <circle cx={x} cy={y} r="1.65" fill="url(#star-glow)" opacity="0.48" />
          <path
            d={`M${x - 0.65} ${y}H${x + 0.65}M${x} ${y - 0.65}V${y + 0.65}`}
            stroke="#60899B"
            strokeWidth="0.13"
            opacity="0.55"
          />
        </g>
      ))}
    </svg>
  );
}
