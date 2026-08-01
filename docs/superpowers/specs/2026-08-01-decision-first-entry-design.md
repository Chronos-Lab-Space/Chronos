# Spec: decision-first entry

A visitor who clicks "Join public beta" should be one action away from a ranked
result. Today they answer four screens first.

---

## What already exists

Most of the public-beta story is built and should not be rebuilt:

| Behaviour | Where |
|---|---|
| Anonymous visitor gets a workspace, no signup wall | `SPEC-anonymous-workspace.md`, `OptionalAuthRoute` |
| Sign-in is optional and additive | `WorkspaceShell` — "Sign in to save" |
| Anonymous work is claimed on sign-in | `claimAnonymousWork`, `anonymous_work_claimed` |
| Local-only mode is structural, not conditional | `WorkspaceService` with `remote: null` |

This spec changes **one** thing: what a new visitor meets first.

---

## The problem

`ONBOARDING_STEPS` is `welcome → name → goal → context → dashboard`. The
decision — the product — is third. `isWorkspaceOnboarded` already carries the
scar in its own docstring: gating on context "put four forms between a new user
and their first simulation." Context was made skippable. The other three
screens stayed.

---

## Principle

The first screen asks for the decision. The first action produces a result.
Everything else is deferred until the visitor has seen something worth
configuring.

---

## What changes

### Entry surface

`WorkspaceOnboarding` becomes `WorkspaceStart`, rendered by the same
`!isWorkspaceOnboarded` branch in `WorkspaceShell`. No new route: a second entry
surface is a thing that drifts.

One screen, one field ("What are you deciding?"), one submit. The `welcome`,
`name`, and `context` steps and the step-indicator machinery are deleted.

"Sign in to save" stays in the header, so optional-login is visible from the
first screen rather than discovered after the visitor has invested work.

### Workspace naming

A fixed default name, renamable through existing settings.

An earlier draft derived the name from the decision text. That is wrong: a
workspace holds many decisions, so naming it after the first one is a label
that becomes misleading through ordinary use — three decisions in, the
workspace is still called "Launch CLAB on Kickstart". A constant plus rename
costs nothing and cannot go stale.

### Submit flow

1. Create workspace with the default name — the same
   `WorkspaceContext.createWorkspace` the `name` step calls today. No workspace
   exists before this point, so this is a create, not a rename.
2. Create the decision from the entered objective
3. Run the simulation
4. Land on the result

`WorkspaceService` also creates a workspace named `SAMPLE_WORKSPACE_NAME` in
the sample-decision path. That is a separate flow and is not touched.

Anonymous and signed-in visitors take the same path. Only the owner id differs,
and `remote: null` already makes the anonymous case structural.

### Onboarded semantics

```
isWorkspaceOnboarded = workspace exists AND goal is set
```

Context stops gating anything. `OnboardingOptions.contextSkipped` is removed
from the predicate.

`hasWorkspaceContext` is deleted. It has no non-test consumer today, and
leaving a second onboarding predicate that nothing calls in a file we are
already editing is how the next reader gets misled.

### The context prompt

Context gathering is not deleted — it moves to after the first result, where a
URL or note is motivated by a recommendation the visitor has already seen. It
reuses the existing URL/note fields and is dismissible.

The preference `onboardingContextSkipped` is renamed to
`contextPromptDismissed`. It is no longer onboarding and no longer a skip;
keeping the old name would leave a label that does not describe what the code
does. `userPreferencesStore` reads
`r.contextPromptDismissed ?? r.onboardingContextSkipped` so existing dismissals
survive. No data migration.

---

## Error handling

A failed simulation must not cost the visitor their decision. On failure they
land in the workspace with the decision saved and the error surfaced, able to
retry. Existing simulate error handling covers this; the new path must not
bypass it.

Workspace creation cannot fail for anonymous visitors — there is no remote to
fail. Signed-in visitors use the existing dual-write path.

---

## Testing

**Unit**

- `isWorkspaceOnboarded`: satisfied by workspace + goal; no longer satisfied by
  `contextSkipped`; no longer blocked by absent knowledge.
- The sample-decision path still skips the wizard. `WorkspaceService:1162`
  relies on `isWorkspaceOnboarded` being true for a first-time visitor given a
  sample decision. It should still hold under the new predicate — that path
  sets a goal — but it is asserted rather than assumed.
- `userPreferencesStore`: a stored `onboardingContextSkipped: true` reads back
  as `contextPromptDismissed: true`.

**E2E**

- `"a new user can skip context and reach the workspace in three steps"` asserts
  the flow this spec removes. Its premise dies. It becomes: reaches a ranked
  result in one step, signed out.
- `join-public-beta`: click through, type a decision, see a ranked result,
  never sign in, with "Sign in to save" visible throughout.

---

## The seeded sample decision is retired

Discovered during implementation, not anticipated by this spec.

`seedSampleDecision` builds a worked example for new visitors and promises "a
worked example a new visitor can explore immediately." It deliberately does not
set the workspace goal — claiming the goal made a visitor land on someone
else's objective.

That left exactly one window in which the sample was reachable, and this spec
closes it:

- `WorkspaceShell` mounts `/workspace/*` routes only when
  `isWorkspaceOnboarded(home)` is true, which requires a goal.
- On the wizard, the separate `goal` step set one. Routes mounted while the
  sample was still present, so it could be opened.
- Decision-first fuses goal-setting and running into one submit, and
  `runSimulation` drops any sample first — "the demo has served its purpose and
  must not sit beside real work".

So there is no longer a state where the workspace is reachable and the sample
still exists. Rather than leave a feature reachable only by a path this spec
removes, the sample is deleted: `sampleDecision.ts`, `seedSampleDecision`,
`removeSampleDecision`, `isSampleSimulation`, their tests, and the UI that
renders the sample banner.

The sample existed to fill the gap before a visitor had a result of their own.
Decision-first closes that gap in one action, which is what makes deleting it
the honest option rather than a loss.

## Out of scope

- Any gate on entry. This is the **public** beta; there is no invite code,
  waitlist, or `access_requests` queue, and one was deliberately removed before.
- Changes to `claimAnonymousWork` or the sign-in claim path. It works.
- Changes to ranking, scoring, or the engine.
