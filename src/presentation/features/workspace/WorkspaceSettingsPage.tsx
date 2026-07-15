import { useState } from "react";
import { useWorkspace } from "./WorkspaceContext";

/** Workspace settings — switch, create, inspect. */
export function WorkspaceSettingsPage() {
  const { home, workspaces, createWorkspace, switchWorkspace, error } = useWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!home) return null;

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await createWorkspace(name.trim() || "New workspace", description.trim());
      setName("");
      setDescription("");
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onSwitch = async (id: string) => {
    if (id === home.workspace.id) return;
    setBusy(true);
    setLocalError(null);
    try {
      await switchWorkspace(id);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">Settings</div>
        <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">Workspaces</h1>
        <p className="mt-2 text-sm text-ink-dim">
          Create a new HQ anytime. Switch without losing history — each workspace keeps its own
          goals, knowledge, and simulations.
        </p>
      </div>

      {/* Active */}
      <section className="border border-line p-4 sm:p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">Active</div>
        <dl className="mt-4 space-y-3">
          <Row label="Name" value={home.workspace.name} />
          <Row label="Description" value={home.workspace.description || "—"} />
          <Row label="Goal" value={home.goal?.title ?? "—"} />
          <Row label="Simulations" value={String(home.recentSimulations.length)} />
          <Row label="Knowledge" value={String(home.knowledge.length)} />
        </dl>
      </section>

      {/* Switch */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Your workspaces ({workspaces.length})
        </div>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {workspaces.map((ws) => {
            const active = ws.id === home.workspace.id;
            return (
              <li key={ws.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink">
                    {ws.name}
                    {active && (
                      <span className="ml-2 font-mono text-[10px] uppercase text-chronos">active</span>
                    )}
                  </div>
                  {ws.description ? (
                    <div className="truncate text-xs text-ink-dim">{ws.description}</div>
                  ) : null}
                </div>
                {!active && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onSwitch(ws.id)}
                    className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-ink hover:border-chronos/50 hover:text-chronos disabled:opacity-50"
                  >
                    Switch
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Create new */}
      <section className="border border-line p-4 sm:p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
          Create new workspace
        </div>
        <form onSubmit={onCreate} className="mt-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workspace name"
            required
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos disabled:opacity-50 sm:w-auto"
          >
            {busy ? "Creating…" : "Create workspace"}
          </button>
        </form>
        {(localError || error) && (
          <p className="mt-3 text-sm text-red-400">{localError || error}</p>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
      <dd className="max-w-[70%] break-all text-right text-sm text-ink">{value}</dd>
    </div>
  );
}
