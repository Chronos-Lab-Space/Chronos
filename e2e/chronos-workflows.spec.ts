import { expect, test } from "@playwright/test";

test.describe("Chronos user workflows", () => {
  test("the landing page turns an objective into a visible task plan and ranked path", async ({ page }) => {
    await page.goto("/#/");

    await expect(page.getByRole("heading", { name: /make agents think/i })).toBeVisible();

    await page.getByLabel("Simulation objective").fill("I want to build an AI meeting assistant");
    await page.getByRole("button", { name: "Simulate", exact: true }).click();

    await expect(page.getByText("Planner task graph", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Research competitors", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Financial simulation", { exact: true }).first()).toBeVisible();
    await expect(page.locator("text=Best path").filter({ hasNot: page.locator("text=This is not a chatbot response") }).first()).toBeVisible({ timeout: 6_000 });
  });

  test("a dashboard visitor provides the required context before requesting access", async ({ page }) => {
    await page.goto("/#/dashboard");

    await expect(page.getByText("Private workspace dashboard", { exact: true })).toBeVisible();
    await expect(page.getByText("Request workspace access.", { exact: true })).toBeVisible();
    await expect(page.getByText("Planner task graph", { exact: true }).first()).toBeVisible();

    await page.getByLabel("Email address").fill("builder@example.com");
    await page.getByLabel("Name or organization").fill("Acme Labs");
    await page.getByLabel("What are you building with AI agents?").fill("A planning system for operations teams.");
    await page.getByLabel("Why does Chronos matter for it?").fill("We need to simulate consequences before dispatching work.");
    await page.locator("form").getByRole("button", { name: "Request access", exact: true }).click();

    await expect(page.getByText("Request received")).toBeVisible();
  });

  test("a visitor simulates a startup idea through to a best path", async ({ page }) => {
    await page.goto("/#/simulate");

    await page.getByLabel("Your idea").fill("I want to build an AI meeting assistant");
    await page.getByRole("button", { name: /simulate 1,000 futures/i }).click();

    await expect(page.getByText(/Simulating \d+ of 1,000 futures/)).toBeVisible();
    await expect(page.getByText(/best path/i).first()).toBeVisible({ timeout: 6_000 });
    await expect(page.getByText("18-month roadmap")).toBeVisible();
    await expect(page.getByText("Other futures that almost won.")).toBeVisible();
  });

  test("the mobile menu opens on a non-home page", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/#/core");

    await page.getByRole("button", { name: "Toggle menu" }).click();
    const mobileMenu = page.locator("header div.border-t");
    await expect(mobileMenu).toBeVisible();
    await expect(mobileMenu.getByRole("link", { name: "Core" })).toBeVisible();
  });
});