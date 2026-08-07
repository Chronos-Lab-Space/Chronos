# Design: close the outcome loop

**Date:** 2026-08-06
**Status:** Shipped.
**Depends on:** [SPEC-calibration.md](../../../SPEC-calibration.md) slices 1–3 (shipped)

---

## The gap

`OutcomeTracking` asks two questions after a path is saved — did you follow it,
and did it land as predicted. The verdict is the only hit/miss signal the product
has, and [`calibration.ts`](../../../src/domain/workspace/calibration.ts) needs
`CALIBRATION_MIN_SAMPLE` (5) verdicted runs in a band before it reports a rate.

Nothing in the product ever asks the user to come back and answer. The panel sits
on the simulation detail page and waits. So the bands stay under sample, the
calibration UI prints "Not yet", and the confidence number the product sells stays
unmeasured.

This design gives a saved decision a review date and surfaces it when it comes due.

---

## Principle

> Chronos asks for the outcome at the moment the user set, on the screen they
> already open — and asks only for what calibration can actually consume.

## Constraint stated up front

There is no email or push infrastructure, and the app is a local-first SPA.
"Nudge" here means **in-app surfacing**, never an outbound notification. Nothing
in this design implies a message the user receives while away.

---

## Locked product decisions

| # | Decision | Verdict |
|---|----------|---------|
| 1 | Due trigger | **User sets a review date** at Save Decision. Not derived from elapsed time — a hiring call and a two-year strategy bet do not share a horizon. |
| 2 | Surface | **Decision Brief banner only** (`/workspace`). No new route: a review inbox the user must remember to visit is the problem, not the fix. |
| 3 | Save flow | **Optional, default preselected.** One click still saves; the default horizon means the queue actually fills. |
| 4 | Log flow | **Deep-link** to the existing `OutcomeTracking` panel. The user sees the prediction before judging it. Follows the SPEC-P2 precedent: deep-link, don't shortcut the commit. |
| 5 | `followed: "no"` | **Excluded from the queue.** Calibration counts those under `excludedNotFollowed` and can never measure them; queuing them would nag for an answer no measurement consumes. |
| 6 | Legacy saves | Absent `review_at` means **"never"**, not overdue. Shipping this must not retroactively fill the banner with old rows. |

---

## Why this is cheap

Outcome tracking is **not** a set of columns. It lives inside the `result` JSONB
payload on the simulation record
([`types.ts`](../../../src/domain/workspace/types.ts), `SimulationResultPayload`),
and `result jsonb not null default '{}'` is what every migration created.

So the review date is one more optional field in a payload the app already reads
and writes:

- **No migration.** No RLS change, no grant change, no `supabase/tests` update.
- **Anonymous mode works unchanged.** `remote: null` workspaces persist the same
  payload to `LocalWorkspaceStore`.
- **One write.** `WorkspaceService` already writes `chosen_at` into this payload
  when a path is saved; `review_at` rides along in the same call.

---

## Architecture

A new pure domain module derives the queue; presentation renders it. This mirrors
`calibration.ts` and `decisionHistory.ts` — one module measures the answers, one
module chases them.

```text
WorkspaceHome ──► deriveOutcomeReview(home, now) ──► OutcomeReview
                                                          │
                                              DecisionBriefPage banner
                                                          │
                                       deep-link ──► SimulationDetailPage
                                                     └─ OutcomeTracking (unchanged)
                                                          │
                                                     outcome_verdict
                                                          │
                                                  deriveCalibration
```

### Rejected alternatives

**Extend `pulse.ts`.** One fewer file, and the Brief already consumes pulse. But
`WorkspacePulse` is documented as "live state of the decision being worked" — a
queue of other, older decisions is a different question, and the type would grow
an array field most consumers ignore.

**Extend `decisionHistory.ts`.** It already walks every decision, but it is the
canonical past-events model shared by HQ and Timeline (SPEC-P2 decision #2).
Adding forward-looking due dates overloads a model two surfaces depend on.

---

## Components

### 1. Data — `SimulationResultPayload`

One new optional field:

```ts
/** When the user asked to be reminded to log this outcome. null = no review. */
review_at?: string | null;
```

Written by `WorkspaceService` in the same write as `chosen_at`. Absent on every
existing record, which decision #6 defines as "never".

### 2. Domain — `src/domain/workspace/outcomeReview.ts`

```ts
export const REVIEW_HORIZONS = [
  { id: "2w", label: "2 weeks", days: 14 },
  { id: "1m", label: "1 month", days: 30 },
  { id: "3m", label: "3 months", days: 90 },
  { id: "never", label: "No review", days: null },
] as const;

export const DEFAULT_REVIEW_HORIZON = "2w";

export type ReviewItem = {
  simulationId: string;
  /** Decision/goal title — what the user recognises, not the run title. */
  decisionTitle: string;
  chosenPathName: string;
  reviewAt: string;
  /** 0 = due today. Never negative: not-yet-due items are not ReviewItems. */
  daysOverdue: number;
  href: string;
};

export type OutcomeReview = {
  /** reviewAt <= now, oldest first. */
  due: readonly ReviewItem[];
  /** Has a date, not yet due. Derived now, rendered later. */
  upcomingCount: number;
  /** Saved, no verdict, no date — "never" plus legacy. Derived now, rendered later. */
  awaitingCount: number;
};

export function deriveOutcomeReview(
  home: WorkspaceHome | null | undefined,
  now: Date,
): OutcomeReview;
```

**Inclusion rule.** An item is due when all hold:

1. the run collapsed (`status` completed),
2. a path was saved (`chosen_at` present),
3. `review_at` is set and `<= now`,
4. `outcome_verdict` is still null,
5. `outcome_followed !== "no"`.

**`now` is a parameter, never `Date.now()` inside.** Same reason the engine is
hash-seeded: a time-dependent derivation that reads the clock internally cannot be
pinned by a test.

`upcomingCount` and `awaitingCount` are derived but **not rendered in this slice**.
They exist because calibration's `unverifiedCount` should eventually reconcile
against them, and defining them once beats retrofitting the type later.

### 3. Save flow — horizon chooser

Sits beside the existing Save Decision button, `2w` preselected. Save writes
`review_at = now + horizon.days`, or `null` for "never". Hidden once saved; the
saved-state panel then shows "Review scheduled for &lt;date&gt;" with no edit
affordance in this slice.

### 4. Banner — `DecisionBriefPage`

Rendered above the fold, **only when `due.length > 0`**. Each row: decision title ·
"due today" / "due N days ago" · `Log outcome →` linking to
`/workspace/simulations/:id#outcome`.

No zero-state. An empty queue renders nothing — a "0 decisions due" row is a nag
that carries no information.

---

## Error handling

- **Malformed `review_at`.** An unparseable date is treated as absent, never as
  due. A corrupt payload must not put a permanent undismissable row on the home
  page.
- **Save failure.** The horizon is part of the existing save write, so a failed
  save fails as it does today. There is no partial state where the path is saved
  but the review date is not.
- **Missing chosen path name.** Falls back to the decision title alone rather than
  rendering an empty cell.

---

## Testing

**Unit — `outcomeReview.test.ts`:**

- due/not-due at the exact boundary (`reviewAt === now`)
- verdict-logged exclusion
- `followed: "no"` exclusion
- legacy absent-field exclusion
- `"never"` (explicit null) exclusion
- oldest-first ordering
- `daysOverdue` arithmetic across a month boundary

**Component:** banner renders nothing on an empty queue; renders one row per due
item with a correct href.

**E2E:** save a decision with a horizon and assert the payload carries `review_at`;
with a time-travelled fixture, assert the banner appears and its link lands on the
outcome panel.

**Not touched:** no engine test changes. Nothing here reaches ranking, scoring, or
confidence, so the determinism and engine-owned-ranking invariants are preserved by
construction rather than by assertion.

---

## Boundaries

**Always:** `now` injected; the banner silent when empty; `review_at` inside the
existing payload write.
**Ask first:** rendering `upcomingCount` / `awaitingCount`; editing a review date
after saving; any second surface beyond the Brief banner.
**Never:** a migration for this slice; an outbound notification; anything in this
path reaching the engine, scoring, or confidence; queuing a run the user marked
not-followed.

---

## Success criteria

1. Saving a decision with the default horizon writes `review_at` into the
   simulation payload, in both cloud and anonymous (`remote: null`) modes.
2. A decision past its review date with no verdict appears in the Brief banner;
   logging a verdict removes it.
3. Existing saved decisions — no `review_at` — do not appear.
4. `deriveOutcomeReview` is deterministic for a fixed `(home, now)`.
5. `npx tsc --noEmit`, `npx biome ci .`, unit and E2E all green.
