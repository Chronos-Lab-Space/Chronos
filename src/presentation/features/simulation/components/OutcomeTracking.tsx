import { useState } from "react";
import type { OutcomeFollowed, OutcomeVerdict } from "../../../../domain/workspace/types";

type Props = {
  pathSaved: boolean;
  followed: OutcomeFollowed | null;
  followedAt: string | null;
  result: string | null;
  resultAt: string | null;
  verdict?: OutcomeVerdict | null;
  recommendedName: string;
  onFollowed: (followed: OutcomeFollowed) => Promise<void>;
  onResult: (note: string, verdict: OutcomeVerdict | null) => Promise<void>;
};

const OPTIONS: { value: OutcomeFollowed; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partially", label: "Partially" },
  { value: "no", label: "No" },
];

/** Optional hit/miss signal — the only thing that re-weights future priors. */
const VERDICTS: { value: OutcomeVerdict; label: string }[] = [
  { value: "better", label: "Better than predicted" },
  { value: "as_expected", label: "As predicted" },
  { value: "worse", label: "Worse than predicted" },
];

/**
 * After a recommendation is saved — ask follow-through, then how it turned out.
 * Persistent outcome memory for Chronos.
 */
export function OutcomeTracking({
  pathSaved,
  followed,
  followedAt,
  result,
  resultAt,
  verdict,
  recommendedName,
  onFollowed,
  onResult,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(result ?? "");
  const [pickedVerdict, setPickedVerdict] = useState<OutcomeVerdict | null>(verdict ?? null);
  const [error, setError] = useState<string | null>(null);

  if (!pathSaved) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Outcome tracking
        </div>
        <p className="mt-2 text-sm text-ink-dim">
          Choose and save a path first — then Chronos will ask whether you followed it.
        </p>
      </div>
    );
  }

  const handleFollowed = async (value: OutcomeFollowed) => {
    setBusy(true);
    setError(null);
    try {
      await onFollowed(value);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onResult(note, pickedVerdict);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
          Outcome tracking
        </div>
        <p className="mt-1 text-sm text-ink-dim">
          Path: <span className="text-ink">{recommendedName}</span>
        </p>
      </div>

      <div>
        <div className="font-mono text-[10px] uppercase text-ink-faint">
          Did you follow this recommendation?
        </div>
        {followed ? (
          <p className="mt-3 text-[15px] text-ink">
            <span className="rounded-full bg-chronos/15 px-3 py-1 font-mono text-sm capitalize text-chronos">
              {followed}
            </span>
            {followedAt ? (
              <span className="ml-3 font-mono text-[11px] text-ink-faint">
                {new Date(followedAt).toLocaleString()}
              </span>
            ) : null}
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={busy}
                onClick={() => void handleFollowed(opt.value)}
                className="rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-chronos/50 hover:bg-chronos/10 hover:text-chronos disabled:opacity-50"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {followed && (
        <div>
          <div className="font-mono text-[10px] uppercase text-ink-faint">How did it turn out?</div>
          {result ? (
            <div className="mt-3 rounded-xl border border-line px-4 py-3">
              <p className="text-[15px] text-ink whitespace-pre-wrap">{result}</p>
              {resultAt ? (
                <p className="mt-2 font-mono text-[11px] text-ink-faint">
                  {new Date(resultAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : (
            <form onSubmit={handleResult} className="mt-3 space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                required
                placeholder="What happened? Metrics, surprises, would you choose this path again…"
                className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
              />
              <fieldset>
                <legend className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  Against the prediction — optional
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {VERDICTS.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      aria-pressed={pickedVerdict === v.value}
                      onClick={() =>
                        setPickedVerdict((current) => (current === v.value ? null : v.value))
                      }
                      className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                        pickedVerdict === v.value
                          ? "border-chronos bg-chronos/15 text-chronos"
                          : "border-line text-ink-dim hover:border-chronos/40 hover:text-ink"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-ink-faint">
                  A miss stops this run's priors from steering the next simulation.
                </p>
              </fieldset>
              <button
                type="submit"
                disabled={busy || !note.trim()}
                className="rounded-full bg-ink px-4 py-2 text-sm text-bg hover:bg-chronos disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save outcome"}
              </button>
            </form>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
