# Spec: Workspace design import

**Status:** Approved, in implementation
**Source:** Claude Design project `chronos workspace` (`8371b0e6-…`), file `Chronos Workspace.dc.html`
**Scope:** Restyle the private workspace to match the imported design exactly, bound to real
engine data. No engine changes, no schema migration, no new routes.

## Objective

Bring `/workspace` to visual parity with the imported design while every value on screen
comes from `WorkspaceService` / `SimulationEngine` output. The design is a prototype with
hardcoded fictional content; this spec defines the mapping from that content to real
derivations, and records the three places where the design and the codebase disagree.

## Locked product decisions

| # | Decision | Verdict |
|---|----------|---------|
| 1 | Fidelity | **Pixel-faithful, real data.** Layout, sizes, colors, spacing match the design exactly. Content binds to live workspace state. |
| 2 | `AGREEMENT · 87% · across models` | **Substituted.** Implies a multi-model ensemble that does not exist and would breach the Honest-claims invariant. Same tile slot, type scale and grid position; renders `RULED OUT` from `brief.stats`. |
| 3 | Mobile | **Unchanged.** New design applies at `lg` and above; the existing tab bar, More drawer and stacked layout stand below it. |
| 4 | Stepper interaction | **Non-interactive.** The prototype's `setStep(i)` fabricates lifecycle state. Stages stay derived; visuals identical, `aria-current="step"` retained. |
| 5 | Safety banners | **Retained.** Anonymous and sync-error banners are restyled, not removed — deleting them regresses `SPEC-anonymous-workspace.md`. |
| 6 | Context rail scope | **Every workspace screen.** The design carries the rail across all five; it previously appeared only on the decision, HQ and simulation-detail routes. |
| 7 | Simulation result layout | **Contract kept, design language applied.** The design replaces the result page with a two-column future-graph + selected-future card. Rejected: it drops sections `SPEC.md` requires (Evidence, Expected value, Next actions, the Save-decision hard gate), and its metric grid (`COST/MO`, `SIGNUPS D+30`, `RETENTION`) is launch-specific fiction with no engine equivalent. The nine-section order is also authoritative for markdown export, so changing the UI alone would desync the two. `DecisionReportCard` instead takes the design's type scale, eyebrows, dividers and prose measure with its structure untouched. |

## Assumptions (locked unless reopened)

1. **No new routes.** The design's `Reports` nav item has nothing behind it and is omitted
   rather than shipped as a dead link. `Decisions` and `HQ` are kept — the design's nav drops
   them, but both have live routes and tests.
2. **Design tokens already exist.** `#111111` / `#F2EDEA` / `#60899B` / `#C4C2AA` / `#989898`
   are already `--color-bg` / `ink` / `chronos` / `ink-dim` / `ink-faint`. All four fonts are
   already loaded and the production CSP already allows Google Fonts. Only the divider tones
   are new.
3. **Anything the workspace has not produced yet renders nothing** — not a placeholder and not
   a fabricated number. This is the existing `deriveDecisionBrief` contract.

## Layout

The one structural change. Today the stage band sits inside `<main>` and stops short of the
right rail. The design runs it across content *and* rail, so the rail becomes a child of
`<main>` rather than its sibling.

```text
header (62px)
└─ flex
   ├─ nav 236px
   └─ main
      ├─ stage band            full width of main
      └─ flex
         ├─ content (scrolls)
         └─ aside 316px
```

### Measurements

| Region | Now | Design |
|---|---|---|
| Header height | 56px | 62px |
| Left nav | 220px | 236px |
| Right rail | 280px | 316px |
| Body size | 14px | 13.5px |
| Nav active | `bg-chronos/15` + `text-chronos` | `bg-chronos/15` + `text-ink` |

### New tokens

`--color-line` today is `rgba(242,237,234,0.10)`. The design uses three divider tones:

| Token | Value | Use |
|---|---|---|
| `--color-line` | `rgba(242,237,234,0.12)` | structural borders (header, nav, rail) |
| `--color-line-soft` | `rgba(242,237,234,0.08)` | in-page section dividers |
| `--color-line-strong` | `rgba(242,237,234,0.2)` | cards, inputs, chips (already exists) |

## Binding table

Every fictional value in the prototype and its real source. Where a source is absent, the
element is hidden — never padded.

| Design content | Real source | When absent |
|---|---|---|
| "Launch Chronos Public Beta" | `brief.goalTitle` | entry surface (existing) |
| Objective paragraph | `brief.goalDescription` | hidden |
| `SYNCED 10:42` | last successful sync time | hidden |
| Nav counts `9` / `31` / `14` | existing `navCounts` in the shell | hidden |
| `State · Evaluating` | `brief.stageId` | — |
| `Confidence 72%` | `brief.confidencePct` | row hidden |
| `Window · 17 days left` | `reviewAtFor()` (outcome loop) | row hidden until collapsed |
| `FUTURE 07 · 72% · HIGH CONFIDENCE` | recommended `brief.futures` entry | section hidden |
| Recommendation headline + body | `brief.recommendation` | section hidden |
| `EVIDENCE 9` | `brief.stats` EVIDENCE | — |
| `SIMULATIONS 31` | `brief.stats` SIMULATIONS | — |
| `AGREEMENT 87%` | **substituted** → `brief.stats` RULED OUT | — |
| `CONSTRAINTS 4 / 4` | `brief.stats` CONSTRAINTS | — |
| `DISSENT 3` | `brief.stats` RISKS | — |
| `STALENESS 2d` | `brief.stats` STALENESS | — |
| Evidence rows, `HIGH` / `MEDIUM` | `brief.evidence`, weight from `citedByRuns` | empty state |
| Ranked futures, `72% / 64% / 51% / 38%` | `brief.futures[].scorePct` | section hidden |
| `RECOMMENDED` / `BREACHES COST` / `MISSES TARGET` | `brief.futures[].standing` | — |
| Future graph nodes, `SEED 4471` | futures + `simulationId` seed | graph hidden |
| Selected-future panel | selected `BriefFuture` + record | — |
| Timeline entries | existing timeline derivation | empty state |
| Memory `PREDICTED 68% · ACTUAL 71%` | outcome review records | empty state |
| Calibration `81%` / `+6 pts` / `6 priors` | `derivePriors` + calibration | hidden |
| Rail objective / constraints / targets | `deriveTargets`, run constraints | hidden |
| `MEMORY IN PLAY` | `derivePriors(home)` | hidden |
| `RECENT ACTIVITY` | `buildActivityFeed(home, 4)` | hidden |
| Notes from Priya / Julien | `home.notes` | "Write a note…" |

Precedent for the substitutions in rows 11 and "HIGH/MEDIUM": `deriveDecisionBrief` already
records two of the same kind, for the same reason — see its comments on `citedByRuns` and
`RULED OUT`.

## Components

Each maps to a component that already exists; all changes are in-place restyles apart from
the shell restructure.

| Design region | File |
|---|---|
| Header, ⌘K pill, avatar | `WorkspaceShell.tsx` |
| Left nav, ACTIVE DECISION card | `WorkspaceShell.tsx` |
| Six-step stepper | `WorkspaceStageBand.tsx` |
| Right rail, DETAILS/NOTES | `WorkspaceContextRail.tsx` |
| ⌘K palette | `WorkspaceCommandPalette.tsx` |
| Decision screen | `DecisionBriefPage.tsx` |
| Simulation screen + future graph | `SimulationDetailPage.tsx` |
| Timeline / Memory / Knowledge | `TimelinePage.tsx`, `MemoryPage.tsx`, `KnowledgePage.tsx` |

## Testing

Per repo convention, tests assert decision outcomes rather than implementation shape, so most
of this restyle is not independently testable — and should not grow tautological assertions to
look tested. What does get covered:

- **Regression, fails first:** the substituted stat tile never renders the string "across
  models", and the stage band exposes no click handler.
- **Retained behavior:** existing `WorkspaceShell.test.tsx` and `WorkspaceContextRail.test.tsx`
  assertions keep passing unchanged — including the anonymous banner and `sign-in-to-save`.
- **Empty states:** each screen renders without throwing when `home` has no goal, no
  simulations, and no knowledge.
- **E2E:** the existing auth + decision-loop journey passes against the new layout.

## Out of scope

Mobile redesign; new routes; engine, scorer or schema changes; the public marketing surfaces;
the `Reports` nav item; the simulation result layout (decision 7).
