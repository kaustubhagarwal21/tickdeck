/**
 * The /design style guide in a real browser. The automatic fixture in
 * fixtures.ts fails the test on any console error or page error.
 */
import { expect, test } from './fixtures';

test('the /design style guide loads with no console errors', async ({ page }) => {
  const response = await page.goto('/design');
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Design system/);
  await expect(page.getByRole('heading', { level: 1, name: 'TickDeck design system' })).toBeVisible();

  // Token values are read from the CSS variables after hydration; the
  // prerendered HTML shows "…" in their place until then.
  const colours = page.locator('#colours');
  await expect(colours.getByText('…', { exact: true })).toHaveCount(0);
  await expect(colours.getByText('#020617', { exact: true })).toBeVisible(); // --color-ink

  // The gallery's Tabs example works with the keyboard.
  const tablist = page.locator('#tabs').getByRole('tablist').first();
  const firstTab = tablist.getByRole('tab').first();
  await firstTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(tablist.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
});
