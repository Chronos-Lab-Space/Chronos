/**
 * One-shot hosted probe using secret key (admin) + publishable key (user).
 * Does not print secrets. Safe to run locally; deletes probe user after.
 */
const URL = process.env.SUPABASE_URL || "https://gkyhqnjgwxlyzptpiiob.supabase.co";
const SEC = process.env.SUPABASE_SECRET_KEY;
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SEC || !PUB) {
  console.error("Need SUPABASE_SECRET_KEY and SUPABASE_PUBLISHABLE_KEY in env");
  process.exit(1);
}

const email = `repair.probe.${Date.now()}@chronoslab.space`;
const password = `Probe-Repair-${Math.random().toString(36).slice(2)}Aa1!`;

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  console.log("=== create confirmed probe user ===");
  const createRes = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SEC,
      Authorization: `Bearer ${SEC}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const created = await json(createRes);
  console.log("create", createRes.status, created.id ? `id=${created.id}` : created);

  if (!created.id) process.exit(1);

  console.log("=== password login ===");
  const loginRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: PUB,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const login = await json(loginRes);
  console.log("login", loginRes.status, login.access_token ? "token_ok" : login);
  const token = login.access_token;
  if (!token) process.exit(1);

  const authHeaders = {
    apikey: PUB,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // publishable anon events
  console.log("=== events INSERT (publishable / anon role via user JWT still authenticated) ===");
  let r = await fetch(`${URL}/rest/v1/events`, {
    method: "POST",
    headers: { ...authHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({
      event: "auth_probe",
      path: "/ops",
      user_id: created.id,
    }),
  });
  console.log("events auth", r.status, (await r.text()).slice(0, 200));

  r = await fetch(`${URL}/rest/v1/events`, {
    method: "POST",
    headers: {
      apikey: PUB,
      Authorization: `Bearer ${PUB}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ event: "anon_probe", path: "/ops" }),
  });
  console.log("events publishable-as-bearer", r.status, (await r.text()).slice(0, 200));

  // decision loop tables
  const wsId = crypto.randomUUID();
  const goalId = crypto.randomUUID();
  const simId = crypto.randomUUID();
  const futureId = crypto.randomUUID();
  const now = new Date().toISOString();

  r = await fetch(`${URL}/rest/v1/workspaces`, {
    method: "POST",
    headers: { ...authHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      id: wsId,
      owner_id: created.id,
      name: "Repair Probe Workspace",
      description: "ops",
      created_at: now,
    }),
  });
  console.log("workspaces insert", r.status, (await r.text()).slice(0, 250));

  r = await fetch(`${URL}/rest/v1/goals`, {
    method: "POST",
    headers: { ...authHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      id: goalId,
      workspace_id: wsId,
      title: "Probe goal",
      description: "",
      status: "active",
      priority: 1,
      created_at: now,
    }),
  });
  console.log("goals insert", r.status, (await r.text()).slice(0, 250));

  r = await fetch(`${URL}/rest/v1/simulations`, {
    method: "POST",
    headers: { ...authHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      id: simId,
      workspace_id: wsId,
      goal_id: goalId,
      title: "Probe sim",
      status: "completed",
      confidence: 0.8,
      result: {
        chosen_future_id: futureId,
        chosen_future_name: "Path A",
        best_future: "Path A",
      },
      created_at: now,
      version: 1,
      lineage_id: simId,
      parent_simulation_id: null,
    }),
  });
  console.log("simulations insert", r.status, (await r.text()).slice(0, 300));

  r = await fetch(`${URL}/rest/v1/futures`, {
    method: "POST",
    headers: { ...authHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      id: futureId,
      simulation_id: simId,
      name: "Path A",
      score: 0.9,
      risk: 0.2,
      confidence: 0.8,
      summary: "probe",
    }),
  });
  console.log("futures insert", r.status, (await r.text()).slice(0, 300));

  r = await fetch(`${URL}/rest/v1/simulations?id=eq.${simId}&select=id,title,result`, {
    headers: authHeaders,
  });
  console.log("simulations select", r.status, (await r.text()).slice(0, 300));

  // cleanup workspace data with secret (bypass RLS)
  console.log("=== cleanup with secret key ===");
  for (const [table, filter] of [
    ["futures", `simulation_id=eq.${simId}`],
    ["simulations", `id=eq.${simId}`],
    ["goals", `id=eq.${goalId}`],
    ["workspaces", `id=eq.${wsId}`],
  ]) {
    r = await fetch(`${URL}/rest/v1/${table}?${filter}`, {
      method: "DELETE",
      headers: {
        apikey: SEC,
        Authorization: `Bearer ${SEC}`,
      },
    });
    console.log(`delete ${table}`, r.status);
  }

  r = await fetch(`${URL}/auth/v1/admin/users/${created.id}`, {
    method: "DELETE",
    headers: { apikey: SEC, Authorization: `Bearer ${SEC}` },
  });
  console.log("delete user", r.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
