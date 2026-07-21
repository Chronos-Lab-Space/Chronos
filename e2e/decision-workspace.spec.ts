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
  test("idea → decision: onboard, generate futures, report, choose path, outcome", async ({
    page,
  }) => {
    await enableE2EAuth(page);
    await page.goto("/workspace");

    // Bootstrap creates a personal workspace on first session → wizard lands on
    // "What are you trying to decide?" Older path: Create workspace → Name.
    const createHeading = page.getByRole("heading", { name: /create workspace/i });
    const decisionHeading = page.getByRole("heading", {
      name: /what are you trying to decide|current goal/i,
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

    // --- Add context (note) ---
    await expect(page.getByRole("heading", { name: /add context/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /^note$/i }).click();
    await page.getByLabel(/note title/i).fill("Beta constraints");
    await page.locator("textarea").fill("Small team, limited runway, prefer bootstrap path.");
    await page.getByRole("button", { name: /add context & open dashboard/i }).click();

    // --- Dashboard ---
    await expect(page.getByText(/what am i working on/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Launch CLAB public beta").first()).toBeVisible();

    // --- Generate futures ---
    await page.getByRole("link", { name: /^simulations$/i }).first().click();
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

    // --- Compare + Decision Report ---
    await expect(page.getByText(/future comparison/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/decision report/i).first()).toBeVisible();
    await expect(page.getByText(/recommended because/i).first()).toBeVisible();
    await expect(page.getByText(/recommended path/i).first()).toBeVisible();

    // --- Choose path · Save timeline ---
    const choose = page.getByRole("button", {
      name: /choose this path · save timeline/i,
    });
    await expect(choose).toBeVisible({ timeout: 10_000 });
    await choose.click();
    await expect(
      page.getByRole("button", { name: /path saved to timeline/i })
    ).toBeVisible({ timeout: 10_000 });

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

    // --- Memory retains decision ---
    await page.goto("/workspace/memory");
    await expect(page.getByRole("heading", { name: /history/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/decision history/i).first()).toBeVisible();
    await expect(
      page.getByText(/launch clab public beta|how should we launch/i).first()
    ).toBeVisible();
  });

  test("without e2e flag, workspace still requires login", async ({ page }) => {
    // No localStorage flag — even with VITE_E2E_AUTH build flag, must redirect
    await page.goto("/workspace");
    await expect(page).toHaveURL(/\/login$/);
  });
});
