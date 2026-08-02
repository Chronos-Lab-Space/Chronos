# Spec: P2 — Decision HQ (Decision Card + hierarchy)

**Status:** Shipped (Decision HQ on main — hero card, demoted goal, shared timeline).  
**Depends on:** P1 shipped ([SPEC.md](./SPEC.md)) — simulation result contract  
**Scope:** Workspace **dashboard / HQ** + **shared decision history model** (HQ preview + Timeline page). No new engines, no migrations.

## Guiding principle

> Every screen helps the user understand their **current decision** and take the **next step** with confidence.  
> The recommendation is the product — not files, not metric walls.  
> HQ is for **awareness**; **commitment** happens on the simulation Review & Save flow.

---

## Locked product decisions

| # | Decision | Verdict |
|---|----------|---------|
| 1 | Accept on HQ | **Deep-link only.** No one-click `chooseBestPath` on dashboard. CTA: **Review Recommendation →** (or status-specific review labels). Commit only after Goal · Evidence · Why · EV · Alternatives on sim detail. |
| 2 | Timeline | **One canonical history model** (`deriveDecisionHistory`). HQ = last 3–5 events + **View Timeline →**. Timeline page expands same data. |
| 3 | GoalCard | **Keep, demote.** Compact context under hero; never competes with recommendation. |

### Commit flow (canonical)

```text
HQ Dashboard
  → Recommendation Card
  → Review Simulation (deep-link)
  → Save Decision (on sim detail)
  → Decision Recorded
```

---

## Assumptions (locked unless reopened)

1. Primary surface: `DashboardPage` (`/workspace`); Timeline page reuses history model.  
2. No schema changes.  
3. Latest relevant simulation drives recommendation on HQ (prefer latest **completed**).  
4. Full `DecisionReportCard` **not** on HQ — only on sim detail / full report.  
5. Beta checklist below hero when incomplete.  
6. Incremental PRs after `/plan`.

---

## Objective

**Who:** Public beta user opening the workspace.  
**Problem:** HQ doesn’t answer “what should I do?” in 5 seconds; equal card weight.  
**Build:** Pulse + Recommendation hero, demoted goal/knowledge, shared decision history.

### Four questions (immediate)

| # | Question | Where |
|---|----------|--------|
| 1 | What am I working on? | Goal (demoted card) + decision title on hero |
| 2 | Latest recommendation? | Hero recommendation ⭐ + confidence |
| 3 | What's waiting? | Status on hero (Pending · Saved · …) |
| 4 | Next action? | Hero CTA → deep-link review (not Accept) |

---

## Tech stack

| Layer | Touch |
|-------|--------|
| Domain | `decisionCard.ts`, `decisionHistory.ts` (+ tests); slim `pulse.ts` |
| UI | `DashboardPage`, `DecisionCard` (or pulse+hero), demoted `GoalCard`, `KnowledgeSummary`, history preview, `Timeline` / `TimelinePage` consume same model |
| Tests | Unit status/CTA/history; e2e HQ card + deep-link |

---

## Commands

```bash
npm run dev
npx tsc --noEmit
npx vitest run src/domain/workspace/
npx playwright test e2e/decision-workspace.spec.ts
```

---

## Project structure

```text
src/domain/workspace/
  decisionCard.ts
  decisionCard.test.ts
  decisionHistory.ts      # single source for HQ + Timeline page
  decisionHistory.test.ts
  pulse.ts                # optional health chips only
src/presentation/features/dashboard/
  DashboardPage.tsx
  components/
    DecisionCard.tsx      # hero: rec + confidence + next action + CTA
    WorkspacePulse.tsx    # may wrap/merge with DecisionCard per layout
    GoalCard.tsx          # demoted, compact
    KnowledgeSummary.tsx
    TimelinePreview.tsx   # last 3–5 events from decisionHistory
    RecentSimulations.tsx # optional compact list if not already present
    BetaChecklist.tsx
src/presentation/features/timeline/
  TimelinePage.tsx        # full list from same deriveDecisionHistory
SPEC-P2.md
```

---

## HQ layout (authoritative)

```text
┌──────────────────────────────────────────┐
│ Workspace Pulse / Recommendation hero ⭐ │
│ Recommendation · Confidence · Status     │
│ Next action copy                         │
│ [Review Recommendation →]  (deep-link)   │
└──────────────────────────────────────────┘
┌──────────────┐ ┌──────────────┐
│ Current Goal │ │ Knowledge    │   ← demoted, equal secondary weight
│ (compact)    │ │ (compact)    │
└──────────────┘ └──────────────┘
┌──────────────────────────────────────────┐
│ Recent Timeline (3–5 events)             │
│ • …                                      │
│ [View Timeline →]                        │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ Recent Simulations                       │
└──────────────────────────────────────────┘
(Beta checklist: if open, place after hero or after secondary row — never above recommendation)
```

**Visual weight:** Hero dominates. Goal / Knowledge / Timeline / Sims support.

---

## Feature requirements

### F1 — Recommendation hero (Decision Card)

| Field | Rules |
|-------|--------|
| `decisionTitle` | Goal title (context line) |
| `recommendation` | Engine/user recommended path name; empty state if no completed sim |
| `confidence` | 0–1 or null |
| `reason` | One-line (`recommendedBecause[0]` or short fallback) |
| `status` | Status machine below |
| `primaryCtaLabel` | Deep-link only — **never** “Accept” / one-click save |
| `primaryCtaHref` | Sim detail (or `?new=1` if no sim) |
| `secondaryCta` | Optional: Compare → same sim `#compare-alternatives` or detail |

#### Status machine

| Status | When |
|--------|------|
| `needs_simulation` | No completed simulation |
| `pending_decision` | Completed, no `chosen_future_id` |
| `path_saved` | Path saved; outcome not finished |
| `outcome_due` | Path saved; outcome incomplete |
| `complete` | Path + outcome logged |
| `running` / `failed` | Latest sim in that state |

#### Primary CTA labels (deep-link)

| Status | Label | Target |
|--------|-------|--------|
| `needs_simulation` | Run simulation → | `/workspace/simulations?new=1` |
| `pending_decision` | **Review Recommendation →** | `/workspace/simulations/:id` (Save Decision lives there) |
| `path_saved` / `outcome_due` | Review outcome → / Log outcome → | same sim detail |
| `complete` | Open Decision Report → | same sim detail |
| `running` | Open simulation → | running sim |
| `failed` | Review failed run → | failed sim |

| ID | Requirement |
|----|-------------|
| F1.1 | Hero is first major block after page header. |
| F1.2 | Dominant visual: ⭐ recommendation, confidence, status, one primary deep-link CTA. |
| F1.3 | **Forbidden on HQ:** `chooseBestPath`, buttons labeled Accept / Save decision that commit. |
| F1.4 | `deriveDecisionCard(home)` pure + unit tests for all statuses + CTA hrefs. |
| F1.5 | No full `DecisionReportCard` on dashboard. |

### F2 — Hierarchy & demotion

| ID | Requirement |
|----|-------------|
| F2.1 | Order matches **HQ layout** above. |
| F2.2 | GoalCard compact: title, status (e.g. On track), last updated, Edit goal — secondary border/weight. |
| F2.3 | Knowledge compact beside goal. |
| F2.4 | Remove duplicate standalone “Next action” section (hero owns it). |
| F2.5 | No vanity totals wall (total files / total notes as hero metrics). |

### F3 — Pulse

Pulse and Recommendation may share one hero panel (per wireframe) or split tightly.  
If split: pulse = thin health chips only; recommendation block = product.

| ID | Requirement |
|----|-------------|
| F3.1 | Recommendation is not a peer metric next to Knowledge%. |
| F3.2 | Health chips optional under hero: last sim time, knowledge count, status — small type. |

### F4 — Single decision history model

```ts
// Conceptual
type DecisionHistoryEvent = {
  id: string;
  kind:
    | "workspace_created"
    | "goal_set"
    | "knowledge_added"
    | "simulation_completed"
    | "recommendation_ready"
    | "decision_accepted"
    | "outcome_logged";
  label: string;      // human: "Decision accepted"
  at: string;         // ISO
  href?: string;
};
```

| ID | Requirement |
|----|-------------|
| F4.1 | `deriveDecisionHistory(home)` is the **only** event source for HQ preview + Timeline page. |
| F4.2 | HQ shows **3–5 most recent** events (newest-first for “Recent Activity” is OK; document choice in code). |
| F4.3 | Timeline page renders **full** ordered list from same function (no second ad-hoc mapper). |
| F4.4 | Labels are decision narrative, not “edited” / “updated file”. |
| F4.5 | **View Timeline →** links to `/workspace/timeline`. |

### F5 — Recent simulations

Compact list of latest sims (title, status, confidence, link) — supporting weight only.

---

## Out of scope

- One-click accept on HQ  
- Dual timeline implementations  
- Removing GoalCard  
- Sim detail redesign beyond existing P1 Save Decision  
- Migrations, invites, multi-goal  

---

## Testing strategy

| Level | What |
|-------|------|
| Unit | Status → CTA label/href; never emits commit action; history shared order |
| E2E | Dashboard shows recommendation (or empty CTA); primary link goes to sim detail; no Accept commit on HQ |

---

## Boundaries

**Always:** Deep-link for commitment; one history model; demote goal; tsc + tests green.  
**Ask first:** Changing primary nav; persisting dismissed checklist.  
**Never:** `chooseBestPath` from dashboard; chat empty states; full report dump on HQ; fake confidence.

---

## Success criteria

1. **5-second test:** User names recommendation + next click is **Review Recommendation →** (or Run simulation).  
2. No Accept/Save commit control on HQ.  
3. GoalCard visible but visually secondary.  
4. HQ timeline preview and Timeline page share `deriveDecisionHistory`.  
5. Full Decision Report only on sim detail.  
6. Unit + e2e green; no backend changes.

---

## Implementation slices

| Slice | Deliverable |
|-------|-------------|
| S1 | `decisionCard` domain + tests (CTA deep-links only) |
| S2 | `decisionHistory` domain + tests |
| S3 | Hero UI + Dashboard hierarchy (demote Goal, remove full report) |
| S4 | Timeline preview + Timeline page consume history |
| S5 | Recent sims row + e2e |

---

## Open questions

*None blocking.*

---

## Approval

- [x] Deep-link Review only (no HQ accept)  
- [x] Single history model; HQ preview + full Timeline  
- [x] Keep GoalCard, demoted  
- [x] HQ layout wireframe  
- [x] Eng: no migration / no engine rewrite  

**Next:** `/plan` or `build` / `build auto` for P2
