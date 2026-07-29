import { chromium, type FullConfig } from "@playwright/test";

/**
 * Warm the dev server before any test runs.
 *
 * E2E runs against `vite dev`, which transforms modules on demand. The first
 * load of the simulator route compiles a large share of the app, and whichever
 * test happens to hit it first pays that cost and blows its own timeout —
 * which is why the failure moved between tests rather than staying put.
 *
 * Paying it once here makes the variance disappear instead of chasing it with
 * per-assertion timeouts. Failures are swallowed: a warm-up that cannot reach
 * the app should let the real tests report the problem, with their own
 * diagnostics, rather than aborting the run from setup.
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://127.0.0.1:4173";
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    // The landing page pulls in the public simulator — the heaviest route, and
    // the one both intermittent failures were waiting on.
    await page.goto(baseURL, { waitUntil: "load", timeout: 60_000 });
    await page
      .getByRole("heading", { name: /make agents think/i })
      .waitFor({ state: "visible", timeout: 60_000 });
  } catch {
    // Intentionally ignored — see above.
  } finally {
    await browser.close();
  }
}

export default globalSetup;
