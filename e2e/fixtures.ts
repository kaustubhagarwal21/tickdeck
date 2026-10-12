/**
 * Shared setup for the Playwright tests.
 *
 * `test` here is Playwright's own test function with one extra, automatic
 * fixture: it records every console error and uncaught page error while a test
 * runs, and fails the test if there were any. So "no console errors" is
 * checked on every page the tests visit, not only in one dedicated test.
 *
 * The helpers find elements the way a user (or a screen reader) would: by
 * role and accessible name, not by CSS classes that may change.
 */
import { test as base, expect, type Locator, type Page } from '@playwright/test';

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));

      await use(errors); // the test runs here

      expect(errors, 'console errors during the test').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** The header's connection pill. Its text reads "Market feed: Connected" once the feed is open. */
export function feedStatus(page: Page): Locator {
  return page.getByRole('status').filter({ hasText: 'Market feed' });
}

/** The watchlist (a WAI-ARIA listbox). */
export function watchlist(page: Page): Locator {
  return page.getByRole('listbox', { name: 'Watchlist' });
}

/** One watchlist row. Its accessible name starts with the symbol, e.g. "TCS 3,101.05 NSE +0.03%". */
export function watchlistRow(page: Page, symbol: string): Locator {
  return watchlist(page).getByRole('option', { name: new RegExp(`^${symbol}\\b`) });
}

/** A panel, found by its heading, e.g. "Order ticket". */
export function panel(page: Page, name: string): Locator {
  return page.getByRole('region', { name });
}

/**
 * Opens the dashboard on the simulated feed (never the network) and waits
 * until the feed is open and the first prices are on screen.
 */
export async function openDashboard(page: Page, query = '?feed=sim'): Promise<void> {
  await page.goto(`/${query}`);
  await expect(feedStatus(page)).toContainText('Connected');
  // Before its first trade a row shows a skeleton; afterwards it shows digits.
  await expect(watchlist(page).getByRole('option').first()).toContainText(/\d/);
}
