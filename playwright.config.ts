import { defineConfig, devices } from '@playwright/test';
import type { Project, ReporterDescription } from '@playwright/test';
import { partFilter, selectedParts } from './test/e2e/support/parts';
import { e2ePort, outputFolder, siteFolder } from './test/e2e/support/site';

/**
 * Browser end-to-end tests (test/e2e/**). The web server builds the site with the GitHub Pages
 * base path, so every run exercises a nested deployment exactly like production.
 *
 * Engines:
 * - CI (`CI` is set by GitHub Actions) installs Playwright's Chromium, WebKit and Firefox with
 *   `npx playwright install --with-deps` and runs each engine (`--project=<engine>`) in parallel
 *   jobs, one or more parts of the suite each (`DV_E2E_PART`, test/e2e/support/parts.ts).
 * - Locally, Playwright never downloads browsers (corporate proxy). It drives the installed
 *   system browser through a channel: Microsoft Edge by default, or Chrome with
 *   `DV_BROWSER_CHANNEL=chrome`. Set `DV_E2E_ALL_ENGINES=1` to run all three engines locally
 *   if they have been installed separately.
 *
 * Every spec imports `test` from test/e2e/support/fixtures.ts, which adds the global guards
 * (docs/testing.md §5). Screens for human review are written to out/qa-screens/<project>/.
 * Timeouts are generous because WebKit on a shared runner is slow, not because anything waits:
 * every wait is for a named condition.
 */
const ci = Boolean(process.env.CI);
const port = e2ePort();
const base = '/dragon-valley/';
const channel = process.env.DV_BROWSER_CHANNEL ?? 'msedge';
const { testMatch, testIgnore } = partFilter(selectedParts());

const allEngines: Project[] = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
];
const systemBrowser: Project[] = [
  { name: `chromium-${channel}`, use: { ...devices['Desktop Chrome'], channel } },
];
// test/e2e/support/qa-reporter.ts adds a readable summary (and, with DV_E2E_AUDIT=1, an audit).
const reporters: ReporterDescription[] = ci
  ? [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]]
  : [['list']];

export default defineConfig({
  testDir: 'test/e2e',
  testMatch,
  testIgnore,
  fullyParallel: true,
  forbidOnly: ci,
  retries: 0,
  workers: ci ? 2 : undefined,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [...reporters, ['./test/e2e/support/qa-reporter.ts']],
  outputDir: outputFolder(port),
  use: {
    baseURL: `http://127.0.0.1:${port}${base}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: ci || process.env.DV_E2E_ALL_ENGINES ? allEngines : systemBrowser,
  webServer: {
    command: `node scripts/serve.mjs --build --out ${siteFolder(port).replace(/\\/g, '/')} --base ${base} --port ${port}`,
    url: `http://127.0.0.1:${port}${base}`,
    reuseExistingServer: !ci,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
