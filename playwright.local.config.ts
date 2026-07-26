// E2E against a pre-provisioned Chromium instead of a downloaded browser
// build. For sandboxed/remote environments (e.g. Claude Code on the web)
// where /opt/pw-browsers/chromium exists and playwright's own download is
// unavailable. Opt-in: npx playwright test --config=playwright.local.config.ts
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  use: {
    ...base.use,
    launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
  },
});
