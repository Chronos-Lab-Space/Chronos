import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  caveatForConfidence,
  deriveCalibration,
  formatConfidenceCaveat,
} from "../../../../domain/workspace/calibration";
import type { WorkspaceHome } from "../../../../domain/workspace/types";

/**
 * Slice 3 — sit a measured band history next to a claimed confidence.
 *
 * Renders nothing until that band has enough followed, verdicted runs.
 * Never rewrites the number; links to Memory for the full panel.
 */
export function ConfidenceCaveatNote({
  home,
  confidence,
  className = "",
}: {
  home: WorkspaceHome;
  confidence: number | null | undefined;
  className?: string;
}) {
  const text = useMemo(() => {
    if (typeof confidence !== "number") return null;
    const caveat = caveatForConfidence(deriveCalibration(home), confidence);
    return caveat ? formatConfidenceCaveat(caveat) : null;
  }, [home, confidence]);

  if (!text) return null;

  return (
    <p
      data-testid="confidence-caveat"
      className={`max-w-2xl text-xs leading-relaxed text-ink-faint ${className}`.trim()}
    >
      {text}{" "}
      <Link to="/workspace/memory" className="text-chronos underline-offset-2 hover:underline">
        Full calibration
      </Link>
    </p>
  );
}
