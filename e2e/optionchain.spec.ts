/**
 * The option chain tab in the middle of the terminal, end to end: the tab
 * switch, the lazily loaded panel, the strike ladder around the live price
 * and its values following the simulated feed.
 */
import { expect, openDashboard, panel, test } from './fixtures';

/** Turns "1,450.35" into 1450.35. */
const toNumber = (text: string) => Number(text.replace(/[^\d.]/g, ''));

test('the option chain tab shows strikes around the price, marks the ATM row and updates live', async ({ page }) => {
  await openDashboard(page);
  const tabs = page.getByRole('tablist', { name: 'Chart or option chain' });
  const chartTab = tabs.getByRole('tab', { name: 'Chart' });
  const chainTab = tabs.getByRole('tab', { name: 'Option chain' });
  await expect(chartTab).toHaveAttribute('aria-selected', 'true');

  // Keyboard first: the arrow key moves focus and selection to the next tab.
  await chartTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(chainTab).toHaveAttribute('aria-selected', 'true');
  await expect(chainTab).toBeFocused();

  // The panel arrives in its own chunk, then fills in once a price is known.
  const chain = panel(page, 'Option chain');
  await expect(chain).toContainText('RELIANCE'); // the selected symbol, in the title bar
  await expect(chain.getByText('Simulated', { exact: true })).toBeVisible();
  const table = chain.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Strike' })).toBeVisible();

  // 10 strikes below the ATM strike, the ATM strike, 10 above.
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(21);

  // Exactly one row is marked at the money, and its strike is close to spot.
  const atmRow = table.getByRole('row', { name: /at the money/ });
  await expect(atmRow).toHaveCount(1);
  const atmStrike = toNumber(await atmRow.getByRole('rowheader').innerText());
  const spot = toNumber(await chain.getByText(/^Spot/).innerText());
  expect(Math.abs(atmStrike - spot) / spot).toBeLessThan(0.01);

  // The ladder reprices on every trade of the simulated feed.
  const body = table.locator('tbody');
  const before = await body.innerText();
  await expect.poll(() => body.innerText(), { timeout: 5_000 }).not.toBe(before);

  // "All Greeks" adds Gamma, Theta and Vega for both calls and puts.
  await chain.getByRole('button', { name: 'All Greeks' }).click();
  await expect(table.getByRole('columnheader', { name: 'Gamma' })).toHaveCount(2);

  // Back to the chart: it is rebuilt from the candles in the store.
  await chartTab.click();
  await expect(panel(page, 'Price chart').locator('canvas').first()).toBeVisible();
});
