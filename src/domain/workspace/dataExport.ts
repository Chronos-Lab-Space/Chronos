import type { Calibration } from "./calibration";
import { groupDecisionsWithVersions } from "./decision";
import type { WorkspaceHome } from "./types";

/**
 * Own-your-data export — decision history plus the calibration read on it.
 *
 * Pure formatting over what `WorkspaceHome` and `deriveCalibration` already
 * hold. Local-first means the record exists whether or not the workspace is
 * signed in; this just gives it a shape someone can carry out of the browser.
 */

function versionForExport(version: WorkspaceHome["recentSimulations"][number]) {
  return {
    id: version.id,
    version: version.version,
    status: version.status,
    confidence: version.confidence,
    chosenPathName: version.result.chosen_future_name ?? null,
    chosenAt: version.result.chosen_at ?? null,
    outcomeFollowed: version.result.outcome_followed ?? null,
    outcomeVerdict: version.result.outcome_verdict ?? null,
    createdAt: version.created_at,
  };
}

export function exportWorkspaceJson(home: WorkspaceHome, calibration: Calibration): string {
  const groups = groupDecisionsWithVersions(home);
  const payload = {
    exportedFrom: "Chronos",
    workspace: {
      id: home.workspace.id,
      name: home.workspace.name,
    },
    decisions: groups.map((g) => ({
      id: g.decision.id,
      title: g.decision.title,
      status: g.status,
      createdAt: g.decision.created_at,
      versions: g.versions.map(versionForExport),
    })),
    calibration: {
      totalMeasured: calibration.totalMeasured,
      excludedNotFollowed: calibration.excludedNotFollowed,
      unverifiedCount: calibration.unverifiedCount,
      partialCount: calibration.partialCount,
      bands: calibration.bands,
    },
  };
  return JSON.stringify(payload, null, 2);
}

const CSV_HEADER =
  "decision_id,decision_title,version,status,confidence,chosen_path,outcome_followed,outcome_verdict,created_at";

/** RFC 4180: quote a field only when it needs it, doubling embedded quotes. */
function csvField(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function exportWorkspaceCsv(home: WorkspaceHome): string {
  const groups = groupDecisionsWithVersions(home);
  const rows = groups.flatMap((g) =>
    g.versions.map((version) =>
      [
        g.decision.id,
        g.decision.title,
        version.version,
        version.status,
        version.confidence,
        version.result.chosen_future_name ?? null,
        version.result.outcome_followed ?? null,
        version.result.outcome_verdict ?? null,
        version.created_at,
      ]
        .map(csvField)
        .join(",")
    )
  );
  return [CSV_HEADER, ...rows].join("\n");
}
