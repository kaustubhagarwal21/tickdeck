/**
 * Performance measurement, not a pass/fail benchmark.
 *
 * It opens the dashboard on the simulated feed at 500 trades per second and
 * reads the three numbers in the status bar once a second for 10 seconds:
 *
 *   ticks/s in  →  store commits/s  →  FPS
 *
 * and writes every sample and the averages to e2e-artifacts/perf.json. The
 * figures in the README come from this file.
 *
 * The assertions only check the shape that the frame batcher promises: many
 * more trades than store commits, and no more commits than painted frames.
 * They hold on a slow CI machine too.
 *
 * Run it alone for clean numbers, so that no other test competes for the CPU:
 *   npx playwright test e2e/perf.spec.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, feedStatus, test } from './fixtures';

const RATE = 500; // simulated trades per second (?rate=)
const WARM_UP_MS = 2_000; // let the first one-second metrics sample arrive
const SAMPLES = 10; // one per second

interface Sample {
  ticksPerSecond: number;
  commitsPerSecond: number;
  fps: number;
}

/** Reads "500 ticks/s in → 59 store commits/s → 60 FPS" from the status bar. */
function parseStatusBar(text: string): Sample {
  // [\s\S] matches any character, line breaks included.
  const match = /(\d+) ticks\/s in[\s\S]*?(\d+) store commits\/s[\s\S]*?(\d+) FPS/.exec(text);
  if (!match) throw new Error(`Status bar text not recognised: ${text}`);
  return { ticksPerSecond: Number(match[1]), commitsPerSecond: Number(match[2]), fps: Number(match[3]) };
}

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const round1 = (value: number) => Math.round(value * 10) / 10;

test(`status-bar throughput at ?rate=${RATE}`, async ({ page, browserName }, testInfo) => {
  test.setTimeout(60_000);

  await page.goto(`/?feed=sim&rate=${RATE}`);
  await expect(feedStatus(page)).toContainText('Connected');
  await page.waitForTimeout(WARM_UP_MS);

  const footer = page.locator('footer');
  const samples: Sample[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    await page.waitForTimeout(1_000);
    samples.push(parseStatusBar(await footer.innerText()));
  }

  const result = {
    url: `/?feed=sim&rate=${RATE}`,
    browser: `${browserName} (${testInfo.project.use.channel ?? 'bundled'})`,
    viewport: page.viewportSize(),
    warmUpMs: WARM_UP_MS,
    samples,
    average: {
      ticksPerSecond: round1(average(samples.map((s) => s.ticksPerSecond))),
      commitsPerSecond: round1(average(samples.map((s) => s.commitsPerSecond))),
      fps: round1(average(samples.map((s) => s.fps))),
    },
    measuredAt: new Date().toISOString(),
  };

  const out = path.join(__dirname, '..', 'e2e-artifacts', 'perf.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  await testInfo.attach('perf.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  console.log(`perf: ${JSON.stringify(result.average)}`);

  // The batcher's promise: many trades become one store commit per frame.
  expect(result.average.ticksPerSecond).toBeGreaterThan(result.average.commitsPerSecond);
  expect(result.average.commitsPerSecond).toBeLessThanOrEqual(result.average.fps + 5);
});
