/**
 * SPEC-decision-object.md criterion 1 — hosted verification.
 *
 *   select count(*) filter (where decision_id is null) as unlinked,
 *          count(distinct decision_id) as decisions
 *   from public.simulations;
 *
 * Needs the service role (bypasses RLS). Does not print secrets.
 *
 *   SUPABASE_SECRET_KEY=… node scripts/verify-decision-objects-hosted.mjs
 *
 * Optional: SUPABASE_URL (defaults to the Chronos Lab project).
 * Expectation from the spec era: 0 unlinked, ~21 decisions for ~49 sims.
 * Counts drift as users run more — pass = unlinked === 0 and decisions > 0.
 */

const URL = process.env.SUPABASE_URL || "https://gkyhqnjgwxlyzptpiiob.supabase.co";
const SEC = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SEC) {
  console.error(
    "Need SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in env.\n" +
      "  export SUPABASE_SECRET_KEY=…\n" +
      "  node scripts/verify-decision-objects-hosted.mjs"
  );
  process.exit(1);
}

async function fetchAll(path) {
  const pageSize = 1000;
  let offset = 0;
  const rows = [];
  for (;;) {
    const res = await fetch(`${URL}/rest/v1/${path}&limit=${pageSize}&offset=${offset}`, {
      headers: {
        apikey: SEC,
        Authorization: `Bearer ${SEC}`,
        Prefer: "count=exact",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${path} → ${res.status}: ${body.slice(0, 300)}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch)) throw new Error(`unexpected payload for ${path}`);
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function main() {
  const sims = await fetchAll("simulations?select=id,decision_id");
  const decisions = await fetchAll("decisions?select=id");

  const unlinked = sims.filter((s) => s.decision_id == null).length;
  const distinctLinked = new Set(sims.map((s) => s.decision_id).filter((id) => id != null)).size;
  const decisionRows = decisions.length;

  console.log("=== SPEC-decision-object criterion 1 ===");
  console.log(`simulations:          ${sims.length}`);
  console.log(`unlinked (null id):   ${unlinked}`);
  console.log(`distinct decision_id: ${distinctLinked}`);
  console.log(`decisions rows:       ${decisionRows}`);
  console.log(`(spec-era expect ~49 sims / 0 unlinked / ~21 decisions)`);

  const ok = unlinked === 0 && decisionRows > 0 && distinctLinked === decisionRows;
  if (!ok) {
    console.error("\nFAIL");
    if (unlinked > 0) {
      console.error(`  ${unlinked} simulation(s) still have decision_id null — re-run backfill.`);
    }
    if (decisionRows === 0) {
      console.error("  decisions table is empty.");
    }
    if (distinctLinked !== decisionRows) {
      console.error(
        `  distinct linked ids (${distinctLinked}) ≠ decision rows (${decisionRows}) — orphans or drift.`
      );
    }
    process.exit(2);
  }

  console.log("\nPASS — every simulation has a decision_id; decision rows match linked set.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
