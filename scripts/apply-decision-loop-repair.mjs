/**
 * Apply decision_loop_cloud_repair.sql to hosted Postgres.
 *
 * Requires database password (Dashboard → Project Settings → Database),
 * NOT the API secret key. API secrets cannot run GRANT/DDL.
 *
 * Usage:
 *   SUPABASE_DB_PASSWORD='your-db-password' node scripts/apply-decision-loop-repair.mjs
 *
 * Optional:
 *   SUPABASE_DB_HOST=aws-1-ap-northeast-2.pooler.supabase.com
 *   SUPABASE_PROJECT_REF=gkyhqnjgwxlyzptpiiob
 */
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

dns.setDefaultResultOrder("ipv4first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migration = path.join(
  root,
  "supabase/migrations/20260722100447_decision_loop_cloud_repair.sql"
);

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
  connectionTimeoutMillis: 15_000,
});

await client.connect();
console.log("connected", host);
await client.query(sql);
console.log("applied", path.basename(migration));

const { rows } = await client.query(`
  select
    has_table_privilege('anon', 'public.events', 'INSERT') as anon_events_insert,
    has_table_privilege('authenticated', 'public.workspaces', 'SELECT') as auth_workspaces_select,
    has_table_privilege('authenticated', 'public.simulations', 'INSERT') as auth_simulations_insert
`);
console.log("privileges", rows[0]);
await client.end();
console.log("done");
