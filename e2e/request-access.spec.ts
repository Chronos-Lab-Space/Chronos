import { test, expect } from '@playwright/test';

test.describe('Request access E2E', () => {
  test('submits the request access form and shows confirmation', async ({ page }) => {
    await page.goto('/');

    const openRequestAccess = page.locator('button:has-text("Request access")').first();
    await expect(openRequestAccess).toBeVisible();
    await openRequestAccess.click();

    const dialog = page.locator('role=dialog');
    await expect(dialog).toBeVisible();
    await page.fill('input[placeholder="you@company.com"]', `playwright+${Date.now()}@example.com`);
    await page.fill('input[placeholder="Acme Labs or your name"]', 'Playwright Tester');
    await page.fill('textarea[placeholder^="Describe the workflow"]', 'Testing E2E submission');
    await page.fill('textarea[placeholder^="Tell us where simulating"]', 'Testing motivation');

    await dialog.locator('button[type="submit"]:has-text("Request access")').click();

    await expect(page.locator('text=Request received')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=We received your Chronos access request')).toBeVisible();
  });
});
