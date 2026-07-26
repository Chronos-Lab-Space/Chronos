type ChronosCMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

/**
 * Chronos C: two temporal orbits around a clear open C. It borrows the
 * supplied atomic silhouette, but the central glyph makes it distinctly Chronos.
 */
export function ChronosCMark({ size = 28, className, title = "Chronos Lab" }: ChronosCMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      {/* Two tilted loops, retaining the memorable atomic/orbital silhouette. */}
      <ellipse
        cx="32"
        cy="32"
        rx="12.5"
        ry="28"
        transform="rotate(-47 32 32)"
        stroke="currentColor"
        strokeWidth="6.2"
        strokeLinecap="round"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="12.5"
        ry="28"
        transform="rotate(47 32 32)"
        stroke="currentColor"
        strokeWidth="6.2"
        strokeLinecap="round"
      />

      {/* The open central C makes the generic atom unmistakably Chronos. */}
      <circle cx="32" cy="32" r="15" fill="currentColor" opacity="0.1" />
      <path
        d="M40.5 23.4C38.1 20.7 35.2 19.5 31.7 19.5C24.5 19.5 19.3 24.7 19.3 32C19.3 39.3 24.5 44.5 31.7 44.5C35.2 44.5 38.1 43.3 40.5 40.6"
        stroke="currentColor"
        strokeWidth="5.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Chosen future node: one point of resolution at the open end of C. */}
      <circle cx="43" cy="32" r="4.5" fill="currentColor" opacity="0.2" />
      <circle cx="43" cy="32" r="1.5" fill="currentColor" />
    </svg>
  );
}
