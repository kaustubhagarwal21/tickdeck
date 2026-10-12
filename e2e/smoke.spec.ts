import { expect, test } from '@playwright/test';

// Smoke test: the production build serves the dashboard page.
test('home page loads', async ({ page }) => {
  const response = await page.goto('/?feed=sim');
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/TickDeck/);
});
