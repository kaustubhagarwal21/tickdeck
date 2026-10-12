/**
 * Core Web Vitals of the dashboard, measured in a real browser against the
 * production build (the webServer in playwright.config.ts).
 *
 * Like perf.spec.ts, this is a measurement first: it opens /?feed=sim, reads
 * LCP, CLS and FCP from the browser's own performance entries plus the
 * navigation timing, and writes them to e2e-artifacts/vitals.json. The
 * budgets it asserts are loose (Google's "poor" thresholds for the timings,
 * and the "good" one for CLS) so that a slow CI machine does not fail it.
 * No CPU or network throttling is applied, so the numbers are for this
 * machine on localhost, not for a phone on a mobile network.
 *
 * Run it alone for clean numbers, so that no other test competes for the CPU:
 *   npx playwright test e2e/vitals.spec.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, openDashboard, panel, test } from './fixtures';

/** Loose budgets: LCP and FCP must not be "poor", CLS must be "good". */
const BUDGET = { lcpMs: 4_000, fcpMs: 3_000, cls: 0.1 };

/** Time for late paints and layout shifts (fonts, the chart's chunk) to happen before reading. */
const SETTLE_MS = 2_000;

/** What readLabVitals() returns from the page. */
interface LabVitals {
  /** Largest Contentful Paint: when the biggest text block or image was drawn. */
  lcpMs: number | null;
  /** The element that was the LCP, e.g. "p: Simulated data: NSE-style…". */
  lcpElement: string | null;
  /** First Contentful Paint: when the first text or image was drawn. */
  fcpMs: number | null;
  /** Total of every layout shift not caused by input (see readLabVitals). */
  cls: number;
  /** Time to First Byte, from navigation timing: when the HTML started to arrive. */
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
}

/**
 * Runs inside the page (Playwright sends the function's source to the
 * browser), so it may only use browser APIs, not anything else in this file.
 */
function readLabVitals(): LabVitals {
  // A PerformanceObserver with `buffered: true` also receives the entries
  // recorded before it existed. observe() puts those buffered entries in the
  // observer's queue straight away, and takeRecords() empties that queue, so
  // this reads them synchronously without waiting for the callback.
  const entriesOf = (type: string): PerformanceEntry[] => {
    const observer = new PerformanceObserver(() => {});
    observer.observe({ type, buffered: true });
    const entries = observer.takeRecords();
    observer.disconnect();
    return entries;
  };

  // Each LCP entry is a new, larger candidate; the last one is the LCP so far.
  const lcp = entriesOf('largest-contentful-paint').at(-1) as LargestContentfulPaint | undefined;
  const fcp = entriesOf('paint').find((entry) => entry.name === 'first-contentful-paint');

  // `LayoutShift` is not in TypeScript's DOM types yet, so describe the two fields we read.
  const shifts = entriesOf('layout-shift') as unknown as { value: number; hadRecentInput: boolean }[];
  // Shifts right after a click or key press are expected, so CLS leaves them out.
  // The official CLS is the worst burst of shifts (a "session window"); that can
  // never be more than the total of all of them, so checking the total is stricter.
  const cls = shifts.filter((shift) => !shift.hadRecentInput).reduce((sum, shift) => sum + shift.value, 0);

  const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  const element = lcp?.element;

  return {
    lcpMs: lcp ? lcp.startTime : null,
    lcpElement: element
      ? `${element.tagName.toLowerCase()}: ${(element.textContent ?? '').trim().slice(0, 40)}`
      : null,
    fcpMs: fcp ? fcp.startTime : null,
    cls,
    ttfbMs: navigation.responseStart,
    domContentLoadedMs: navigation.domContentLoadedEventEnd,
    loadMs: navigation.loadEventEnd,
  };
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const roundMs = (value: number | null) => (value === null ? null : round(value, 1));

test('Core Web Vitals stay within loose budgets', async ({ page, browserName }, testInfo) => {
  await openDashboard(page); // /?feed=sim, connected, first prices on screen
  // The chart arrives in its own chunk (LazyPriceChart); wait until it has drawn.
  await expect(panel(page, 'Price chart').locator('canvas').first()).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);

  const lab = await page.evaluate(readLabVitals);
  // What the app's own <WebVitals /> reporter has collected so far, if it is mounted.
  const reportedByApp = await page.evaluate(() => window.__vitals ?? null);

  const result = {
    url: '/?feed=sim',
    browser: `${browserName} (${testInfo.project.use.channel ?? 'bundled'})`,
    viewport: page.viewportSize(),
    throttling: 'none',
    settleMs: SETTLE_MS,
    lcpMs: roundMs(lab.lcpMs),
    lcpElement: lab.lcpElement,
    fcpMs: roundMs(lab.fcpMs),
    cls: round(lab.cls, 4),
    ttfbMs: round(lab.ttfbMs, 1),
    domContentLoadedMs: round(lab.domContentLoadedMs, 1),
    loadMs: round(lab.loadMs, 1),
    reportedByApp,
    budget: BUDGET,
    measuredAt: new Date().toISOString(),
  };

  const out = path.join(__dirname, '..', 'e2e-artifacts', 'vitals.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  await testInfo.attach('vitals.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  console.log(`vitals: LCP ${result.lcpMs} ms, FCP ${result.fcpMs} ms, CLS ${result.cls}, TTFB ${result.ttfbMs} ms`);

  const { fcpMs, lcpMs, cls } = lab;
  if (fcpMs === null || lcpMs === null) throw new Error('The browser recorded no FCP or no LCP entry');
  expect(fcpMs).toBeLessThan(BUDGET.fcpMs);
  expect(lcpMs).toBeLessThan(BUDGET.lcpMs);
  // The largest paint can only come at or after the first one.
  expect(lcpMs).toBeGreaterThanOrEqual(fcpMs);
  expect(cls).toBeLessThan(BUDGET.cls);
});

test('the app reports its own web vitals on window.__vitals', async ({ page }) => {
  await openDashboard(page);

  // FCP and TTFB are reported as soon as the browser has them.
  await page.waitForFunction(() => window.__vitals?.FCP && window.__vitals?.TTFB);

  // LCP is only final, and reported, once the visitor first interacts. Shift
  // on its own does nothing in the app, but it counts as that first input.
  await page.keyboard.press('Shift');
  await page.waitForFunction(() => window.__vitals?.LCP);

  const reported = await page.evaluate(() => window.__vitals);
  for (const name of ['FCP', 'TTFB', 'LCP'] as const) {
    expect(reported?.[name]?.value, `${name} value`).toBeGreaterThan(0);
    expect(['good', 'needs-improvement', 'poor']).toContain(reported?.[name]?.rating);
  }
});
