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

    // Bootstrap creates a personal workspace on first session, but it has no
    // goal yet, so decision-first entry is the first thing rendered: one
    // field, one action, straight to a ranked result. The wizard this
    // replaced took a "Create workspace" and "Name this workspace" step to
    // reach the same point.
    await page.getByLabel(/what are you deciding/i).fill("Launch CLAB public beta");
    await page.getByRole("button", { name: /simulate/i }).click();

    // Land directly on simulation detail — no separate "generate futures"
    // step stands between the goal and the first result anymore.
    await expect(page).toHaveURL(/\/workspace\/simulations\/[a-z0-9-]+/i, {
      timeout: 20_000,
    });
    const firstSimUrl = page.url();

    // --- Decision pipeline + report contract ---
    await expect(page.getByTestId("decision-pipeline")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("decision-report")).toBeVisible();

    // --- Add knowledge now that there is a recommendation to argue with.
    // Onboarding used to ask for a source before the first result; the
    // context prompt now asks after, on the report it exists to inform.
    await expect(page.getByRole("heading", { name: /add what you know/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByLabel(/note title/i).fill("Beta constraints");
    await page
      .getByLabel(/note content/i)
      .fill("Small team, limited runway, prefer bootstrap path.");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByRole("heading", { name: /add what you know/i })).toHaveCount(0);

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
    // The verdict is what calibration reads. Without it the run is "awaiting an
    // outcome" — silence is never scored as "as expected".
    await page.getByRole("button", { name: /^as predicted$/i }).click();
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
    await page.getByRole("link", { name: /collapse to this future/i }).click();
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

    // --- Calibration reads the verdict, and refuses to turn one run into a rate ---
    // The full loop: a followed run with a verdict becomes a measured data point
    // on the surface that reports what confidence has been worth.
    await expect(page.getByTestId("calibration-denominators")).toContainText(/1 measured/i);
    await expect(page.getByTestId("calibration-empty")).toHaveCount(0);
    // One run is under the minimum sample, so every band withholds its rate
    // rather than printing a 100% derived from a single outcome.
    await expect(page.getByTestId("calibration-bands")).toContainText(/not yet/i);

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

    // --- The registry files the fork as v2 of one question, not a second one ---
    // This is the whole point of decisions being first-class: /simulations
    // shows two rows because two runs happened, and the registry shows one,
    // because only one question was asked.
    await page.goto("/workspace/decisions");
    await expect(page.getByTestId("decision-registry")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("decision-row")).toHaveCount(1);
    await expect(page.getByTestId("decision-version-count")).toHaveText(/2 versions/i);
    // Collapsed and an outcome logged earlier in this test, so it reads as executed.
    await expect(page.getByTestId("decision-row")).toContainText(/executed/i);
  });

  test("saving a decision records a review date and the brief chases it", async ({ page }) => {
    await enableE2EAuth(page);
    await page.goto("/workspace");

    await page.getByLabel(/what are you deciding/i).fill("Launch an outcome review beta");
    await page.getByRole("button", { name: /simulate/i }).click();
    await expect(page).toHaveURL(/\/workspace\/simulations\/[a-z0-9-]+/i, { timeout: 20_000 });

    // Land on the DecisionReportCard's own Save decision button — this
    // guarantees the horizon picker Task 3 added is the one in play, rather
    // than reaching the timeline's alternate "choose this path" affordance.
    await expect(page.getByTestId("decision-report")).toBeVisible({ timeout: 10_000 });

    // Prove the picker is interactive, not just relying on its default. The
    // radio input itself is visually hidden (sr-only) behind its pill label,
    // so target the label text a user actually clicks.
    await page.getByText("3 months", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "3 months" })).toBeChecked();
    await page.getByRole("button", { name: /^save decision$/i }).click();
    await expect(page.getByRole("button", { name: /^save decision$/i })).toBeHidden();

    // The review date is three months out, so nothing is due yet.
    await page.goto("/workspace");
    await expect(page.getByTestId("decision-brief")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("outcome-review-banner")).toBeHidden();

    // Move the stored review date into the past — the same thing waiting
    // three months would do, without waiting three months.
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

  test("an anonymous visitor gets a workspace, and is told it is device-only", async ({ page }) => {
    // Deliberately replaces "workspace still requires login". The workspace is
    // local-first: no account needed to run the decision loop, and signing in is
    // how work becomes durable. See SPEC-anonymous-workspace.md.
    await page.goto("/workspace");

    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByTestId("sign-in-to-save")).toBeVisible({ timeout: 15_000 });
    // The durability limit must be stated, not implied.
    await expect(page.getByTestId("anonymous-banner")).toContainText(/this device only/i);

    // Asked for their own decision first — nothing answers it on their behalf.
    const decisionField = page.getByLabel(/what are you deciding/i);
    await expect(decisionField).toBeVisible({ timeout: 15_000 });
    await expect(decisionField).toHaveValue("");
  });

  test("an off-domain objective is refused rather than dressed up as a SaaS play", async ({
    page,
  }) => {
    // "I want to cook boiled egg" used to produce a branch called
    // "Bottom-up SaaS · want cook boiled", scored and ranked as if it meant
    // something. The catalog is startup scenarios only, so the honest answer
    // is to say so rather than staple the user's words onto a template.
    // The refusal has to hold on the *first* screen too. Decision-first entry
    // runs the engine straight from this field, so a guard that only lived on
    // the run form behind it was a guard no first-time visitor ever met.
    await page.goto("/workspace");
    const firstDecision = page.getByLabel(/what are you deciding/i);
    await firstDecision.fill("I want to cook boiled egg");
    await expect(page.getByText(/startup and business decisions/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /simulate/i })).toBeDisabled();

    // A real business objective clears it, and produces the first result the
    // rest of this test needs.
    await firstDecision.fill("My own beta decision");
    await expect(page.getByText(/startup and business decisions/i)).toHaveCount(0);
    await page.getByRole("button", { name: /simulate/i }).click();
    await expect(page).toHaveURL(/\/workspace\/simulations\/.+/, { timeout: 15_000 });

    await page.goto("/workspace/simulations?new=1");

    const objective = page.getByLabel(/what should chronos decide/i);
    await expect(objective).toBeVisible({ timeout: 15_000 });

    await objective.fill("I want to cook boiled egg");
    await expect(page.getByText(/startup and business decisions/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /generate futures/i })).toBeDisabled();

    // A real business objective clears it — the gate must not become a wall.
    await objective.fill("How should we launch the public beta with a small team?");
    await expect(page.getByText(/startup and business decisions/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /generate futures/i })).toBeEnabled();
  });

  test("a new user reaches a ranked result in one step", async ({ page }) => {
    // Replaces the four-screen wizard's "skip context" test. Decision-first
    // entry has no context step to skip — one field, one action, a result.
    await page.goto("/workspace");

    await page.getByLabel(/what are you deciding/i).fill("Launch an AI meeting assistant");
    await page.getByRole("button", { name: /simulate/i }).click();

    await expect(page).toHaveURL(/\/workspace\/simulations\/.+/, { timeout: 15_000 });
    // The report's own "Recommendation" section, not a guessed phrase — the
    // rendered page has no literal "best path" text anywhere on it.
    await expect(page.getByText(/recommendation/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("sim detail shows knowledge-delta and confidence surfaces", async ({ page }) => {
    await enableE2EAuth(page);
    await page.goto("/workspace");
    await page.getByLabel(/what are you deciding/i).fill("How should we price the public beta?");
    await page.getByRole("button", { name: /simulate/i }).click();
    await expect(page).toHaveURL(/\/workspace\/simulations\/.+/i, { timeout: 20_000 });

    // Knowledge-diff panel always mounts on completed runs (empty or with delta).
    await expect(page.getByTestId("knowledge-delta")).toBeVisible({ timeout: 15_000 });
    // Fresh run: library matches snapshot (or empty both sides) — honest empty state.
    await expect(
      page.getByTestId("knowledge-delta-empty").or(page.getByTestId("knowledge-delta-added"))
    ).toBeVisible();

    // Calibration empty on Memory when no followed verdicts yet (not zeros).
    await page.goto("/workspace/memory");
    await expect(
      page.getByTestId("calibration-empty").or(page.getByTestId("calibration-bands"))
    ).toBeVisible({
      timeout: 15_000,
    });
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
