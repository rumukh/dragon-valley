/**
 * Smoke test on every engine: the built site (served at the nested Pages base) boots, renders
 * the shell, logs no console errors and makes no request to any other origin.
 *
 * Owned by S6 (QA) from here on; extend rather than loosen it.
 */
import { expect, test } from './support/fixtures';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The content pack's revision, which the build packs: it moves with every content bump. */
const CONTENT_REVISION = (
  JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'content',
        'dragon-valley.content.json',
      ),
      'utf8',
    ),
  ) as { revision: string }
).revision;

interface Observations {
  consoleErrors: string[];
  pageErrors: string[];
  foreignRequests: string[];
  failedRequests: string[];
}

function observe(page: Page, origin: string): Observations {
  const seen: Observations = {
    consoleErrors: [],
    pageErrors: [],
    foreignRequests: [],
    failedRequests: [],
  };
  page.on('console', (message) => {
    if (message.type() === 'error') seen.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => seen.pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.origin !== origin) {
      seen.foreignRequests.push(request.url());
    }
  });
  page.on('requestfailed', (request) =>
    seen.failedRequests.push(`${request.url()} (${request.failure()?.errorText ?? 'failed'})`),
  );
  page.on('response', (response) => {
    if (response.status() >= 400)
      seen.failedRequests.push(`${response.url()} (${response.status()})`);
  });
  return seen;
}

test('the game boots at the Pages base with no errors and only same-origin requests', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const seen = observe(page, origin);

  await page.goto('./');
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-state', 'ready');
  // The shell opens on its title screen once the content pack was loaded and validated in this
  // browser (the rules run when a keeper plays; test/e2e/profiles.spec.ts covers that).
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-screen', 'title');
  expect(CONTENT_REVISION, 'the pack names its revision').toMatch(/^\d+\.\d+\.\d+$/);
  await expect(page.getByTestId('boot-status')).toHaveAttribute(
    'data-content-revision',
    CONTENT_REVISION,
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dragon Valley');
  await expect(page.locator('#app')).not.toHaveAttribute('aria-busy', 'true');
  await page.waitForLoadState('networkidle');

  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.consoleErrors, 'console errors').toEqual([]);
  expect(seen.foreignRequests, 'requests to another origin').toEqual([]);
  expect(seen.failedRequests, 'failed or 4xx/5xx requests').toEqual([]);
});

test('the shell declares a same-origin Content Security Policy', async ({ page }) => {
  await page.goto('./');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("connect-src 'self'");
  expect(policy).toContain("object-src 'none'");
});
