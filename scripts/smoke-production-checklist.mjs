/**
 * Post-deploy smoke checklist (ops).
 *
 *   SUPABASE_SECRET_KEY=… node scripts/smoke-production-checklist.mjs
 *
 * Checks: ai_usage readable, decisions linked, deploy flag reminder.
 * Does not print secrets.
 */

const URL = process.env.SUPABASE_URL || "https://gkyhqnjgwxlyzptpiiob.supabase.co";
const SEC = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SEC) {
  console.error("Need SUPABASE_SECRET_KEY for hosted smoke.");
  process.exit(1);
}

async function get(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: SEC, Authorization: `Bearer ${SEC}` },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

const sims = await get("simulations?select=id,decision_id&limit=1000");
const unlinked = sims.filter((s) => !s.decision_id).length;
const usage = await get("ai_usage?select=id,created_at,model,ok&order=created_at.desc&limit=5");

console.log("=== production smoke ===");
console.log(`simulations sampled: ${sims.length}, unlinked: ${unlinked}`);
console.log(`ai_usage latest rows: ${usage.length}`);
if (usage[0]) {
  console.log(`  latest: ${usage[0].model} ok=${usage[0].ok} at ${usage[0].created_at}`);
}

const ok = unlinked === 0;
console.log(ok ? "\nPASS — decisions linked." : "\nWARN — unlinked simulations remain.");
console.log(
  usage.length
    ? "PASS — ai_usage has data (proxy was used at least once)."
    : "NOTE — ai_usage empty; signed-in enrich with VITE_AI_PROVIDER=proxy should write rows."
);
console.log(
  "Manual: open a completed sim → knowledge-delta panel; re-run after adding knowledge → replay-comparison."
);
process.exit(ok ? 0 : 2);
