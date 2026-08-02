# Spec: decisions as first-class objects

**Status:** Shipped — all three slices. Criterion 1 verified on the live project
2026-08-02 (49 sims, 0 unlinked, 21 decisions) after a hosted data repair —
see "What shipped" at the end.
**Scope:** A `Decision` entity that owns its simulation versions, a backfill for
existing data, and the read surface that makes the product's existing claim true.
**Out of scope:** Changing scoring, futures, ranking, or confidence. Replay and
calibration — both want this entity, neither is this spec.

[`Docs.tsx`](src/presentation/components/Docs.tsx) tells users Chronos has
"first-class decision objects (sims hang underneath)". The table exists, its RLS
policies and indexes are committed, and `simulations.decision_id` is a real
foreign key. Nothing in `src/` reads or writes any of it. The hosted project
holds 49 simulations and **zero** decisions.

So this is not a new feature. It is finishing one that was half-built, described
as done, and then left — the same failure mode as the `SimulationEngine` comment
that claimed the product path never called a model.

---

## Principle

A decision is the question. A simulation is one attempt at answering it.
Re-running does not create a new decision; it creates a new version of the one
you already had.

---

## Why this is cheap

Four mechanisms already exist:

1. **The table**, with a committed migration
   (`20260721120000_public_beta_auth.sql`), an updated-at trigger, a
   `(workspace_id, created_at desc)` index, a `created_by` index from
   `20260726120500_security_hardening.sql`, and RLS consolidated in
   `20260726120000_consolidate_workspace_rls.sql`. No schema work is needed.
2. **`simulations.decision_id`**, already a nullable FK.
3. **Versioning**: `version`, `lineage_id`, and `parent_simulation_id` on
   `simulations` already group v1 → v2 → v3 and link each re-run to its source.
4. **The data itself**: 49 simulations resolve to 21 distinct `lineage_id`s. The
   decision entity is already present in production data. It just has no name,
   no row, and no way to be listed.

---

## The model

**A Decision owns** the workspace it belongs to, who opened it, the question as
it was asked, the goal it serves, and its timestamps.

**A Simulation owns** everything about one attempt: the input snapshot, the
futures, the scores, the ranking, the chosen path, and what happened next.

Two calls worth stating outright, because both could reasonably go the other
way:

**Outcome stays on the simulation.** It is tempting to hang "did this work?" off
the decision, since that is how a person talks about it. But you executed a
specific version, and the prediction error a replay will eventually want is
per-version — v2's confidence against v2's result. The decision exposes the
outcome of the version you followed as a *derivation*, never a stored copy.

**`status` is derived, not written.** The column exists; slice 1 leaves it
alone. `deriveDecisionStatus(versions)` returns `open` (no version has a chosen
path), `decided` (a version has one), or `executed` (a chosen version has a
logged outcome). Storing it would create a second source of truth that drifts
from the versions it summarises — which is precisely how `decision_id` came to
be a column nobody maintained.

---

## Backfill: a lineage is a decision

All 49 existing simulations have `decision_id: null`, across 21 lineages. The
mapping is therefore already decided by the data, not by us:

- One decision per distinct `lineage_id`.
- `title` from the earliest version's objective, `created_at` from the earliest
  version, `created_by` from the workspace owner.
- Idempotent by convention, like every other migration here: insert only where
  no decision already covers that lineage, then set `decision_id` only where it
  is null.
- Simulations with a null `lineage_id`, if any appear, get a decision each.
  Nothing is dropped and nothing is merged on a guess.

Local-first storage needs the same rule applied on load, alongside
`sanitizeWorkspaceHomeIds` — anonymous visitors have lineages too, and their
data never passes through a migration.

---

## Local-first

`WorkspaceHome` gains `decisions: readonly DecisionRecord[]`. Anonymous
visitors get decisions exactly as signed-in ones do; the entity is not a cloud
feature, and `remote: null` keeps working unchanged.

---

## Slices

1. **Domain and backfill, nothing visible.** `DecisionRecord`,
   `deriveDecisionStatus`, grouping by lineage, the migration, and the local
   sanitize pass. Every simulation gains a `decision_id`; no UI changes.
2. **Write path.** `runSimulation` creates a decision on a new lineage and
   reuses the existing one on a re-branch. The graph's re-branch already knows
   the lineage, so this is a lookup, not a new concept.
3. **Read surface.** Decisions become listable and openable, with their versions
   underneath. Only at this point is the `Docs.tsx` claim true.

Ship in that order. Slice 1 is independently revertable and useful alone — it
makes the existing data queryable by decision even before anything renders it.

---

## Boundaries

**Always:** a decision belongs to exactly one workspace; the backfill is
idempotent and replayable; status is derived from versions.
**Ask first:** storing `status` as a written column; moving outcome from the
simulation to the decision; anything that changes what a re-branch means.
**Never:** a decision that influences scores, futures, ranking, or confidence —
it is an organising entity, not an input; a decision row without a workspace; a
second source of truth for which version was chosen.

---

## Success criteria

1. All 49 existing hosted simulations have a non-null `decision_id`, and exactly
   21 decisions exist — verified against the live project, not assumed.
2. Replaying every migration on a clean stack produces the same result, and
   `rls_invariants.sql` and `rls_access_matrix.sql` still pass.
3. A re-branch produces a second version under the *same* decision, not a
   second decision.
4. An anonymous visitor gets decisions locally, with nothing written to
   Supabase.
5. Ranking is byte-identical before and after: same objective and seed produce
   the same futures, scores, and collapse order.
6. `tsc`, `biome ci`, unit and E2E green.

---

## What shipped

All three slices, in one change.

**The key decision, made during implementation:** a decision is keyed on its
`lineage_id` rather than given a fresh uuid. That makes the mapping bijective,
so the SQL backfill and the client derive the same id without coordinating,
two offline devices converge on one decision instead of two, and the backfill
is idempotent by construction rather than by bookkeeping. A lineage that is
not a valid uuid — legacy local data — falls back to the simulation's own id,
a lineage of one. The rule lives in exactly two places, deliberately mirrored:
`decisionIdForSimulation` and `private.decision_id_for_simulation`.

`runSimulation` does *not* construct a `DecisionRecord`. It sets `decision_id`
on the simulation, and `attachDecisions` inside `normalize()` is the single
constructor. A second one would be free to drift from the first.

**Criteria 2–6 are verified.** Migrations replay on a clean stack;
`rls_invariants.sql`, `rls_access_matrix.sql` and the new
`decision_backfill.sql` all pass; a re-branch produces v2 of the same decision
(unit *and* E2E); anonymous visitors get decisions with `remote: null`;
ranking is untouched — nothing in this change reaches the engine.

**Criterion 1 — verified 2026-08-02 against the live project.** First probe was
a hard fail: **49 unlinked, 0 decisions**. Migration
`20260730202201_decisions_from_lineages` (SQL backfill + `save_workspace_home`
decisions payload) had not repaired production data — either never applied or
rows predated a working write path. A service-role repair matching
`decisionIdForSimulation` / `private.backfill_decisions_from_lineages` inserted
21 decisions and linked all 49 sims. Re-probe:

```
simulations: 49  unlinked: 0  distinct decision_id: 21  decisions rows: 21
```

Exact match to the original expectation. Re-check anytime:

```bash
SUPABASE_SECRET_KEY=… node scripts/verify-decision-objects-hosted.mjs
# if unlinked > 0 again:
SUPABASE_SECRET_KEY=… node scripts/backfill-decision-objects-hosted.mjs
```

**Follow-up (still open):** migration `20260730202201` does **not** appear
applied on hosted. Evidence 2026-08-02: PostgREST OpenAPI describes
`save_workspace_home` as *"Atomic upsert of a whole workspace snapshot"* —
the post-migration comment is *"…snapshot, decisions included."* Data is
repaired via service-role backfill; until that migration (or an equivalent
function replace) lands, dual-write can re-create orphans. Apply with the
usual hosted migration path (`supabase db push` / dashboard SQL for that file).
