/**
 * Layout checks at common laptop window sizes, plus a phone. For each size the
 * test waits for live data, checks that nothing overflows sideways and that
 * every panel is on screen, then saves a full-page screenshot to
 * e2e-artifacts/ (git-ignored) for a person to look at.
 */
import path from 'node:path';
import { expect, openDashboard, panel, test } from './fixtures';

const PANELS = ['Watchlist', 'Price chart', 'Order book', 'Order ticket', 'Portfolio'];

const SIZES = [
  // dashboard.png is the main screenshot of the app.
  { width: 1440, height: 900, file: 'dashboard.png', desktop: true },
  // A 1366x768 laptop screen leaves about 1366x650 for the page inside the browser.
  { width: 1366, height: 650, file: 'dashboard-1366x650.png', desktop: true },
  { width: 390, height: 844, file: 'dashboard-phone.png', desktop: false },
];

for (const size of SIZES) {
  test(`layout at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openDashboard(page);

    // Let the chart draw a few candles, then save the screenshot first, so it
    // is there to look at even when a check below fails.
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: path.join(__dirname, '..', 'e2e-artifacts', size.file), fullPage: true });

    // No sideways scrolling at any size.
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowX).toBe(0);

    for (const name of PANELS) {
      const box = await panel(page, name).boundingBox();
      expect(box, `${name} panel has a size`).not.toBeNull();
      expect(box!.width).toBeGreaterThan(100);
      expect(box!.height).toBeGreaterThan(100);
    }

    if (size.desktop) {
      // A desktop window shows the whole terminal at once, status bar included,
      // with no page scroll: each panel scrolls on its own instead.
      const overflowY = await page.evaluate(
        () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
      );
      expect(overflowY).toBe(0);
      await expect(page.locator('footer')).toBeInViewport();
    }
  });
}
