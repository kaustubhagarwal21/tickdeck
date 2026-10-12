/**
 * End-to-end tests of the main user journeys, run against the production build
 * in a real browser. Every test uses ?feed=sim, so prices come from the
 * simulated feed in the browser and the tests never depend on the network.
 *
 * The automatic fixture in fixtures.ts also fails any test that logs a
 * console error.
 */
import { expect, feedStatus, openDashboard, panel, test, watchlist, watchlistRow } from './fixtures';

test('the dashboard loads and the feed status becomes open', async ({ page }) => {
  await page.goto('/?feed=sim');

  await expect(page.getByRole('heading', { level: 1, name: 'TickDeck' })).toBeVisible();
  await expect(feedStatus(page)).toContainText('Connected');
  for (const name of ['Watchlist', 'Price chart', 'Order book', 'Order ticket', 'Portfolio']) {
    await expect(panel(page, name)).toBeVisible();
  }
  // The simulated market runs in a Web Worker, off the main thread.
  await expect.poll(() => page.workers().length).toBeGreaterThan(0);
});

test('watchlist prices change within 3 seconds', async ({ page }) => {
  await openDashboard(page);

  const rows = watchlist(page).getByRole('option');
  const before = await rows.allInnerTexts();
  await expect.poll(() => rows.allInnerTexts(), { timeout: 3_000 }).not.toEqual(before);
});

test('selecting a symbol updates the chart header', async ({ page }) => {
  await openDashboard(page);
  const chart = panel(page, 'Price chart');

  // The first symbol is selected at start.
  await expect(chart.getByRole('img', { name: /^RELIANCE candlestick chart/ })).toBeVisible();

  await watchlistRow(page, 'TCS').click();

  await expect(watchlistRow(page, 'TCS')).toHaveAttribute('aria-selected', 'true');
  await expect(chart.getByText('TCS', { exact: true })).toBeVisible();
  await expect(chart.getByRole('img', { name: /^TCS candlestick chart/ })).toBeVisible();
  // The order ticket follows the selection too.
  await expect(panel(page, 'Order ticket').getByRole('button', { name: 'Buy TCS' })).toBeVisible();
});

test('a LIMIT BUY above the last price fills and appears in Positions', async ({ page }) => {
  await openDashboard(page);
  const ticket = panel(page, 'Order ticket');

  await ticket.getByText('Limit', { exact: true }).click();
  const limitPrice = ticket.getByLabel('Limit price');
  // Switching to Limit pre-fills the price box with the last trade price.
  await expect(limitPrice).not.toHaveValue('');
  const last = Number(await limitPrice.inputValue());

  // A buy limit fills at the first trade at or below its price, so a limit 1%
  // above the market fills on the next RELIANCE trade.
  await limitPrice.fill((last * 1.01).toFixed(2));
  await ticket.getByLabel('Quantity').fill('5');
  await ticket.getByRole('button', { name: 'Buy RELIANCE' }).click();
  await expect(ticket.getByRole('status')).toContainText('Order placed');

  const portfolio = panel(page, 'Portfolio');
  await expect(portfolio.getByRole('tab', { name: /Positions/ })).toContainText('1');
  const position = portfolio.getByRole('row', { name: /RELIANCE/ });
  await expect(position).toContainText('Long');
  await expect(position.getByRole('cell').first()).toHaveText('5'); // the Qty column

  // The Orders tab shows the order as filled, and no order is left working.
  await portfolio.getByRole('tab', { name: /Orders/ }).click();
  await expect(portfolio.getByRole('tab', { name: /Orders/ })).toContainText('0');
  await expect(portfolio.getByRole('tabpanel')).toContainText(/filled/i);
});

test('an invalid quantity shows a validation error', async ({ page }) => {
  await openDashboard(page);
  const ticket = panel(page, 'Order ticket');

  await ticket.getByLabel('Quantity').fill('0');
  await ticket.getByRole('button', { name: 'Buy RELIANCE' }).click();
  await expect(ticket.getByRole('alert')).toHaveText('Quantity must be a whole number greater than 0.');

  // The message follows every edit after that first submit.
  await ticket.getByLabel('Quantity').fill('2.5');
  await expect(ticket.getByRole('alert')).toHaveText('Quantity must be a whole number greater than 0.');
  await ticket.getByLabel('Quantity').fill('3');
  await expect(ticket.getByRole('alert')).toHaveCount(0);

  // Nothing was placed while the quantity was invalid.
  await expect(ticket.getByRole('status')).toHaveText('');
  await expect(panel(page, 'Portfolio').getByRole('tab', { name: /Positions/ })).toContainText('0');
});

test('the watchlist works with the keyboard', async ({ page }) => {
  await openDashboard(page);
  const list = watchlist(page);

  // Tab from the top of the page into the list, as a keyboard user would.
  for (let i = 0; i < 10; i++) {
    if (await list.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(list).toBeFocused();

  // An arrow key moves the highlight but does not select yet.
  await page.keyboard.press('ArrowDown');
  await expect(watchlistRow(page, 'TCS')).toHaveAttribute('data-active', 'true');
  await expect(watchlistRow(page, 'RELIANCE')).toHaveAttribute('aria-selected', 'true');

  // Enter selects the highlighted row, and the chart follows.
  await page.keyboard.press('Enter');
  await expect(watchlistRow(page, 'TCS')).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page, 'Price chart').getByRole('img', { name: /^TCS candlestick chart/ })).toBeVisible();

  // End jumps to the last row; Space selects it.
  await page.keyboard.press('End');
  await page.keyboard.press(' ');
  await expect(watchlistRow(page, 'SBIN')).toHaveAttribute('aria-selected', 'true');

  // Home goes back to the first row.
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(watchlistRow(page, 'RELIANCE')).toHaveAttribute('aria-selected', 'true');
  await expect(list).toBeFocused();
});

test('runs with no console errors while streaming and switching views', async ({ page }) => {
  // The fixture fails this test on any console or page error. The test only
  // has to use the page for a while: stream, switch symbol and interval.
  await openDashboard(page);
  await watchlistRow(page, 'INFY').click();
  const intervals = panel(page, 'Price chart').getByRole('radiogroup', { name: 'Candle interval' });
  await intervals.getByRole('radio', { name: '1m' }).click();
  await expect(intervals.getByRole('radio', { name: '1m' })).toHaveAttribute('aria-checked', 'true');
  await intervals.getByRole('radio', { name: '5s' }).click();
  await page.waitForTimeout(3_000);
  await expect(feedStatus(page)).toContainText('Connected');
});
