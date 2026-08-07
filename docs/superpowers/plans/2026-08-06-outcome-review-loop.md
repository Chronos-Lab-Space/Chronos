# Outcome Review Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user set a review date when they save a decision, and surface that decision on the workspace home when the date arrives, so outcome verdicts actually get logged and calibration bands reach sample size.

**Architecture:** One new pure domain module (`outcomeReview.ts`) derives a due queue from `WorkspaceHome` plus an injected `now`. The review date is one optional field inside the existing `result` JSONB payload on the simulation record — no migration, no RLS change, works identically in anonymous (`remote: null`) mode. Presentation renders a banner on the Decision Brief that deep-links to the already-shipped `OutcomeTracking` panel.

**Tech Stack:** TypeScript, React 19, React Router 7, Vitest + Testing Library, Playwright, Biome, Tailwind 4.

**Spec:** [docs/superpowers/specs/2026-08-06-outcome-loop-design.md](../specs/2026-08-06-outcome-loop-design.md)

## Global Constraints

- **No migration.** `review_at` lives in `SimulationResultPayload`, which is persisted to the `result jsonb not null default '{}'` column. Nothing in this plan touches `supabase/migrations/` or `supabase/tests/`.
- **Nothing reaches the engine.** No file under `src/application/simulation/` or `src/domain/chronos/` is modified. Ranking, scoring, and confidence stay engine-owned.
- **`now` is always injected.** `deriveOutcomeReview` takes `now: Date` as a parameter and must never call `Date.now()` or `new Date()` with no argument internally.
- **No unseeded randomness** anywhere in this work.
- **Anonymous mode must keep working.** Every code path added here runs with `remote: null`; guard nothing on `isSupabaseConfigured`.
- **Biome formatting counts as a CI error.** Run `npm run lint:fix` before each commit.
- **Comments explain why, not what.** Match the density of the surrounding file.
- **Copy honesty.** The banner says a review date the user chose has arrived. It must never imply Chronos knows the outcome, nor that a notification was sent — there is no email or push infrastructure.

---

### Task 1: Domain module — the due queue

**Files:**
- Create: `src/domain/workspace/outcomeReview.ts`
- Create: `src/domain/workspace/outcomeReview.test.ts`

**Interfaces:**
- Consumes: `WorkspaceHome`, `SimulationRecord`, `SimulationResultPayload` from `src/domain/workspace/types.ts` (existing).
- Produces: `REVIEW_HORIZONS`, `DEFAULT_REVIEW_HORIZON`, `reviewAtFor(horizonId, from)`, `deriveOutcomeReview(home, now)`, and the types `ReviewHorizonId`, `ReviewItem`, `OutcomeReview`. Tasks 2–4 all depend on these exact names.

- [ ] **Step 1: Write the failing test**

Create `src/domain/workspace/outcomeReview.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVIEW_HORIZON,
  REVIEW_HORIZONS,
  deriveOutcomeReview,
  reviewAtFor,
} from "./outcomeReview";
import type { OutcomeFollowed, OutcomeVerdict, SimulationRecord, WorkspaceHome } from "./types";

const WS = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-06T12:00:00.000Z");

let seq = 0;
function simId(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

/** A saved run, optionally with a review date and a logged outcome. */
function run(partial: {
  reviewAt?: string | null;
  followed?: OutcomeFollowed | null;
  verdict?: OutcomeVerdict | null;
  chosen?: boolean;
  status?: SimulationRecord["status"];
  title?: string;
}): SimulationRecord {
  const id = simId();
  const chosen = partial.chosen ?? true;
  return {
    id,
    workspace_id: WS,
    goal_id: null,
    title: partial.title ?? "How should we launch?",
    status: partial.status ?? "completed",
    confidence: 0.72,
    result: {
      ...(chosen
        ? { chosen_at: "2026-07-01T00:00:00.000Z", chosen_future_name: "Focused launch" }
        : {}),
      ...(partial.reviewAt === undefined ? {} : { review_at: partial.reviewAt }),
      outcome_followed: partial.followed ?? null,
      outcome_verdict: partial.verdict ?? null,
    },
    created_at: "2026-07-01T00:00:00.000Z",
    version: 1,
    lineage_id: id,
    parent_simulation_id: null,
    decision_id: id,
  };
}

function home(sims: readonly SimulationRecord[]): WorkspaceHome {
  return {
    workspace: {
      id: WS,
      owner_id: "u1",
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    recentSimulations: sims,
    decisions: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

describe("reviewAtFor", () => {
  it("adds the horizon's days to the given instant", () => {
    expect(reviewAtFor("2w", NOW)).toBe("2026-08-20T12:00:00.000Z");
    expect(reviewAtFor("1m", NOW)).toBe("2026-09-05T12:00:00.000Z");
    expect(reviewAtFor("3m", NOW)).toBe("2026-11-04T12:00:00.000Z");
  });

  it("returns null for the explicit no-review horizon", () => {
    expect(reviewAtFor("never", NOW)).toBeNull();
  });

  it("offers a default horizon that exists in the table", () => {
    expect(REVIEW_HORIZONS.some((h) => h.id === DEFAULT_REVIEW_HORIZON)).toBe(true);
  });
});

describe("deriveOutcomeReview — what Chronos may ask about", () => {
  it("queues a saved run whose review date has passed", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: "2026-08-03T12:00:00.000Z" })]), NOW);
    expect(result.due).toHaveLength(1);
    expect(result.due[0]!.daysOverdue).toBe(3);
    expect(result.due[0]!.href).toBe(`/workspace/simulations/${result.due[0]!.simulationId}#outcome`);
  });

  it("queues a run due at this exact instant", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: NOW.toISOString() })]), NOW);
    expect(result.due).toHaveLength(1);
    expect(result.due[0]!.daysOverdue).toBe(0);
  });

  it("counts a future review date as upcoming, not due", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: "2026-09-01T12:00:00.000Z" })]), NOW);
    expect(result.due).toHaveLength(0);
    expect(result.upcomingCount).toBe(1);
  });

  it("drops a run once a verdict is logged — the queue exists to collect it", () => {
    const result = deriveOutcomeReview(
      home([run({ reviewAt: "2026-08-01T12:00:00.000Z", followed: "yes", verdict: "as_expected" })]),
      NOW
    );
    expect(result.due).toHaveLength(0);
  });

  it("drops a run the user did not follow — calibration can never measure it", () => {
    const result = deriveOutcomeReview(
      home([run({ reviewAt: "2026-08-01T12:00:00.000Z", followed: "no" })]),
      NOW
    );
    expect(result.due).toHaveLength(0);
  });

  it("treats a legacy save with no review date as never, not as overdue", () => {
    const result = deriveOutcomeReview(home([run({})]), NOW);
    expect(result.due).toHaveLength(0);
    expect(result.awaitingCount).toBe(1);
  });

  it("treats an explicit null the same as never", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: null })]), NOW);
    expect(result.due).toHaveLength(0);
    expect(result.awaitingCount).toBe(1);
  });

  it("ignores an unparseable review date rather than pinning a permanent row", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: "not-a-date" })]), NOW);
    expect(result.due).toHaveLength(0);
    expect(result.awaitingCount).toBe(1);
  });

  it("ignores a run with no saved path — there is no decision to review", () => {
    const result = deriveOutcomeReview(
      home([run({ reviewAt: "2026-08-01T12:00:00.000Z", chosen: false })]),
      NOW
    );
    expect(result.due).toHaveLength(0);
    expect(result.awaitingCount).toBe(0);
  });

  it("ignores a run that never collapsed", () => {
    const result = deriveOutcomeReview(
      home([run({ reviewAt: "2026-08-01T12:00:00.000Z", status: "running" })]),
      NOW
    );
    expect(result.due).toHaveLength(0);
  });

  it("orders the queue oldest-due first", () => {
    const result = deriveOutcomeReview(
      home([
        run({ reviewAt: "2026-08-05T12:00:00.000Z", title: "Recent" }),
        run({ reviewAt: "2026-07-06T12:00:00.000Z", title: "Ancient" }),
      ]),
      NOW
    );
    expect(result.due.map((d) => d.decisionTitle)).toEqual(["Ancient", "Recent"]);
    expect(result.due[0]!.daysOverdue).toBe(31);
  });

  it("carries the chosen path name for context", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: "2026-08-01T12:00:00.000Z" })]), NOW);
    expect(result.due[0]!.chosenPathName).toBe("Focused launch");
  });

  it("prefers the goal title over the run title when a goal is set", () => {
    const base = home([run({ reviewAt: "2026-08-01T12:00:00.000Z" })]);
    const withGoal: WorkspaceHome = {
      ...base,
      goal: {
        id: "g1",
        workspace_id: WS,
        title: "Should we raise or extend runway?",
        description: "",
        status: "active",
        priority: 1,
        created_at: "2026-07-01T00:00:00.000Z",
      },
    };
    const result = deriveOutcomeReview(withGoal, NOW);
    expect(result.due[0]!.decisionTitle).toBe("Should we raise or extend runway?");
  });

  it("returns an empty queue for a missing home", () => {
    const result = deriveOutcomeReview(null, NOW);
    expect(result.due).toEqual([]);
    expect(result.upcomingCount).toBe(0);
    expect(result.awaitingCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/workspace/outcomeReview.test.ts`
Expected: FAIL — `Failed to resolve import "./outcomeReview"`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/workspace/outcomeReview.ts`:

```ts
import type { GoalRecord, SimulationRecord, WorkspaceHome } from "./types";

/**
 * Outcome review — chasing the answers calibration needs.
 *
 * `calibration.ts` measures what confidence has been worth, but it needs five
 * followed, verdicted runs in a band before it will report a rate. Nothing ever
 * asked the user to come back and log one, so the bands stayed under sample and
 * the confidence number stayed decoration.
 *
 * This module is the other half: the user names a review horizon when they save
 * a decision, and the workspace home surfaces it when that date arrives.
 *
 * It reports; it never decides. Nothing here reaches ranking, scoring, or
 * confidence. See docs/superpowers/specs/2026-08-06-outcome-loop-design.md.
 */

export const REVIEW_HORIZONS = [
  { id: "2w", label: "2 weeks", days: 14 },
  { id: "1m", label: "1 month", days: 30 },
  { id: "3m", label: "3 months", days: 90 },
  { id: "never", label: "No review", days: null },
] as const;

export type ReviewHorizonId = (typeof REVIEW_HORIZONS)[number]["id"];

/**
 * Preselected at Save Decision. A default is the difference between a queue
 * that fills and one that stays empty — but it is a suggestion, not a claim
 * about the right horizon for this decision, so the user can always change it.
 */
export const DEFAULT_REVIEW_HORIZON: ReviewHorizonId = "2w";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The review instant for a horizon, or null when the user opted out. */
export function reviewAtFor(horizonId: ReviewHorizonId, from: Date): string | null {
  const horizon = REVIEW_HORIZONS.find((h) => h.id === horizonId);
  if (!horizon || horizon.days === null) return null;
  return new Date(from.getTime() + horizon.days * DAY_MS).toISOString();
}

export type ReviewItem = {
  simulationId: string;
  /** What the user recognises the decision by, not the run title. */
  decisionTitle: string;
  chosenPathName: string;
  reviewAt: string;
  /** 0 = due today. Never negative: not-yet-due runs are not ReviewItems. */
  daysOverdue: number;
  href: string;
};

export type OutcomeReview = {
  /** Due now, oldest first. */
  due: readonly ReviewItem[];
  /** Has a review date still in the future. */
  upcomingCount: number;
  /**
   * Saved and unverdicted with no usable review date — "never", legacy saves,
   * and unparseable dates. Derived so calibration's `unverifiedCount` has
   * something to reconcile against; not rendered yet.
   */
  awaitingCount: number;
};

const EMPTY: OutcomeReview = { due: [], upcomingCount: 0, awaitingCount: 0 };

function parseIso(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Runs whose outcome could still be logged and measured. */
function isOpenForReview(sim: SimulationRecord): boolean {
  if (sim.status !== "completed") return false;
  if (!sim.result.chosen_at) return false;
  // A logged verdict is the answer this queue exists to collect.
  if (sim.result.outcome_verdict) return false;
  // Calibration counts a not-followed run under excludedNotFollowed and can
  // never measure it, so asking again would be a nag no measurement consumes.
  if (sim.result.outcome_followed === "no") return false;
  return true;
}

function titleFor(sim: SimulationRecord, goal: GoalRecord | null): string {
  return goal?.title?.trim() || sim.title;
}

export function deriveOutcomeReview(
  home: WorkspaceHome | null | undefined,
  now: Date
): OutcomeReview {
  if (!home) return EMPTY;

  const due: ReviewItem[] = [];
  let upcomingCount = 0;
  let awaitingCount = 0;

  for (const sim of home.recentSimulations) {
    if (!isOpenForReview(sim)) continue;

    const reviewAt = parseIso(sim.result.review_at);
    if (!reviewAt) {
      // No date, an explicit opt-out, or a corrupt one. A malformed payload
      // must not pin an undismissable row to the home page.
      awaitingCount += 1;
      continue;
    }

    if (reviewAt.getTime() > now.getTime()) {
      upcomingCount += 1;
      continue;
    }

    due.push({
      simulationId: sim.id,
      decisionTitle: titleFor(sim, home.goal),
      chosenPathName: sim.result.chosen_future_name ?? "",
      reviewAt: reviewAt.toISOString(),
      daysOverdue: Math.floor((now.getTime() - reviewAt.getTime()) / DAY_MS),
      href: `/workspace/simulations/${sim.id}#outcome`,
    });
  }

  due.sort((a, b) => a.reviewAt.localeCompare(b.reviewAt));

  return { due, upcomingCount, awaitingCount };
}
```

- [ ] **Step 4: Add `review_at` to the payload type**

In `src/domain/workspace/types.ts`, inside `SimulationResultPayload`, immediately after the `outcome_verdict` line:

```ts
  /**
   * When the user asked to be reminded to log this outcome. null or absent
   * means no review. Lives in the payload, not a column — no migration, and
   * anonymous (remote: null) workspaces persist it identically.
   */
  review_at?: string | null;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/domain/workspace/outcomeReview.test.ts`
Expected: PASS — 17 tests.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint:fix
git add src/domain/workspace/outcomeReview.ts src/domain/workspace/outcomeReview.test.ts src/domain/workspace/types.ts
git commit -m "feat: derive the decisions whose review date has arrived"
```

---

### Task 2: Persist the review date when a path is saved

**Files:**
- Modify: `src/application/workspace/WorkspaceService.ts:833-862` (`chooseBestPath`)
- Modify: `src/presentation/features/workspace/WorkspaceContext.tsx:98` (context type) and `:437-439` (implementation)
- Test: `src/application/workspace/WorkspaceService.reviewDate.test.ts` (create)

**Interfaces:**
- Consumes: `reviewAtFor`, `DEFAULT_REVIEW_HORIZON`, `ReviewHorizonId` from Task 1.
- Produces: `chooseBestPath(ownerId, simulationId, futureId, horizonId?)` on the service and `chooseBestPath(simulationId, futureId, horizonId?)` on the context. The trailing parameter is optional and defaults to `DEFAULT_REVIEW_HORIZON`, so both existing call sites in `TimelinePage.tsx` and `SimulationPages.tsx` keep compiling unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/application/workspace/WorkspaceService.reviewDate.test.ts`. The setup mirrors `ProductLoop.test.ts` — a real `WorkspaceService` over `LocalWorkspaceStore` with `remote: null`, which is also the anonymous-mode path:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import { WorkspaceService } from "./WorkspaceService";

const DAY_MS = 86_400_000;

describe("chooseBestPath — the review date", () => {
  const ownerId = "review-date-user";
  let service: WorkspaceService;

  beforeEach(() => {
    localStorage.clear();
    service = new WorkspaceService({ local: new LocalWorkspaceStore(), remote: null });
  });

  /** Runs the loop up to a collapsed simulation with futures to choose from. */
  async function collapsedRun() {
    await service.createWorkspace(ownerId, "Review Lab", "Outcome loop");
    await service.setGoal(ownerId, "Launch CLAB", "Ship a public launch");
    const home = await service.runSimulation(ownerId, "Should we raise before launch?", []);
    const sim = home.recentSimulations[0]!;
    const future = (home.futuresBySimulation[sim.id] ?? [])[0]!;
    expect(sim.status).toBe("completed");
    expect(future).toBeDefined();
    return { sim, future };
  }

  /** Days between the two instants the save wrote. */
  function gapDays(result: { chosen_at?: string; review_at?: string | null }): number {
    return (
      (new Date(result.review_at!).getTime() - new Date(result.chosen_at!).getTime()) / DAY_MS
    );
  }

  it("writes a review date derived from the chosen horizon", async () => {
    const { sim, future } = await collapsedRun();
    const home = await service.chooseBestPath(ownerId, sim.id, future.id, "1m");
    const saved = home.recentSimulations.find((s) => s.id === sim.id)!;

    expect(saved.result.chosen_at).toBeTruthy();
    expect(gapDays(saved.result)).toBeCloseTo(30, 5);
  });

  it("defaults to the two-week horizon when none is given", async () => {
    const { sim, future } = await collapsedRun();
    const home = await service.chooseBestPath(ownerId, sim.id, future.id);
    const saved = home.recentSimulations.find((s) => s.id === sim.id)!;

    expect(gapDays(saved.result)).toBeCloseTo(14, 5);
  });

  it("writes null when the user opts out of a review", async () => {
    const { sim, future } = await collapsedRun();
    const home = await service.chooseBestPath(ownerId, sim.id, future.id, "never");
    const saved = home.recentSimulations.find((s) => s.id === sim.id)!;

    // The path is still saved — opting out of the reminder is not opting out
    // of the decision.
    expect(saved.result.review_at).toBeNull();
    expect(saved.result.chosen_at).toBeTruthy();
  });
});
```

If `runSimulation`'s signature or its futures key differs from this, read `ProductLoop.test.ts` steps 4–6 and match what it actually does — that file is the working reference for the loop.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/application/workspace/WorkspaceService.reviewDate.test.ts`
Expected: FAIL — `chooseBestPath` rejects a 4th argument (TS error) or `review_at` is `undefined`.

- [ ] **Step 3: Implement in `WorkspaceService`**

Add the import at the top of `src/application/workspace/WorkspaceService.ts`:

```ts
import {
  DEFAULT_REVIEW_HORIZON,
  type ReviewHorizonId,
  reviewAtFor,
} from "../../domain/workspace/outcomeReview";
```

Change the signature at line 833:

```ts
  async chooseBestPath(
    ownerId: string,
    simulationId: string,
    futureId: string,
    reviewHorizon: ReviewHorizonId = DEFAULT_REVIEW_HORIZON
  ): Promise<WorkspaceHome> {
```

Then, in the `updatedSim` payload, add one line directly after `chosen_at: chosenAt,`:

```ts
        // Same write as the decision itself: there is no state where a path is
        // saved but its review date is not.
        review_at: reviewAtFor(reviewHorizon, new Date(chosenAt)),
```

- [ ] **Step 4: Thread it through `WorkspaceContext`**

In `src/presentation/features/workspace/WorkspaceContext.tsx`, change the type at line 98:

```ts
  chooseBestPath: (
    simulationId: string,
    futureId: string,
    reviewHorizon?: ReviewHorizonId
  ) => Promise<void>;
```

Add `import type { ReviewHorizonId } from "../../../domain/workspace/outcomeReview";` to the file's imports, then change the implementation at line 437:

```ts
      chooseBestPath: async (simulationId, futureId, reviewHorizon) => {
        const saved = await withOwner((id) =>
          serviceFor(id).chooseBestPath(id, simulationId, futureId, reviewHorizon)
        );
```

Leave the rest of that function — the `trackProductEvent` call and the best-effort plan generation — untouched.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/application/workspace/WorkspaceService.reviewDate.test.ts && npx vitest run src/application/workspace/ProductLoop.test.ts`
Expected: PASS both — the second confirms the optional parameter did not break the existing loop.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint:fix
git add src/application/workspace/WorkspaceService.ts src/application/workspace/WorkspaceService.reviewDate.test.ts src/presentation/features/workspace/WorkspaceContext.tsx
git commit -m "feat: save a review date alongside the chosen path"
```

---

### Task 3: Horizon chooser on Save Decision

**Files:**
- Create: `src/presentation/features/simulation/components/ReviewHorizonPicker.tsx`
- Create: `src/presentation/features/simulation/components/ReviewHorizonPicker.test.tsx`
- Modify: `src/presentation/features/simulation/components/DecisionReportCard.tsx` (props at :18-23, save block at :297-305, outcome section at :328)
- Modify: `src/presentation/features/simulation/SimulationPages.tsx:460-470`

**Interfaces:**
- Consumes: `REVIEW_HORIZONS`, `DEFAULT_REVIEW_HORIZON`, `ReviewHorizonId` from Task 1; `chooseBestPath(simulationId, futureId, horizonId?)` from Task 2.
- Produces: `ReviewHorizonPicker` with props `{ value: ReviewHorizonId; onChange: (id: ReviewHorizonId) => void; disabled?: boolean }`. `DecisionReportCard`'s `onSaveDecision` prop changes shape to `(reviewHorizon: ReviewHorizonId) => void`.

- [ ] **Step 1: Write the failing test**

Create `src/presentation/features/simulation/components/ReviewHorizonPicker.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_REVIEW_HORIZON, REVIEW_HORIZONS } from "../../../../domain/workspace/outcomeReview";
import { ReviewHorizonPicker } from "./ReviewHorizonPicker";

describe("ReviewHorizonPicker", () => {
  it("offers every horizon and marks the given one selected", () => {
    render(<ReviewHorizonPicker value={DEFAULT_REVIEW_HORIZON} onChange={() => {}} />);
    for (const horizon of REVIEW_HORIZONS) {
      expect(screen.getByRole("radio", { name: horizon.label })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "2 weeks" })).toBeChecked();
  });

  it("reports the horizon the user picks", async () => {
    const onChange = vi.fn();
    render(<ReviewHorizonPicker value={DEFAULT_REVIEW_HORIZON} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "3 months" }));
    expect(onChange).toHaveBeenCalledWith("3m");
  });

  it("does not promise a notification it cannot send", () => {
    render(<ReviewHorizonPicker value={DEFAULT_REVIEW_HORIZON} onChange={() => {}} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/email|notify|notification|remind you/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/presentation/features/simulation/components/ReviewHorizonPicker.test.tsx`
Expected: FAIL — `Failed to resolve import "./ReviewHorizonPicker"`.

- [ ] **Step 3: Write the component**

Create `src/presentation/features/simulation/components/ReviewHorizonPicker.tsx`:

```tsx
import {
  REVIEW_HORIZONS,
  type ReviewHorizonId,
} from "../../../../domain/workspace/outcomeReview";

type Props = {
  value: ReviewHorizonId;
  onChange: (id: ReviewHorizonId) => void;
  disabled?: boolean;
};

/**
 * When to come back and say how this landed.
 *
 * A default is preselected on purpose — an empty chooser means most saves carry
 * no date, the queue stays empty, and calibration keeps starving. Saving stays
 * one click either way.
 *
 * The copy says "check back", never "remind" or "notify": this surfaces the
 * decision in the workspace when the date arrives. Nothing is sent anywhere.
 */
export function ReviewHorizonPicker({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="mt-3" disabled={disabled}>
      <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        Check back on this
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {REVIEW_HORIZONS.map((horizon) => (
          <label
            key={horizon.id}
            className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${
              value === horizon.id
                ? "border-chronos bg-chronos/15 text-chronos"
                : "border-line text-ink-dim hover:border-chronos/40"
            }`}
          >
            <input
              type="radio"
              name="review-horizon"
              className="sr-only"
              value={horizon.id}
              checked={value === horizon.id}
              onChange={() => onChange(horizon.id)}
            />
            {horizon.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/presentation/features/simulation/components/ReviewHorizonPicker.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Wire it into `DecisionReportCard`**

In `src/presentation/features/simulation/components/DecisionReportCard.tsx`:

Change the prop type at line 20 from `onSaveDecision?: () => void;` to:

```ts
  onSaveDecision?: (reviewHorizon: ReviewHorizonId) => void;
```

Add these imports:

```ts
import { useState } from "react";
import {
  DEFAULT_REVIEW_HORIZON,
  type ReviewHorizonId,
} from "../../../../domain/workspace/outcomeReview";
import { ReviewHorizonPicker } from "./ReviewHorizonPicker";
```

Inside the component body, before the `return`:

```ts
  const [reviewHorizon, setReviewHorizon] = useState<ReviewHorizonId>(DEFAULT_REVIEW_HORIZON);
```

Replace the save block at lines 297-305 so the picker sits above the button and the handler passes the horizon. Keep the button's existing className exactly as it is — only the wrapper, the picker, and the `onClick` argument are new:

```tsx
            {!report.pathSaved && onSaveDecision ? (
              <div>
                <ReviewHorizonPicker
                  value={reviewHorizon}
                  onChange={setReviewHorizon}
                  disabled={saveBusy}
                />
                <button
                  type="button"
                  onClick={() => onSaveDecision(reviewHorizon)}
                  disabled={saveBusy}
                  {/* keep the existing className from line 302-303 verbatim */}
                >
                  {saveBusy ? "Saving…" : "Save decision"}
                </button>
              </div>
            ) : (
```

- [ ] **Step 6: Show the scheduled date once saved**

Spec §3: once the path is saved the chooser disappears and the panel states the date instead. In the `: (` branch that replaces the save block — the one that renders when `report.pathSaved` is true — add this line above whatever that branch already renders:

```tsx
                {reviewAtDisplay ? (
                  <div className="font-mono text-[11px] text-ink-faint">
                    Review scheduled for {reviewAtDisplay}
                  </div>
                ) : null}
```

and derive it next to the `reviewHorizon` state, reading the value the save wrote:

```ts
  // Read back rather than remembered: after a reload the component state is
  // gone but the payload still carries the date.
  const savedReviewAt = report.simulation?.result.review_at;
  const reviewAtDisplay =
    typeof savedReviewAt === "string" && !Number.isNaN(new Date(savedReviewAt).getTime())
      ? new Date(savedReviewAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : null;
```

If `DecisionReport` does not expose the simulation record, add `review_at` to the report type in `src/domain/workspace/decisionReport.ts` and populate it there instead of reaching for the raw record — the card should not learn a new dependency for one field. There is no edit affordance in this slice.

- [ ] **Step 7: Add the deep-link anchor**

Still in `DecisionReportCard.tsx`, line 328 — the outcome section is the deep-link target from Task 1's `href` and currently has no id:

```tsx
        {outcomeSlot ? (
          <section id="outcome" className="scroll-mt-20 px-5 py-5 sm:px-6">
            {outcomeSlot}
          </section>
        ) : null}
```

`scroll-mt-20` matches the `scroll-padding-top: 5rem` convention that keeps scrolled-to elements clear of the sticky headers — without it the panel lands under the header, which CLAUDE.md records as the root cause of a long-standing flaky E2E.

- [ ] **Step 8: Update the call site**

In `src/presentation/features/simulation/SimulationPages.tsx`, the `onSaveDecision` prop at lines 461-469 now receives the horizon:

```tsx
          onSaveDecision={
            !chosenId && futures[0]
              ? async (reviewHorizon) => {
                  const id = activeFutureId ?? futures[0]!.id;
                  await chooseBestPath(sim.id, id, reviewHorizon);
                  setSelectedFutureId(id);
                }
              : undefined
          }
```

Leave the `FutureTimelineCards` `onChoosePath` call at line 593 unchanged — it saves without a report card, so it takes the default horizon.

- [ ] **Step 9: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS — all files. If a `DecisionReportCard` test fails on the changed `onSaveDecision` arity, update that test to pass a horizon; do not widen the prop type back.

- [ ] **Step 10: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint:fix
git add src/presentation/features/simulation
git commit -m "feat: choose a review horizon when saving a decision"
```

---

### Task 4: Due banner on the Decision Brief

**Files:**
- Create: `src/presentation/features/workspace/components/OutcomeReviewBanner.tsx`
- Create: `src/presentation/features/workspace/components/OutcomeReviewBanner.test.tsx`
- Modify: `src/presentation/features/workspace/DecisionBriefPage.tsx:56-62`

**Interfaces:**
- Consumes: `deriveOutcomeReview`, `ReviewItem` from Task 1; `useWorkspace()` from `WorkspaceContext`.
- Produces: `OutcomeReviewBanner` with props `{ items: readonly ReviewItem[] }`. It is a pure renderer — the page derives, the banner displays.

- [ ] **Step 1: Write the failing test**

Create `src/presentation/features/workspace/components/OutcomeReviewBanner.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ReviewItem } from "../../../../domain/workspace/outcomeReview";
import { OutcomeReviewBanner } from "./OutcomeReviewBanner";

function item(partial: Partial<ReviewItem> = {}): ReviewItem {
  return {
    simulationId: "sim-1",
    decisionTitle: "Should we raise or extend runway?",
    chosenPathName: "Focused launch",
    reviewAt: "2026-08-01T12:00:00.000Z",
    daysOverdue: 5,
    href: "/workspace/simulations/sim-1#outcome",
    ...partial,
  };
}

function renderBanner(items: readonly ReviewItem[]) {
  return render(
    <MemoryRouter>
      <OutcomeReviewBanner items={items} />
    </MemoryRouter>
  );
}

describe("OutcomeReviewBanner", () => {
  it("renders nothing when nothing is due — an empty queue is not news", () => {
    const { container } = renderBanner([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("links each due decision to its outcome panel", () => {
    renderBanner([item()]);
    const link = screen.getByRole("link", { name: /log outcome/i });
    expect(link).toHaveAttribute("href", "/workspace/simulations/sim-1#outcome");
  });

  it("names the decision and the path that was taken", () => {
    renderBanner([item()]);
    expect(screen.getByText(/Should we raise or extend runway\?/)).toBeInTheDocument();
    expect(screen.getByText(/Focused launch/)).toBeInTheDocument();
  });

  it("says due today rather than 0 days ago", () => {
    renderBanner([item({ daysOverdue: 0 })]);
    expect(screen.getByText(/due today/i)).toBeInTheDocument();
  });

  it("uses the singular for one day", () => {
    renderBanner([item({ daysOverdue: 1 })]);
    expect(screen.getByText(/due 1 day ago/i)).toBeInTheDocument();
  });

  it("lists every due decision", () => {
    renderBanner([item(), item({ simulationId: "sim-2", href: "/workspace/simulations/sim-2#outcome", decisionTitle: "Hire or contract?" })]);
    expect(screen.getAllByRole("link", { name: /log outcome/i })).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/presentation/features/workspace/components/OutcomeReviewBanner.test.tsx`
Expected: FAIL — `Failed to resolve import "./OutcomeReviewBanner"`.

- [ ] **Step 3: Write the component**

Create `src/presentation/features/workspace/components/OutcomeReviewBanner.tsx`:

```tsx
import { Link } from "react-router-dom";
import type { ReviewItem } from "../../../../domain/workspace/outcomeReview";

type Props = {
  items: readonly ReviewItem[];
};

function dueLabel(daysOverdue: number): string {
  if (daysOverdue <= 0) return "due today";
  return daysOverdue === 1 ? "due 1 day ago" : `due ${daysOverdue} days ago`;
}

/**
 * Decisions whose review date has arrived.
 *
 * Renders nothing when the queue is empty — a "0 decisions due" row is a
 * standing nag that carries no information. Each row deep-links to the outcome
 * panel rather than logging inline, so the user sees the prediction they are
 * being asked to judge.
 */
export function OutcomeReviewBanner({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section
      data-testid="outcome-review-banner"
      className="mb-8 rounded-xl border border-chronos/30 bg-chronos/[0.06] px-5 py-4"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
        {items.length === 1 ? "1 decision to review" : `${items.length} decisions to review`}
      </div>
      <ul className="mt-3 space-y-2.5">
        {items.map((review) => (
          <li
            key={review.simulationId}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
          >
            <div className="min-w-0">
              <span className="text-[15px] text-ink">{review.decisionTitle}</span>
              {review.chosenPathName ? (
                <span className="ml-2 text-[13px] text-ink-dim">{review.chosenPathName}</span>
              ) : null}
              <span className="ml-2 font-mono text-[11px] text-ink-faint">
                {dueLabel(review.daysOverdue)}
              </span>
            </div>
            <Link
              to={review.href}
              className="shrink-0 text-sm text-chronos transition hover:text-chronos/80"
            >
              Log outcome →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/presentation/features/workspace/components/OutcomeReviewBanner.test.tsx`
Expected: PASS — 6 tests.

- [ ] **Step 5: Mount it on the Decision Brief**

In `src/presentation/features/workspace/DecisionBriefPage.tsx`, add the imports:

```ts
import { deriveOutcomeReview } from "../../../domain/workspace/outcomeReview";
import { OutcomeReviewBanner } from "./components/OutcomeReviewBanner";
```

Inside `DecisionBriefPage`, next to the existing `const brief = deriveDecisionBrief(home);`:

```ts
  // `now` is read here and injected, never inside the derivation — a
  // time-dependent function that reads the clock itself cannot be pinned by a
  // test.
  const review = deriveOutcomeReview(home, new Date());
```

Then render it as the first child inside the main returned container at line 57, above the `<Eyebrow>`:

```tsx
    <div className="mx-auto max-w-4xl pb-16" data-testid="decision-brief">
      <OutcomeReviewBanner items={review.due} />
      <Eyebrow>DECISION</Eyebrow>
```

Leave the early `!brief?.goalTitle` return untouched: with no goal there are no saved decisions to review, so the banner has nothing to show there.

- [ ] **Step 6: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS — all files, including the existing `DecisionBriefPage.test.tsx`.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint:fix
git add src/presentation/features/workspace
git commit -m "feat: surface decisions whose review date has arrived"
```

---

### Task 5: End-to-end proof and docs

**Files:**
- Modify: `e2e/decision-workspace.spec.ts`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/superpowers/specs/2026-08-06-outcome-loop-design.md` (status line)

**Interfaces:**
- Consumes: everything from Tasks 1–4. Produces nothing new.

- [ ] **Step 1: Write the failing E2E test**

Read `e2e/decision-workspace.spec.ts` first and follow its existing helpers for reaching a collapsed simulation — do not write a fresh navigation flow. Append:

```ts
test("saving a decision records a review date and the brief chases it", async ({ page }) => {
  // <reach a completed simulation detail page using the file's existing helper>

  await page.getByRole("radio", { name: "2 weeks" }).click();
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByRole("button", { name: "Save decision" })).toBeHidden();

  // The review date is two weeks out, so nothing is due yet.
  await page.goto("/workspace");
  await expect(page.getByTestId("outcome-review-banner")).toBeHidden();

  // Move the stored review date into the past — the same thing waiting two
  // weeks would do, without waiting two weeks.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      const raw = localStorage.getItem(key);
      if (!raw || !raw.includes("review_at")) continue;
      localStorage.setItem(
        key,
        raw.replace(/"review_at":"[^"]*"/g, '"review_at":"2020-01-01T00:00:00.000Z"')
      );
    }
  });

  await page.reload();
  const banner = page.getByTestId("outcome-review-banner");
  await expect(banner).toBeVisible();
  await banner.getByRole("link", { name: /log outcome/i }).click();
  await expect(page).toHaveURL(/\/workspace\/simulations\/.+#outcome/);
  await expect(page.getByText("Did you follow this recommendation?")).toBeVisible();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test e2e/decision-workspace.spec.ts -g "review date"`
Expected: FAIL initially only if something is wired wrong. If it passes first time, confirm the assertion is real by temporarily changing the injected date to a future one and checking the banner assertion fails — a test that cannot fail proves nothing.

- [ ] **Step 3: Fix whatever the E2E surfaces**

Most likely failure modes, in order: the localStorage bundle key shape differs from the naive scan (widen the match to the actual `chronos.` key the store uses, read `LocalWorkspaceStore` to confirm); or the `#outcome` anchor does not scroll because the section is inside a collapsed region. Fix the product code, not the assertion.

- [ ] **Step 4: Run the whole suite**

Run: `npx tsc --noEmit && npx biome ci . && npm run test:unit && npm run test:e2e`
Expected: all green. This is exactly what CI runs.

- [ ] **Step 5: Update the docs**

In `ARCHITECTURE.md`, in the "Implementation status (public beta — keep claims honest)" table around line 229, add a row:

```markdown
| **Outcome review** (`domain/workspace/outcomeReview.ts`) | Real. The user picks a review horizon when saving a decision; the Decision Brief lists decisions whose date has passed and no verdict is logged. In-app surfacing only — there is no email or push channel. Not-followed and verdicted runs are excluded, matching calibration's denominator. |
```

In `docs/superpowers/specs/2026-08-06-outcome-loop-design.md`, change the status line to:

```markdown
**Status:** Shipped.
```

- [ ] **Step 6: Commit**

```bash
npm run lint:fix
git add e2e ARCHITECTURE.md docs/superpowers/specs/2026-08-06-outcome-loop-design.md
git commit -m "test: prove the outcome loop end to end, and record it honestly"
```

---

## Verification

The work is done when all five success criteria from the spec hold:

1. Saving with the default horizon writes `review_at` into the payload, cloud and anonymous alike — Task 2 tests.
2. A past-due unverdicted decision appears in the banner; logging a verdict removes it — Task 1 tests plus the Task 5 E2E.
3. Existing saves with no `review_at` do not appear — Task 1 legacy test.
4. `deriveOutcomeReview` is deterministic for a fixed `(home, now)` — guaranteed by injected `now`, covered by every Task 1 test.
5. `npx tsc --noEmit && npx biome ci . && npm run test:unit && npm run test:e2e` all green — Task 5 Step 4.
