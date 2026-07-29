import { expect, test } from "@playwright/test";

test.describe("Join public beta", () => {
  test("takes a visitor straight into a workspace, no signup wall", async ({ page }) => {
    // Deliberately replaces "opens signup modal from nav". The workspace runs
    // without an account, so the front door should not be a signup form —
    // signing in is how work is kept, not how it starts.
    // See SPEC-anonymous-workspace.md.
    await page.goto("/");

    const joinBeta = page.getByRole("link", { name: /join public beta/i }).first();
    await expect(joinBeta).toBeVisible();
    await joinBeta.click();

    await expect(page).toHaveURL(/\/workspace/, { timeout: 15_000 });
    await expect(page.getByTestId("sign-in-to-save")).toBeVisible({ timeout: 15_000 });
  });

  test("sign in is still one click away for people who want an account", async ({ page }) => {
    // Removing the wall must not remove the door.
    await page.goto("/");

    await page
      .getByRole("link", { name: /^sign in$/i })
      .first()
      .click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /welcome back|start deciding/i })).toBeVisible();
  });
});
