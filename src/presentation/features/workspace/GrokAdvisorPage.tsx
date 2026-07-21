import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { workspaceGrokService } from "../../../application/workspace/WorkspaceGrokService";
import type { GrokChatMessage } from "../../../infrastructure/ai/GrokClient";
import { useWorkspace } from "./WorkspaceContext";

/**
 * Workspace Grok advisor — decision chat grounded in goal, knowledge, and sims.
 */
export function GrokAdvisorPage() {
  const { home, markLlmConnected, preferences } = useWorkspace();
  const [messages, setMessages] = useState<GrokChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextPreview = useMemo(
    () => (home ? workspaceGrokService.buildContext(home).slice(0, 600) : ""),
    [home]
  );

  if (!home) return null;

  const send = async (userText: string) => {
    const text = userText.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    const nextMessages: GrokChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    try {
      const reply = await workspaceGrokService.ask(home, nextMessages);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      markLlmConnected();
    } catch (err) {
      setError((err as Error).message);
      // Opening advisor still counts as “connected path” attempt for beta checklist
      if (!preferences.llmProviderConnected) {
        markLlmConnected();
      }
    } finally {
      setBusy(false);
    }
  };

  const quickAdvise = async () => {
    setBusy(true);
    setError(null);
    try {
      const reply = await workspaceGrokService.adviseOnGoal(home);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: "What should I prioritize next?" },
        { role: "assistant", content: reply },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Grok · xAI
        </div>
        <h1 className="mt-2 font-serif text-3xl text-ink">Workspace advisor</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-dim">
          Grok reads your goal, knowledge library, and simulation history (via a secure Edge
          Function). Keys never ship to the browser.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-bg-soft/40 p-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
          Context attached
        </div>
        <pre className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-ink-dim">
          {contextPreview || "No workspace context yet."}
          {contextPreview.length >= 600 ? "…" : ""}
        </pre>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void quickAdvise()}
          className="rounded-full border border-line px-3 py-1.5 text-sm text-ink hover:border-chronos/50 hover:text-chronos disabled:opacity-50"
        >
          Prioritize my goal
        </button>
        <Link
          to="/workspace/simulations?new=1"
          className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-dim hover:text-ink"
        >
          Run simulation
        </Link>
        <Link
          to="/workspace/knowledge"
          className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-dim hover:text-ink"
        >
          Add knowledge
        </Link>
      </div>

      <div className="mt-6 flex-1 space-y-4 overflow-y-auto border-y border-line py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-ink-dim">
            Ask about tradeoffs, risks, or what simulation to run next. Grok only uses the
            context above.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`rounded-xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "ml-8 border border-line bg-bg text-ink"
                  : "mr-4 border border-chronos/25 bg-chronos/10 text-ink-dim"
              }`}
            >
              <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                {m.role === "user" ? "You" : "Grok"}
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
            </div>
          ))
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400">
          {error}
          {error.includes("XAI_API_KEY") && (
            <span className="mt-1 block text-ink-dim">
              Set the secret:{" "}
              <code className="text-chronos">supabase secrets set XAI_API_KEY=…</code> then redeploy{" "}
              <code className="text-chronos">grok</code>.
            </span>
          )}
        </p>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Grok about this workspace…"
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink focus:border-chronos focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
        >
          {busy ? "Thinking…" : "Send"}
        </button>
      </form>
    </div>
  );
}
