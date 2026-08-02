# Spec: does Chronos' confidence mean anything?

**Status:** Slices 1–3 shipped. Slice 3 caveats displayed confidence with the
measured band rate when that band has enough followed, verdicted runs — it
never rewrites the engine number.
**Scope:** Read back the outcome data the product has been collecting since
outcome tracking shipped, and say — honestly, with denominators — how well
predicted confidence has matched what actually happened.
**Out of scope:** Changing scoring, ranking, confidence, or the prior weights.
Nothing in this spec may reach the engine.

---

## The gap

Every time a user logs an outcome, [`OutcomeTracking.tsx`](src/presentation/features/simulation/components/OutcomeTracking.tsx)
asks them one question that no other part of the product asks:

> Better than predicted · As predicted · Worse than predicted

That answer is stored on `result.outcome_verdict`. Every collapsed run also
stores the confidence Chronos predicted, on `simulations.confidence`.

**The two have never been compared.** `priorWeight` uses the verdict to decide
how much a *prior* should steer the next run — a missed prediction drops its
prior to `0`. That is a feedback loop, and it works. But it operates one run at
a time, and it never asks the aggregate question:

> When Chronos says 80%, how often is it right?

Nobody knows. The data to answer it has been accumulating the whole time.

Meanwhile `Docs.tsx` tells users Chronos is "not a calibrated model of markets
or codebases." That is currently true, and honest. This spec is about earning
the right to say something more specific — or discovering we cannot, and
saying *that* instead.

---

## Principle

A confidence number that is never checked is decoration. Either the product
can show what its confidence has been worth, or it should stop presenting
confidence as if it were information.

---

## Why this is cheap now

Four things already exist:

1. **`simulations.confidence`** — 0–1, written at collapse.
2. **`result.outcome_verdict`** — `better` | `as_expected` | `worse`, and
   `outcome_followed` — `yes` | `partially` | `no`. Both user-reported, both
   already persisted and already synced.
3. **`priorWeight`** — the verdict → weight mapping is settled and tested. This
   spec reuses its semantics rather than inventing a second scale.
4. **Decisions** (shipped in #88) — versions of one question are now grouped,
   which is what makes *per-decision* movement expressible at all.

No schema work. No migration. This is a derivation and a surface.

---

## The measurement, and its honest denominator

**Only a followed recommendation can test a prediction.** If the user did not
take the path, the outcome says nothing about whether Chronos was right about
it — they measured a different world. So:

- `outcome_followed: "yes"` — counts.
- `outcome_followed: "partially"` — counts, flagged as partial.
- `outcome_followed: "no"` — **excluded from calibration entirely**, not
  counted as a miss.

This is the same reasoning that already puts `notFollowed` at `0.5` rather than
`0` in `PRIOR_WEIGHT`: not-adopted is absence of evidence, not evidence of
error. Counting it as a miss would make Chronos look wrong every time a user
changed their mind.

**A run with no verdict is not a data point.** Silence is not "as expected".

### Buckets, not a curve

With tens of decisions rather than thousands, a calibration *curve* is a lie
dressed as rigour. Confidence bands instead:

| Band | n | Landed as predicted or better |
|---|---|---|
| 85–100% | … | … |
| 70–84% | … | … |
| 50–69% | … | … |
| below 50% | … | … |

`n` is always shown. A band under a minimum sample size renders as "not enough
data yet" and no percentage — a rate over 2 runs is noise, and printing it
would be the same failure this repo keeps hitting: a number that looks like
information and is not.

### Per-decision movement

Because versions now hang under one decision, a second question becomes
answerable: when someone re-ran a decision and followed both versions, did the
later prediction land closer than the earlier one?

This is the interesting one — it is the difference between "Chronos is
miscalibrated" and "Chronos is learning". It will also be extremely sparse for
a long time, so it must render as an honest empty state far more often than it
renders a result.

---

## What this must never do

**Never adjust scores, ranking, or the confidence the engine computes.**
Ranking is engine-owned; that invariant is not negotiable and this spec does
not touch it. Calibration is a *report on* confidence, not an input to it.

**Never infer a verdict from free text.** `outcome_result` is prose the user
wrote. The existing rule — "free-text results are never interpreted" — holds.
The only hit/miss signal is the explicit verdict the user selected.

**Never present a rate without its denominator.**

---

## The self-reporting limitation, stated plainly

`outcome_verdict` is the user's own judgement of whether reality beat the
prediction. It is not an independent measurement. People are generous about
decisions they committed to and harsh about ones they regret, and the same
outcome gets a different verdict on a good day.

This means calibration here measures *agreement between Chronos and the user's
recollection*, not ground truth. That is still worth knowing — a system whose
users consistently say "worse than predicted" is miscalibrated in the way that
matters — but the surface must not imply more precision than that.

Any copy that presents this as objective accuracy is wrong and should be
rejected in review.

---

## Slices

1. ~~**Domain only.**~~ *Shipped.* `deriveCalibration(home)` → bands with counts,
   the excluded and unverified tallies, and a per-decision movement list. Pure,
   unit-tested, nothing rendered. Independently useful: it answers the question
   in a test before it costs any design time.
2. ~~**Surface it.**~~ *Shipped* as `CalibrationPanel`, on **`/workspace/memory`**
   rather than the learning dashboard: that dashboard renders a synthetic
   capability workload, not the workspace's real outcomes, so it has no
   calibration data to report. Memory is where the logged outcomes actually
   live. The panel sits above the rest of the page because it frames how much
   to trust everything below it.
3. ~~**Caveat displayed confidence.**~~ *Shipped.* `caveatForConfidence` +
   `formatConfidenceCaveat` look up the band for a claimed confidence and, only
   when that band has ≥ `CALIBRATION_MIN_SAMPLE` measured runs, surface the
   historical rate next to the number on the Decision Report and simulation
   detail (`ConfidenceCaveatNote`). The engine number is unchanged; empty band
   → nothing rendered (no invented rate).

---

## On "Replay"

The roadmap lists a Replay Engine next to this. Worth separating them now,
because replay is weaker than it sounds:

`SimulationEngine` is deterministic and hash-seeded per `simulationId`.
Replaying a past run against its own inputs reproduces it byte for byte, by
design — that is the determinism invariant working, and it tells you nothing.

Replay only becomes meaningful when something changed: *what would this
decision have recommended if it had known what you know now?* That is a real
feature, it needs the knowledge snapshot in `result.knowledge_used` to diff
against today's library, and it is a bigger piece of work than this one.

Calibration is the half that is nearly free and answers a question the product
is currently dodging. Do this first.

---

## Success criteria

1. `deriveCalibration` is pure, and every rate it reports is reproducible by
   hand from the fixture.
2. Not-followed runs are excluded, and their count is reported separately —
   asserted, because getting this wrong makes the product look wrong.
3. A band below the minimum sample size reports no rate at all.
4. Ranking, scores and confidence are byte-identical before and after: same
   objective and seed produce the same futures and the same collapse order.
5. A workspace with no logged outcomes renders an empty state, not zeroes.
6. `tsc`, `biome ci`, unit and E2E green.

---

## The honest failure mode

This may show that Chronos' confidence has no relationship to outcomes. That
would be worth knowing, and worth showing. A product that measures itself and
publishes the result is more trustworthy than one that displays a confident
number nobody has ever checked — which is what exists today.

If the answer is bad, the fix is to say so in the UI and reconsider what
confidence is for. It is not to hide the panel.
