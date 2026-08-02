import { useEffect, useState } from "react";
import {
  fetchOwnAiUsage,
  type AiUsageSummary,
} from "../../../../infrastructure/queries/AiUsageQueries";
import { isSupabaseConfigured } from "../../../../infrastructure/supabase/client";

/**
 * Second LLM surface for operators: show what the hosted proxy has billed
 * against this account. Read-only; fails open to empty when offline / anon.
 */
export function AiUsagePanel() {
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSummary({
        rows: [],
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        failedCalls: 0,
        callsLastMinute: 0,
      });
      return;
    }
    let cancelled = false;
    void fetchOwnAiUsage(40)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      data-testid="ai-usage-panel"
      className="rounded-2xl border border-line bg-bg/50 p-5 sm:p-6"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
        Hosted AI usage
      </div>
      <h2 className="mt-2 font-serif text-xl text-ink">What the proxy has spent for you</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">
        Rows are written by the server-side <code className="text-ink">ai-generate</code> function
        when enrichment or plan prose uses the hosted model. Ranking and scores never appear here —
        they never touch the model. Anonymous sessions make no cloud AI calls.
      </p>

      {error && <p className="mt-3 text-sm text-amber-700">{error}</p>}

      {!summary ? (
        <p className="mt-4 text-sm text-ink-faint">Loading…</p>
      ) : summary.totalCalls === 0 ? (
        <p data-testid="ai-usage-empty" className="mt-4 text-sm text-ink-dim">
          No hosted AI calls on this account yet. Deterministic prose and local Ollama do not write
          rows.
        </p>
      ) : (
        <>
          <dl
            data-testid="ai-usage-summary"
            className="mt-4 grid grid-cols-2 gap-3 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint sm:grid-cols-4"
          >
            <div>
              <dt>Calls (shown)</dt>
              <dd className="mt-1 text-lg text-chronos">{summary.totalCalls}</dd>
            </div>
            <div>
              <dt>Input tokens</dt>
              <dd className="mt-1 text-lg text-ink">{summary.totalInputTokens}</dd>
            </div>
            <div>
              <dt>Output tokens</dt>
              <dd className="mt-1 text-lg text-ink">{summary.totalOutputTokens}</dd>
            </div>
            <div>
              <dt>Last minute</dt>
              <dd className="mt-1 text-lg text-ink">{summary.callsLastMinute}</dd>
            </div>
          </dl>
          {summary.failedCalls > 0 && (
            <p className="mt-2 text-xs text-ink-faint">
              {summary.failedCalls} failed attempt{summary.failedCalls === 1 ? "" : "s"} (fail-open
              kept the deterministic recommendation).
            </p>
          )}
          <ul data-testid="ai-usage-rows" className="mt-4 max-h-48 space-y-2 overflow-y-auto">
            {summary.rows.slice(0, 12).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-2 text-xs text-ink-dim"
              >
                <span className="font-mono text-ink">{row.model}</span>
                <span>
                  {row.input_tokens}+{row.output_tokens} tok
                  {!row.ok ? " · failed" : ""}
                </span>
                <span className="w-full font-mono text-[10px] text-ink-faint">
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
