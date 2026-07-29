import { expect, test, type Page } from "@playwright/test";

/**
 * Authenticated Decision Workspace loop (E2E).
 *
 * Uses VITE_E2E_AUTH (Playwright webServer) + localStorage flag so we can
 * exercise the full product path without real Supabase credentials.
 * Production builds never set VITE_E2E_AUTH, so the flag alone is inert.
 */
/**
 * Mock auth for this browser context only.
 * Clear workspace once before first navigation — not on every page load
 * (addInitScript re-runs on each navigation and would wipe in-test memory).
 */
async function enableE2EAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("chronos.e2e.auth", "1");
  });
  // Wipe any leftover workspace from a prior failed run in this context
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.setItem("chronos.e2e.auth", "1");
    for (const key of [
      "chronos.workspace.v4",
      "chronos.workspace.v3",
      "chronos.workspace.v2",
      "chronos.workspace.v1",
    ]) {
      localStorage.removeItem(key);
    }
  });
}

test.describe("Decision Workspace (authenticated)", () => {
  test("idea → decision: onboard, generate futures, report, choose path, outcome, re-branch", async ({
    page,
  }) => {
    await enableE2EAuth(page);
    await page.goto("/workspace");

    // Bootstrap creates a personal workspace on first session → wizard lands on
    // "What decision are you trying to make?" Older path: Create workspace → Name.
    const createHeading = page.getByRole("heading", { name: /create workspace/i });
    const decisionHeading = page.getByRole("heading", {
      name: /what decision are you trying to make|what are you trying to decide|current goal/i,
    });
    await expect(createHeading.or(decisionHeading)).toBeVisible({ timeout: 15_000 });

    if (await createHeading.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /begin/i }).click();
      await expect(page.getByRole("heading", { name: /name this workspace/i })).toBeVisible();
      await page.getByLabel(/workspace name/i).fill("E2E Chronos Lab");
      await page.getByRole("button", { name: /continue/i }).click();
    }

    await expect(decisionHeading).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/first decision|decision \/ goal/i).fill("Launch CLAB public beta");
    await page.getByRole("button", { name: /continue/i }).click();

    // --- Add knowledge (note) ---
    await expect(page.getByRole("heading", { name: /add knowledge/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /^note$/i }).click();
    await page.getByLabel(/note title/i).fill("Beta constraints");
    await page.locator("textarea").fill("Small team, limited runway, prefer bootstrap path.");
    await page.getByRole("button", { name: /add knowledge/i }).click();

    // --- Workspace home is the Decision Brief (draft stage, no run yet) ---
    await expect(page.getByTestId("decision-brief")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Launch CLAB public beta").first()).toBeVisible();
    await expect(page.getByText(/no recommendation available/i)).toBeVisible();

    // HQ dashboard moved to /workspace/hq and keeps the Decision Card
    await page.goto("/workspace/hq");
    await expect(page.getByTestId("decision-card")).toBeVisible({ timeout: 15_000 });

    // --- Generate futures ---
    await page
      .getByRole("link", { name: /^simulations$/i })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: /^simulations$/i })).toBeVisible({
      timeout: 10_000,
    });

    // First-time form should auto-open (aria-label on objective input)
    const objective = page.getByLabel(/what should chronos decide/i);
    await expect(objective).toBeVisible({ timeout: 15_000 });
    await objective.fill("How should we launch the public beta with a small team?");
    await page.getByRole("button", { name: /^generate futures$/i }).click();

    // Land on simulation detail
    await expect(page).toHaveURL(/\/workspace\/simulations\/[a-z0-9-]+/i, {
      timeout: 20_000,
    });
    const firstSimUrl = page.url();

    // --- Decision pipeline + report contract ---
    await expect(page.getByTestId("decision-pipeline")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("decision-report")).toBeVisible();

    // --- Decision graph MVP: open → branches → compare ---
    await expect(page.getByTestId("decision-graph-panel")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("graph-structure")).toBeVisible();
    await expect(page.getByTestId("graph-describe")).toContainText(/branch/i);
    await expect(page.getByTestId("graph-compare")).toBeVisible();
    const branchCards = page.getByTestId("graph-branch-card");
    expect(await branchCards.count()).toBeGreaterThan(0);
    await branchCards.last().click();
    await expect(page.getByTestId("graph-rebranch")).toBeVisible();

    // --- Future graph: branches render and are clickable ---
    await expect(page.getByTestId("future-graph")).toBeVisible();
    const graphNodes = page.getByTestId("future-graph-node");
    expect(await graphNodes.count()).toBeGreaterThan(0);
    await graphNodes.last().click();
    await expect(page.getByTestId("future-graph")).toBeVisible();
    await expect(page.getByText(/^recommendation$/i).first()).toBeVisible();
    await expect(page.getByTestId("decision-evidence")).toBeVisible();
    await expect(page.getByTestId("expected-value")).toBeVisible();
    await expect(page.getByText(/why this was chosen/i).first()).toBeVisible();
    await expect(page.getByText(/future comparison/i).first()).toBeVisible();

    // Decide stage pending until path saved
    await expect(page.getByTestId("pipeline-decide")).toContainText(/pending/i);

    // --- Save decision (hard-gate) or choose path on timeline ---
    const saveDecision = page.getByRole("button", { name: /^save decision$/i });
    if (await saveDecision.isVisible().catch(() => false)) {
      await saveDecision.click();
    } else {
      const choose = page.getByRole("button", {
        name: /choose this path · save timeline/i,
      });
      await expect(choose).toBeVisible({ timeout: 10_000 });
      await choose.click();
    }
    await expect(page.getByTestId("pipeline-decide")).toContainText(/✓|complete|saved/i, {
      timeout: 10_000,
    });
    await expect(page.getByText(/path saved/i).first()).toBeVisible({ timeout: 10_000 });

    // Graph collapses after choose
    await expect(page.getByTestId("graph-describe")).toContainText(/collapsed/i, {
      timeout: 10_000,
    });

    // Execution plan is best-effort. E2E runs with the noop provider, which
    // returns no steps by design rather than inventing them — so the section
    // must be absent, and the decision must have saved anyway. This is the
    // fail-open guard: a plan never becomes a condition of a saved decision.
    await expect(page.getByTestId("execution-plan")).toHaveCount(0);

    // --- Outcome tracking ---
    await expect(page.getByText(/did you follow this recommendation/i)).toBeVisible();
    await page.getByRole("button", { name: /^yes$/i }).click();
    await expect(page.getByText(/how did it turn out/i)).toBeVisible({ timeout: 8_000 });
    await page
      .getByPlaceholder(/what happened/i)
      .fill("Shipped invite-only beta; conversion healthy.");
    await page.getByRole("button", { name: /save outcome/i }).click();
    await expect(page.getByText(/shipped invite-only beta/i)).toBeVisible({
      timeout: 8_000,
    });

    // --- Decision Brief (workspace home): lifecycle reflects the logged outcome ---
    await page.goto("/workspace");
    await expect(page.getByTestId("decision-brief")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Launch CLAB public beta").first()).toBeVisible();
    await expect(page.getByText(/^recommendation$/i).first()).toBeVisible();
    // Outcome was logged above → the band's current stage is Learned
    const currentStage = page.locator('[aria-current="step"]');
    await expect(currentStage).toContainText(/learned/i);
    // Recommendation deep-links to the simulation report
    await page.getByRole("link", { name: /review in simulation/i }).click();
    await expect(page).toHaveURL(/\/workspace\/simulations\/[a-z0-9-]+/i, {
      timeout: 10_000,
    });

    // Legacy /workspace/decision deep-links redirect to the workspace home
    await page.goto("/workspace/decision");
    await expect(page).toHaveURL(/\/workspace\/?$/, { timeout: 10_000 });
    await expect(page.getByTestId("decision-brief")).toBeVisible();

    // --- ⌘K command palette: type a command, Enter runs the top match ---
    await expect(page.getByTestId("stage-band")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByTestId("command-palette")).toBeVisible();
    await page.keyboard.type("show memory");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/workspace\/memory$/, { timeout: 10_000 });
    // The lifecycle band persists on every workspace page
    await expect(page.getByTestId("stage-band")).toBeVisible();

    // --- HQ Decision Card still lives at /workspace/hq (review-only CTA) ---
    await page.goto("/workspace/hq");
    await expect(page.getByTestId("decision-card")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("decision-card-recommendation")).toBeVisible();
    const hqCta = page.getByTestId("decision-card-cta");
    await expect(hqCta).toBeVisible();
    await expect(hqCta).not.toHaveText(/accept/i);
    await expect(page.getByTestId("decision-timeline-preview")).toBeVisible();

    // --- Memory retains decision + graph structure ---
    await page.goto("/workspace/memory");
    await expect(page.getByRole("heading", { name: /history/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/decision history/i).first()).toBeVisible();
    await expect(
      page.getByText(/launch clab public beta|how should we launch/i).first()
    ).toBeVisible();
    await expect(page.getByTestId("memory-graph-summary").first()).toContainText(/collapsed|open/i);

    // --- Re-branch from open: fork a new version, keep the prior one in Memory ---
    // Collapsing is not the end of the loop — standing back at N0 and forking
    // again is the product. The prior version must survive the fork.
    await page.goto(firstSimUrl);
    const rebranch = page.getByTestId("graph-rebranch");
    await expect(rebranch).toBeVisible({ timeout: 15_000 });
    await rebranch.click();

    // Lands on a *different* simulation, standing at open again (not collapsed)
    await expect(page).not.toHaveURL(firstSimUrl, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/workspace\/simulations\/[a-z0-9-]+/i);
    await expect(page.getByTestId("decision-graph-panel")).toBeVisible({ timeout: 15_000 });
    // "not yet collapsed" — the fork stands at N0 with fresh peers, uncommitted,
    // and is marked as a fork *immediately*, before it has chosen anything.
    await expect(page.getByTestId("graph-describe")).toContainText(/not yet collapsed/i);
    await expect(page.getByTestId("graph-rebranched-badge")).toBeVisible();

    // Memory keeps the prior version. Decision history lists *decided* runs only
    // (listDecisionHistory skips sims with no chosen path), so the uncommitted
    // fork is correctly absent — what must survive is the collapsed original.
    await page.goto("/workspace/memory");
    await expect(page.getByRole("heading", { name: /history/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("memory-graph-summary").first()).toContainText(/collapsed/i);

    // ...and the prior version is still openable, still collapsed, not overwritten
    await page.goto(firstSimUrl);
    await expect(page.getByTestId("decision-graph-panel")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("graph-describe")).toContainText(/collapsed/i);
    await expect(page.getByTestId("graph-describe")).not.toContainText(/not yet collapsed/i);
  });

  test("an anonymous visitor gets a workspace, and is told it is device-only", async ({ page }) => {
    // Deliberately replaces "workspace still requires login". The workspace is
    // local-first: no account needed to run the decision loop, and signing in is
    // how work becomes durable. See SPEC-anonymous-workspace.md.
    await page.goto("/workspace");

    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByTestId("sign-in-to-save")).toBeVisible({ timeout: 15_000 });
    // The durability limit must be stated, not implied.
    await expect(page.getByTestId("anonymous-banner")).toContainText(/this device only/i);

    // Asked for their own decision first. The seeded sample is an example to
    // look at, not the visitor's identity — it must not answer "what are you
    // deciding?" on their behalf.
    await expect(
      page.getByRole("heading", {
        name: /what decision are you trying to make|what are you trying to decide|current goal/i,
      })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/first decision|decision \/ goal/i).fill("My own beta decision");
    await page.getByRole("button", { name: /continue/i }).click();

    // Their decision is the workspace's, not the sample's.
    await expect(page.getByTestId("decision-brief")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("My own beta decision").first()).toBeVisible();

    // And the sample is still there to explore.
    await page.goto("/workspace/simulations");
    const sampleRun = page.getByRole("link", { name: /launch our public beta/i }).first();
    await expect(sampleRun).toBeVisible({ timeout: 15_000 });
    await sampleRun.click();

    // Labelled as a sample — it must never read as the visitor's own run.
    await expect(page.getByTestId("sample-banner")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("decision-graph-panel")).toBeVisible({ timeout: 15_000 });

    // And removable in one click.
    await page.getByTestId("remove-sample").click();
    await expect(page.getByTestId("sample-banner")).toHaveCount(0, { timeout: 10_000 });
  });

  test("a new user can skip context and reach the workspace in three steps", async ({ page }) => {
    // Onboarding used to hard-gate on knowledge while the simulation form said
    // "you can still run without it". Skipping resolves that contradiction and
    // removes a form from the path to a first decision.
    await enableE2EAuth(page);
    await page.goto("/workspace");

    const createHeading = page.getByRole("heading", { name: /create workspace/i });
    const decisionHeading = page.getByRole("heading", {
      name: /what decision are you trying to make|what are you trying to decide|current goal/i,
    });
    await expect(createHeading.or(decisionHeading)).toBeVisible({ timeout: 15_000 });

    if (await createHeading.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /begin/i }).click();
      await expect(page.getByRole("heading", { name: /name this workspace/i })).toBeVisible();
      await page.getByLabel(/workspace name/i).fill("Skip Lab");
      await page.getByRole("button", { name: /continue/i }).click();
    }

    await expect(decisionHeading).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/first decision|decision \/ goal/i).fill("Ship without a source");
    await page.getByRole("button", { name: /continue/i }).click();

    // Context step offers a way past itself.
    await expect(page.getByRole("heading", { name: /add knowledge/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("skip-context").click();

    // Workspace unlocks with no knowledge and no notes.
    await expect(page.getByTestId("decision-brief")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Ship without a source").first()).toBeVisible();
  });

  test("settings asks an anonymous visitor to sign in rather than ejecting them", async ({
    page,
  }) => {
    // Sharing and members need real identities. A prompt in place keeps the
    // visitor inside a workspace that otherwise works without an account; a
    // redirect would throw them out of it.
    // A brand-new visitor has no workspace yet, so the shell shows onboarding
    // rather than the settings surface. What matters here is the inversion: no
    // login wall. The sign-in gate itself is covered by a component test, which
    // can put the page in the anonymous-with-workspace state directly.
    await page.goto("/workspace/settings");
    await expect(page).toHaveURL(/\/workspace\/settings$/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
