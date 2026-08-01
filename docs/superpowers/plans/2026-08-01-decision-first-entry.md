# Decision-First Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A visitor who lands on `/workspace` types their decision and sees a ranked result, without signing in and without a four-step wizard.

**Architecture:** `WorkspaceOnboarding`'s step machine is replaced by a single screen, `WorkspaceStart`, rendered by the same `!isWorkspaceOnboarded` branch in `WorkspaceShell`. Submitting creates the workspace with a fixed default name, sets the goal, runs the simulation, and navigates to the result. Context gathering moves to a dismissible prompt on the simulation detail page.

**Tech Stack:** React 18 + TypeScript, react-router-dom, Vitest + @testing-library/react, Playwright, Biome.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-01-decision-first-entry-design.md`.
- Anonymous visitors must never be blocked. No new auth gate, no invite code, no waitlist.
- Do not touch `claimAnonymousWork`, ranking, scoring, or the engine.
- Do not touch the sample-decision path in `WorkspaceService` (`SAMPLE_WORKSPACE_NAME`).
- Before pushing, CI is: `npx tsc --noEmit && npx biome ci . && npm run test:unit && npm run test:e2e`.
- `biome ci` fails on errors; formatting counts as an error. Run `npm run lint:fix` before committing.
- Comments explain **why**, not what. Match surrounding density.

---

### Task 1: Simplify the onboarding predicate

**Files:**
- Modify: `src/domain/workspace/onboarding.ts:23-39`
- Test: `src/domain/workspace/onboarding.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isWorkspaceOnboarded(home: WorkspaceHome | null): boolean` — note the second parameter is **removed**. `hasWorkspaceContext` no longer exists.

- [ ] **Step 1: Write the failing test**

Add to `src/domain/workspace/onboarding.test.ts`:

```typescript
it("is satisfied by a workspace and a goal, with no knowledge or notes", () => {
  const home = {
    workspace: { id: "ws-1", name: "Workspace" },
    goal: { title: "Launch the beta" },
    knowledge: [],
    notes: [],
  } as unknown as WorkspaceHome;

  // Context used to gate this. It no longer does: the first result is what
  // motivates attaching a source, so requiring one first inverted the order.
  expect(isWorkspaceOnboarded(home)).toBe(true);
});

it("is not satisfied by a workspace without a goal", () => {
  const home = {
    workspace: { id: "ws-1", name: "Workspace" },
    goal: null,
    knowledge: [],
    notes: [],
  } as unknown as WorkspaceHome;

  expect(isWorkspaceOnboarded(home)).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/workspace/onboarding.test.ts`
Expected: FAIL — the first test returns `false`, because the current predicate requires `knowledge.length > 0 || notes.length > 0` when `contextSkipped` is absent.

- [ ] **Step 3: Write minimal implementation**

Replace `hasWorkspaceContext` and `isWorkspaceOnboarded` in `src/domain/workspace/onboarding.ts` with:

```typescript
/**
 * Onboarded = there is a workspace and a decision. Context is not a gate:
 * a source is worth attaching once you have seen a recommendation, so
 * requiring one first put forms between a visitor and their first result.
 */
export function isWorkspaceOnboarded(home: WorkspaceHome | null): boolean {
  if (!home?.workspace?.id) return false;
  return Boolean(home.goal?.title?.trim());
}
```

Delete `hasWorkspaceContext` entirely — it has no non-test consumer. Leave
`ONBOARDING_STEPS`, `OnboardingStep`, `OnboardingOptions`,
`requiredOnboardingStep`, `onboardingStepIndex`, and `onboardingProgress` in
place for now; Task 3 deletes them once their only consumer is gone.

- [ ] **Step 4: Fix the call sites and existing tests**

Both callers pass a now-removed second argument. Drop it:

- `src/presentation/features/workspace/WorkspaceOnboarding.tsx:45` → `if (isWorkspaceOnboarded(home)) return null;`
- `src/presentation/features/workspace/WorkspaceShell.tsx:59-61` → `const ready = isWorkspaceOnboarded(home);`

In `onboarding.test.ts`, delete any test asserting `hasWorkspaceContext`, and any asserting that `contextSkipped` flips the result — both describe behaviour that no longer exists.

- [ ] **Step 5: Run the full unit suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. `onboardingProgress` still compiles because it passes `options` to `requiredOnboardingStep`, not to `isWorkspaceOnboarded` — if it does pass options to the predicate, drop that argument too.

- [ ] **Step 6: Commit**

```bash
npm run lint:fix
git add src/domain/workspace/onboarding.ts src/domain/workspace/onboarding.test.ts src/presentation/features/workspace/WorkspaceOnboarding.tsx src/presentation/features/workspace/WorkspaceShell.tsx
git commit -m "refactor: onboarded means a workspace and a decision

Context stops gating the workspace. Attaching a source is motivated by a
recommendation you have already seen, so requiring one first inverted the
order. hasWorkspaceContext goes with it — no non-test consumer."
```

---

### Task 2: Rename the context preference

**Files:**
- Modify: `src/domain/workspace/betaChecklist.ts:20-32`
- Modify: `src/infrastructure/auth/userPreferencesStore.ts:35`
- Modify: `src/presentation/features/workspace/WorkspaceOnboarding.tsx:30,327`
- Test: `src/infrastructure/auth/userPreferencesStore.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `UserPreferences.contextPromptDismissed: boolean`. `onboardingContextSkipped` is gone from the type but still read from storage as a fallback.

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/auth/userPreferencesStore.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { loadUserPreferences } from "./userPreferencesStore";

const KEY = "chronos.user.preferences.v1";

describe("userPreferencesStore", () => {
  beforeEach(() => localStorage.clear());

  it("reads a dismissal stored under the old key", () => {
    // Renaming the field must not re-prompt everyone who already dismissed it.
    localStorage.setItem(KEY, JSON.stringify({ "user-1": { onboardingContextSkipped: true } }));

    expect(loadUserPreferences("user-1").contextPromptDismissed).toBe(true);
  });

  it("prefers the new key when both are present", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        "user-1": { onboardingContextSkipped: true, contextPromptDismissed: false },
      })
    );

    expect(loadUserPreferences("user-1").contextPromptDismissed).toBe(false);
  });
});
```

The coercion function `normalize` is private. Test through `loadUserPreferences`,
the real entry point — exporting an internal so a test can reach it would put
test-only surface into production code.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/infrastructure/auth/userPreferencesStore.test.ts`
Expected: FAIL — `contextPromptDismissed` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `src/domain/workspace/betaChecklist.ts`, rename the field:

```typescript
export type UserPreferences = {
  shareAcknowledged: boolean;
  preferredAuthProvider: string | null;
  /** Visitor dismissed the post-result "add a source?" prompt. */
  contextPromptDismissed: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  shareAcknowledged: false,
  preferredAuthProvider: null,
  contextPromptDismissed: false,
};
```

In `src/infrastructure/auth/userPreferencesStore.ts:35`, coalesce old to new:

```typescript
// Old key kept as a fallback read so an existing dismissal survives the
// rename. No data migration; the new key wins once anything writes it.
contextPromptDismissed: Boolean(r.contextPromptDismissed ?? r.onboardingContextSkipped),
```

- [ ] **Step 4: Update the remaining call sites**

- `WorkspaceOnboarding.tsx:30` → `const onboardingOptions = { contextSkipped: preferences.contextPromptDismissed };`
- `WorkspaceOnboarding.tsx:327` → `updatePreferences({ contextPromptDismissed: true })`
- `betaChecklist.test.ts` — update any fixture using the old field name.

- [ ] **Step 5: Run tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run lint:fix
git add -A
git commit -m "refactor: rename onboardingContextSkipped to contextPromptDismissed

It is no longer onboarding and no longer a skip — it dismisses a prompt
shown after the first result. The store reads the old key as a fallback so
existing dismissals survive; no data migration."
```

---

### Task 3: Replace the wizard with a decision-first screen

**Files:**
- Create: `src/presentation/features/workspace/WorkspaceStart.tsx`
- Create: `src/presentation/features/workspace/WorkspaceStart.test.tsx`
- Delete: `src/presentation/features/workspace/WorkspaceOnboarding.tsx`
- Modify: `src/presentation/features/workspace/WorkspaceShell.tsx:10,318-319`
- Modify: `src/domain/workspace/onboarding.ts` (delete the step machinery)
- Modify: `src/domain/workspace/onboarding.test.ts` (delete its tests)

**Interfaces:**
- Consumes: `isWorkspaceOnboarded(home)` from Task 1; `contextPromptDismissed` from Task 2.
- Consumes from `useWorkspace()`: `createWorkspace(name: string, description?: string): Promise<void>`, `setGoal(title: string, description?: string): Promise<void>`, `runSimulation(objective: string, constraints?: string[]): Promise<string | null>`.
- Produces: `WorkspaceStart` (no props).

- [ ] **Step 1: Write the failing test**

Create `src/presentation/features/workspace/WorkspaceStart.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceStart } from "./WorkspaceStart";

const calls: string[] = [];
const runSimulation = vi.fn(async () => "sim-1");
const navigate = vi.fn();

vi.mock("./WorkspaceContext", () => ({
  useWorkspace: () => ({
    home: null,
    error: null,
    createWorkspace: vi.fn(async () => { calls.push("createWorkspace"); }),
    setGoal: vi.fn(async () => { calls.push("setGoal"); }),
    runSimulation: async (objective: string) => {
      calls.push("runSimulation");
      return runSimulation(objective);
    },
  }),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

describe("WorkspaceStart", () => {
  it("takes a decision and reaches a result in one submit", async () => {
    render(<WorkspaceStart />);

    await userEvent.type(
      screen.getByLabelText(/what are you deciding/i),
      "Launch the beta in September"
    );
    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    // Order matters: the workspace has to exist before a goal can hang off it,
    // and the goal before the run that reads it.
    expect(calls).toEqual(["createWorkspace", "setGoal", "runSimulation"]);
    expect(runSimulation).toHaveBeenCalledWith("Launch the beta in September");
    expect(navigate).toHaveBeenCalledWith("/workspace/simulations/sim-1");
  });

  it("does not submit an empty decision", async () => {
    render(<WorkspaceStart />);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(runSimulation).not.toHaveBeenCalled();
    expect(screen.getByText(/what decision are you working on/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/presentation/features/workspace/WorkspaceStart.test.tsx`
Expected: FAIL — cannot resolve `./WorkspaceStart`.

- [ ] **Step 3: Write minimal implementation**

Create `src/presentation/features/workspace/WorkspaceStart.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "./WorkspaceContext";

/** Name for the container, not the decision — a workspace outlives its first one. */
const DEFAULT_WORKSPACE_NAME = "My workspace";

/**
 * First screen a visitor meets. One field, one action, then a ranked result.
 * The wizard this replaced asked for a welcome, a workspace name, and a
 * source before the decision — the product's own docstring recorded that as
 * "four forms between a new user and their first simulation".
 */
export function WorkspaceStart() {
  const { createWorkspace, setGoal, runSimulation, error } = useWorkspace();
  const navigate = useNavigate();
  const [decision, setDecision] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const objective = decision.trim();
    if (!objective) {
      setLocalError("What decision are you working on?");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await createWorkspace(DEFAULT_WORKSPACE_NAME);
      await setGoal(objective);
      const simulationId = await runSimulation(objective);
      // A failed run must not cost the decision — it is saved either way, and
      // the workspace renders with the error rather than an empty start screen.
      if (simulationId) navigate(`/workspace/simulations/${simulationId}`);
    } catch (err) {
      setLocalError((err as Error).message || "Could not start the simulation.");
    } finally {
      setBusy(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="mx-auto max-w-lg">
      <form onSubmit={submit}>
        <label htmlFor="decision" className="block text-sm font-medium text-ink">
          What are you deciding?
        </label>
        <input
          id="decision"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          placeholder="Launch CLAB on Kickstart"
          className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink"
        />
        {displayError && <p className="mt-2 text-sm text-ink-dim">{displayError}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-full border border-chronos/40 bg-chronos/10 px-4 py-2 text-chronos"
        >
          {busy ? "Simulating…" : "Simulate"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/presentation/features/workspace/WorkspaceStart.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Swap it into the shell and delete the wizard**

In `WorkspaceShell.tsx`: change the import on line 10 to `import { WorkspaceStart } from "./WorkspaceStart";` and the render at line 319 to `<WorkspaceStart />`.

Then delete `WorkspaceOnboarding.tsx`, and delete from `onboarding.ts` everything that only it used: `ONBOARDING_STEPS`, `OnboardingStep`, `OnboardingOptions`, `requiredOnboardingStep`, `onboardingStepIndex`, `onboardingProgress`. Delete their tests from `onboarding.test.ts`.

Confirm nothing else referenced them:

```bash
rg -n "WorkspaceOnboarding|ONBOARDING_STEPS|requiredOnboardingStep|onboardingStepIndex|onboardingProgress|OnboardingOptions" src
```

Expected: no matches.

- [ ] **Step 6: Run the full gate**

Run: `npx tsc --noEmit && npx biome ci . && npm run test:unit`
Expected: PASS. If `KnowledgeImport` helpers (`prepareImportUrl`, `prepareUploadFile`) now have no consumer, leave them — Task 4 uses them.

- [ ] **Step 7: Commit**

```bash
npm run lint:fix
git add -A
git commit -m "feat: decision-first entry replaces the onboarding wizard

A visitor types their decision and gets a ranked result in one submit. The
welcome, workspace-name and context screens are gone, along with the step
machine that existed only to sequence them."
```

---

### Task 4: Context prompt after the first result

**Files:**
- Create: `src/presentation/features/workspace/ContextPrompt.tsx`
- Create: `src/presentation/features/workspace/ContextPrompt.test.tsx`
- Modify: `src/presentation/features/simulation/SimulationPages.tsx:261` (`SimulationDetailPage`)

**Interfaces:**
- Consumes: `contextPromptDismissed` and `updatePreferences` from Task 2; `addKnowledge`, `addNote` from `useWorkspace()`; `prepareImportUrl` from `application/workspace/KnowledgeImport`.
- Produces: `ContextPrompt` (no props).

- [ ] **Step 1: Write the failing test**

Create `src/presentation/features/workspace/ContextPrompt.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ContextPrompt } from "./ContextPrompt";

const updatePreferences = vi.fn();
const addNote = vi.fn(async () => {});

function mockWorkspace(contextPromptDismissed: boolean) {
  vi.doMock("./WorkspaceContext", () => ({
    useWorkspace: () => ({
      preferences: { contextPromptDismissed },
      updatePreferences,
      addNote,
      addKnowledge: vi.fn(async () => {}),
    }),
  }));
}

describe("ContextPrompt", () => {
  it("renders nothing once dismissed", async () => {
    mockWorkspace(true);
    const { ContextPrompt: Dismissed } = await import("./ContextPrompt");
    const { container } = render(<Dismissed />);

    expect(container).toBeEmptyDOMElement();
  });

  it("remembers a dismissal", async () => {
    mockWorkspace(false);
    render(<ContextPrompt />);

    await userEvent.click(screen.getByRole("button", { name: /not now/i }));

    // Persisted, not component state: the prompt must not return on the next
    // simulation the visitor opens.
    expect(updatePreferences).toHaveBeenCalledWith({ contextPromptDismissed: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/presentation/features/workspace/ContextPrompt.test.tsx`
Expected: FAIL — cannot resolve `./ContextPrompt`.

- [ ] **Step 3: Write minimal implementation**

Create `src/presentation/features/workspace/ContextPrompt.tsx`:

```tsx
import { useState } from "react";
import { useWorkspace } from "./WorkspaceContext";

/**
 * Asks for a source *after* a recommendation exists, where a note or URL is
 * motivated by something the visitor has read. Onboarding used to ask first,
 * which is why it was skippable and mostly skipped.
 */
export function ContextPrompt() {
  const { preferences, updatePreferences, addNote } = useWorkspace();
  const [title, setTitle] = useState("Decision context");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  if (preferences.contextPromptDismissed) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await addNote(title.trim() || "Decision context", body.trim());
      updatePreferences({ contextPromptDismissed: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-bg-soft p-5">
      <h2 className="font-serif text-xl text-ink">Add what you know</h2>
      <p className="mt-1 text-[13px] text-ink-dim">
        Facts, constraints, assumptions. Chronos weighs them on the next run.
      </p>
      <form onSubmit={save} className="mt-3 space-y-2">
        <input
          aria-label="Note title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink"
        />
        <textarea
          aria-label="Note content"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded-full border border-chronos/40 bg-chronos/10 px-4 py-2 text-chronos">
            Save
          </button>
          <button
            type="button"
            onClick={() => updatePreferences({ contextPromptDismissed: true })}
            className="rounded-full border border-line px-4 py-2 text-ink-dim"
          >
            Not now
          </button>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/presentation/features/workspace/ContextPrompt.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Render it on the simulation detail page**

In `SimulationPages.tsx`, inside `SimulationDetailPage` (line 261), render `<ContextPrompt />` below the result content. Read the surrounding JSX first and place it where a follow-up action belongs — after the recommendation, not above it.

- [ ] **Step 6: Run the full gate**

Run: `npx tsc --noEmit && npx biome ci . && npm run test:unit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run lint:fix
git add -A
git commit -m "feat: ask for context after the first result, not before it

A note is worth writing once there is a recommendation to argue with. The
prompt is dismissible and the dismissal persists."
```

---

### Task 5: End-to-end coverage

**Files:**
- Modify: `e2e/decision-workspace.spec.ts` (the "skip context ... in three steps" test)
- Modify: `e2e/join-public-beta.spec.ts`

**Interfaces:**
- Consumes: everything above. No new exports.

- [ ] **Step 1: Rewrite the three-steps test**

Find the test named `a new user can skip context and reach the workspace in three steps` in `e2e/decision-workspace.spec.ts`. Its premise is the flow this plan removes. Replace its body and name:

```typescript
test("a new user reaches a ranked result in one step", async ({ page }) => {
  await page.goto("/workspace");

  await page.getByLabel(/what are you deciding/i).fill("Launch an AI meeting assistant");
  await page.getByRole("button", { name: /simulate/i }).click();

  await expect(page).toHaveURL(/\/workspace\/simulations\/.+/, { timeout: 15_000 });
  await expect(page.getByText(/best path/i).first()).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 2: Extend the join-public-beta test**

In `e2e/join-public-beta.spec.ts`, extend the first test so it carries through to a result without signing in:

```typescript
await page.getByLabel(/what are you deciding/i).fill("Launch a developer tool");
await page.getByRole("button", { name: /simulate/i }).click();

await expect(page.getByText(/best path/i).first()).toBeVisible({ timeout: 15_000 });
// The whole point of the public beta: a result before an account.
await expect(page.getByTestId("sign-in-to-save")).toBeVisible();
```

- [ ] **Step 3: Run E2E**

Run: `npm run test:e2e`
Expected: PASS, 13 tests.

If a test fails because the sample decision seeds a goal and the start screen never renders, that is Task 1's predicate meeting `WorkspaceService:1162` — the sample path deliberately makes a first-time visitor look onboarded. Assert the intended behaviour rather than working around it: a visitor given a sample decision should land in the workspace, not on the start screen.

- [ ] **Step 4: Run the whole CI gate**

Run: `npx tsc --noEmit && npx biome ci . && npm run test:unit && npm run test:e2e`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: cover decision-first entry end to end

The three-steps test asserted the wizard this replaced; it now asserts a
ranked result in one step. join-public-beta carries through to a result
without an account."
```

---

## Self-Review Notes

Spec coverage checked section by section:

| Spec section | Task |
|---|---|
| Entry surface | 3 |
| Workspace naming (fixed default) | 3 — `DEFAULT_WORKSPACE_NAME` |
| Submit flow | 3 |
| Onboarded semantics | 1 |
| `hasWorkspaceContext` deleted | 1 |
| Context prompt + preference rename | 2, 4 |
| Error handling | 3 — decision saved before the run; failure surfaces in the workspace |
| Testing | 1, 2, 3, 4, 5 |
| Out of scope respected | Global Constraints |

One known soft spot, called out rather than hidden:

- **Task 4 Step 5** places `<ContextPrompt />` inside `SimulationDetailPage` by description, not by line number, because the surrounding JSX has not been read. The step says to read it first and place the prompt after the recommendation.

Task 2's test was rewritten during self-review: it originally called an invented `readUserPreferences(raw)`. The real module exports only `loadUserPreferences(userId)` and `saveUserPreferences`, with the coercion private, so the test now seeds `localStorage` and goes through the real entry point.
