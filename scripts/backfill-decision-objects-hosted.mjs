/**
 * Repair hosted data when migration 20260730202201's SQL backfill never ran
 * (or rows arrived without decision_id). Mirrors private.backfill_decisions_from_lineages
 * and decisionIdForSimulation — same uuid pattern, earliest version names the decision.
 *
 *   SUPABASE_SECRET_KEY=… node scripts/backfill-decision-objects-hosted.mjs
 *   DRY_RUN=1 …  # plan only
 *
 * Idempotent: on-conflict ignore for decisions; only patches null decision_id.
 * Does not print secrets. Rotate any key pasted into chat after use.
 */

const URL = process.env.SUPABASE_URL || "https://gkyhqnjgwxlyzptpiiob.supabase.co";
const SEC = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.env.DRY_RUN === "1";

// Same pattern as private.decision_id_for_simulation / isUuid in domain.
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!SEC) {
  console.error("Need SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in env.");
  process.exit(1);
}

function decisionIdForSimulation(sim) {
  const lineage = typeof sim.lineage_id === "string" ? sim.lineage_id.trim() : "";
  return UUID.test(lineage) ? lineage.toLowerCase() : sim.id;
}

async function fetchAll(path) {
  const pageSize = 1000;
  let offset = 0;
  const rows = [];
  for (;;) {
    const res = await fetch(`${URL}/rest/v1/${path}&limit=${pageSize}&offset=${offset}`, {
      headers: { apikey: SEC, Authorization: `Bearer ${SEC}` },
    });
    if (!res.ok) throw new Error(`${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function main() {
  const sims = await fetchAll(
    "simulations?select=id,workspace_id,title,goal_id,created_at,version,lineage_id,decision_id"
  );
  const workspaces = await fetchAll("workspaces?select=id,owner_id");
  const ownerByWs = Object.fromEntries(workspaces.map((w) => [w.id, w.owner_id]));

  const unlinked = sims.filter((s) => s.decision_id == null);
  console.log(`sims=${sims.length} unlinked=${unlinked.length} workspaces=${workspaces.length}`);
  if (unlinked.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const byDecision = new Map();
  for (const s of unlinked) {
    const decisionId = decisionIdForSimulation(s);
    const list = byDecision.get(decisionId) ?? [];
    list.push(s);
    byDecision.set(decisionId, list);
  }

  const decisionRows = [];
  for (const [decisionId, versions] of byDecision) {
    versions.sort((a, b) => {
      const v = (a.version ?? 1) - (b.version ?? 1);
      if (v !== 0) return v;
      const t = String(a.created_at).localeCompare(String(b.created_at));
      if (t !== 0) return t;
      return String(a.id).localeCompare(String(b.id));
    });
    const first = versions[0];
    const owner = ownerByWs[first.workspace_id];
    if (!owner) {
      console.warn(`skip ${decisionId}: no owner for workspace ${first.workspace_id}`);
      continue;
    }
    decisionRows.push({
      id: decisionId,
      workspace_id: first.workspace_id,
      created_by: owner,
      title: (first.title && String(first.title).trim()) || "Untitled decision",
      description: "",
      goal_id: first.goal_id,
      created_at: first.created_at,
      updated_at: first.created_at,
    });
  }

  console.log(`decisions to upsert=${decisionRows.length}`);
  if (DRY) {
    console.log("DRY_RUN — no writes");
    return;
  }

  for (let i = 0; i < decisionRows.length; i += 50) {
    const batch = decisionRows.slice(i, i + 50);
    const res = await fetch(`${URL}/rest/v1/decisions`, {
      method: "POST",
      headers: {
        apikey: SEC,
        Authorization: `Bearer ${SEC}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`insert decisions ${res.status} ${await res.text()}`);
  }

  let patched = 0;
  for (const s of unlinked) {
    const decisionId = decisionIdForSimulation(s);
    const res = await fetch(`${URL}/rest/v1/simulations?id=eq.${s.id}`, {
      method: "PATCH",
      headers: {
        apikey: SEC,
        Authorization: `Bearer ${SEC}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ decision_id: decisionId }),
    });
    if (!res.ok) throw new Error(`patch sim ${s.id} ${res.status} ${await res.text()}`);
    patched++;
  }
  console.log(`patched simulations=${patched}`);
  console.log("Done. Re-run scripts/verify-decision-objects-hosted.mjs to confirm.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
