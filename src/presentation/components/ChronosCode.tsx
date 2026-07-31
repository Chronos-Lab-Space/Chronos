/**
 * Renders a Chronos Language program with syntax colour.
 *
 * Deliberately a highlighter over a source string rather than hand-written
 * coloured spans: the landing page once hand-built a snippet that no compiler
 * would accept. Concatenating every emitted part reproduces `source` exactly,
 * so what a reader sees is the string the tests compile.
 */

const KEYWORDS = new Set([
  "state",
  "action",
  "score",
  "run",
  "if",
  "return",
  "fork",
  "evaluate",
  "with",
  "collapse",
]);

/** Split on strings and identifiers, keeping delimiters so the join is lossless. */
const TOKENS = /("[^"]*"|[A-Za-z_][A-Za-z0-9_-]*)/g;

function renderLine(line: string) {
  if (line.trimStart().startsWith("#")) {
    return <span className="text-ink-faint">{line}</span>;
  }

  return line.split(TOKENS).map((part, i) => {
    // Index keys are stable here: the split of a fixed source never reorders.
    const key = `${i}-${part}`;
    if (part.startsWith('"')) {
      return (
        <span key={key} className="text-accent-warm">
          {part}
        </span>
      );
    }
    if (KEYWORDS.has(part)) {
      return (
        <span key={key} className="text-chronos">
          {part}
        </span>
      );
    }
    return (
      <span key={key} className="text-ink">
        {part}
      </span>
    );
  });
}

export function ChronosCode({ source }: { source: string }) {
  const lines = source.split("\n");
  return (
    <code>
      {lines.map((line, i) => (
        <span key={`${i}-${line}`}>
          {renderLine(line)}
          {/* Separator, not terminator — appending to every line would add a
              newline the source does not have. */}
          {i < lines.length - 1 ? "\n" : null}
        </span>
      ))}
    </code>
  );
}
