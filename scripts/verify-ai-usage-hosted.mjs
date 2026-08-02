/**
 * Ops: sample hosted ai_usage (service role) or own rows (user JWT).
 *
 *   SUPABASE_SECRET_KEY=… node scripts/verify-ai-usage-hosted.mjs
 *
 * Does not print secrets. After proxy deploy, expect rows for signed-in enrich.
 */

const URL = process.env.SUPABASE_URL || "https://gkyhqnjgwxlyzptpiiob.supabase.co";
const SEC = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SEC) {
  console.error("Need SUPABASE_SECRET_KEY (service role) in env.");
  process.exit(1);
}

const res = await fetch(
  `${URL}/rest/v1/ai_usage?select=id,created_at,model,input_tokens,output_tokens,ok,user_id&order=created_at.desc&limit=20`,
  {
    headers: {
      apikey: SEC,
      Authorization: `Bearer ${SEC}`,
    },
  }
);

if (!res.ok) {
  console.error("query failed", res.status, await res.text());
  process.exit(1);
}

const rows = await res.json();
console.log("=== ai_usage (latest 20) ===");
console.log(`rows: ${rows.length}`);
if (rows.length === 0) {
  console.log(
    "No rows yet. Signed-in enrich/plan with VITE_AI_PROVIDER=proxy should write here; anonymous does not."
  );
  process.exit(0);
}

let ok = 0;
let fail = 0;
let inTok = 0;
let outTok = 0;
for (const r of rows) {
  if (r.ok) ok += 1;
  else fail += 1;
  inTok += r.input_tokens ?? 0;
  outTok += r.output_tokens ?? 0;
}
console.log(`ok=${ok} failed=${fail} input_tokens=${inTok} output_tokens=${outTok}`);
console.log("latest models:", [...new Set(rows.map((r) => r.model))].join(", "));
console.log("PASS — table readable; ledger has data.");
