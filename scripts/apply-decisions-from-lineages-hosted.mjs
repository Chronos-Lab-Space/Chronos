/**
 * Apply 20260730202201_decisions_from_lineages.sql to hosted Postgres.
 *
 * Requires the **database password** (Dashboard → Project Settings → Database),
 * NOT the API secret (`sb_secret_…`). API secrets cannot run DDL / CREATE FUNCTION.
 *
 *   SUPABASE_DB_PASSWORD='…' node scripts/apply-decisions-from-lineages-hosted.mjs
 *
 * Optional:
 *   SUPABASE_DB_HOST=aws-1-ap-northeast-2.pooler.supabase.com
 *   SUPABASE_PROJECT_REF=gkyhqnjgwxlyzptpiiob
 *   SUPABASE_DB_PORT=6543
 *
 * Idempotent: backfill is safe to re-run; create or replace for functions.
 * After: OpenAPI comment on save_workspace_home should include "decisions included".
 */
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

dns.setDefaultResultOrder("ipv4first");

const require = createRequire(import.meta.url);
let pg;
try {
  pg = require("pg");
} catch {
  console.error("Missing package `pg`. Install once:\n  npm install pg --no-save\nthen re-run.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migration = path.join(root, "supabase/migrations/20260730202201_decisions_from_lineages.sql");

const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
const ref = process.env.SUPABASE_PROJECT_REF || "gkyhqnjgwxlyzptpiiob";
const host = process.env.SUPABASE_DB_HOST || "aws-1-ap-northeast-2.pooler.supabase.com";

if (!password) {
  console.error("Missing SUPABASE_DB_PASSWORD (Database settings password, not sb_secret_).");
  process.exit(1);
}

const sql = fs.readFileSync(migration, "utf8");
const client = new pg.Client({
  host,
  port: Number(process.env.SUPABASE_DB_PORT || 6543),
  user: `postgres.${ref}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
});

await client.connect();
console.log("connected", host);

await client.query("begin");
try {
  await client.query(sql);
  // Keep hosted migration history honest when the table exists (column set
  // differs by CLI era — try version-only first, then version+name).
  const booked = await client.query(`
    select 1 from information_schema.tables
    where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
  `);
  if (booked.rowCount > 0) {
    const exists = await client.query(
      `select 1 from supabase_migrations.schema_migrations where version = $1`,
      ["20260730202201"]
    );
    if (exists.rowCount === 0) {
      try {
        await client.query(
          `insert into supabase_migrations.schema_migrations (version) values ($1)`,
          ["20260730202201"]
        );
      } catch {
        await client.query(
          `insert into supabase_migrations.schema_migrations (version, name)
           values ($1, $2)`,
          ["20260730202201", "decisions_from_lineages"]
        );
      }
      console.log("recorded version 20260730202201 in schema_migrations");
    } else {
      console.log("schema_migrations already has 20260730202201");
    }
  }
  await client.query("commit");
} catch (err) {
  await client.query("rollback");
  throw err;
}

const { rows: comment } = await client.query(`
  select obj_description(p.oid) as comment
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'save_workspace_home'
`);
console.log("save_workspace_home comment:", comment[0]?.comment ?? "(none)");

const { rows: counts } = await client.query(`
  select
    count(*) filter (where decision_id is null) as unlinked,
    count(distinct decision_id) as decisions_linked,
    (select count(*) from public.decisions) as decision_rows
  from public.simulations
`);
console.log("post-apply counts:", counts[0]);

await client.end();

const ok = String(comment[0]?.comment ?? "").includes("decisions included");
if (!ok) {
  console.error("FAIL: save_workspace_home comment still missing 'decisions included'");
  process.exit(2);
}
console.log("PASS: migration applied; save_workspace_home carries decisions.");
