import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Fail the CI run if someone leaves a test.only in the code.
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Locally, drive the Microsoft Edge that ships with Windows, so no browser
        // download is needed. CI installs Playwright's own Chromium instead.
        channel: isCI ? undefined : 'msedge',
      },
    },
  ],
  // Test the production build (what users get), served on its own port so it
  // does not clash with a dev server on 3000. The CI workflow runs
  // `npm run build` as its own step just before, so CI only starts the server.
  webServer: {
    command: isCI ? `npm run start -- -p ${PORT}` : `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
