/**
 * Offline play (docs/app.md §12, plan §3.5): a grown-up installs the game for offline play;
 * after that, with the network gone, the game opens from the device, a keeper plays and every
 * answer is still saved.
 *
 * "The network gone" is real here, not emulated: the test serves the built site from its own
 * private server, installs, then shuts that server down. Every later request either comes from
 * the offline worker or fails, and the guard fails the test on any failed request. (Emulated
 * offline mode is also checked where the engine supports it with a service worker: WebKit's
 * emulation stops navigations before the worker sees them, which a real device does not.)
 */
import type { Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { expect, test } from './support/fixtures';
import {
  answerCorrectly,
  closeGrownUps,
  coinCount,
  createFirstKeeper,
  expectCoins,
  expectSaved,
  expectScreen,
  finishRound,
  leaveHub,
  leaveResults,
  newFamily,
  openGrownUps,
  playAs,
  playFromTitle,
  startPlacement,
  waitReady,
} from './support/app';
// The project's own static server (scripts/serve.mjs), serving the build the web server made.
import { serveDirectory } from '../../scripts/serve.mjs';
import { siteFolder } from './support/site';

const status = (page: Page) => page.getByTestId('offline-status');

async function controlled(page: Page): Promise<boolean> {
  return page.evaluate(() => navigator.serviceWorker?.controller !== null);
}

async function install(page: Page): Promise<string[]> {
  await openGrownUps(page, 'offline');
  await expect(status(page)).toHaveAttribute('data-state', 'missing');
  await expect(status(page)).toHaveText('Not installed for offline play yet.');
  await status(page).evaluate((node) => {
    const seen: string[] = [];
    (window as unknown as { __dvQaOffline: string[] }).__dvQaOffline = seen;
    new MutationObserver(() => seen.push(node.textContent ?? '')).observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await page.getByTestId('offline-install').click();
  await expect(status(page)).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
  await expect(status(page)).toHaveText('Installed. Dragon Valley works offline on this device.');
  await expect(page.getByTestId('offline-install'), 'nothing left to install').toBeHidden();
  const progress = await page.evaluate(
    () => (window as unknown as { __dvQaOffline: string[] }).__dvQaOffline,
  );
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  return progress;
}

test('installed for offline play, the game opens and saves after the server is gone', async ({
  page,
  guard,
}, testInfo) => {
  test.setTimeout(180_000);
  const root = testInfo.config.configFile ? dirname(testInfo.config.configFile) : process.cwd();
  const site = join(root, siteFolder());
  const server = await serveDirectory({ directory: () => site });
  const url = server.url('/dragon-valley/');
  guard.addOrigin(new URL(url).origin);
  let running = true;
  try {
    await page.goto(url);
    await waitReady(page);
    await createFirstKeeper(page, { name: 'Ada' });
    await leaveHub(page);
    const progress = await install(page);
    expect(
      progress.some((text) => /^Downloading \d+ of \d+ files…$/.test(text)),
      `progress was shown: ${JSON.stringify([...new Set(progress)])}`,
    ).toBe(true);
    await page.getByTestId('offline-update').click();
    await expect(status(page), 'checking finds this very version').toHaveText(
      'This is the newest version.',
    );
    await closeGrownUps(page);

    await server.close();
    running = false;
    await page.goto(url);
    await waitReady(page);
    expect(await controlled(page), 'the offline worker serves the page').toBe(true);
    await expectScreen(page, 'title');
    await playFromTitle(page);
    await playAs(page, 1, 'Ada');
    await startPlacement(page);
    await answerCorrectly(page, 'keyboard');
    await expectSaved(page);
    await finishRound(page, 'keyboard');
    await expectSaved(page);
    await leaveResults(page, 'Ada');
    const coins = await coinCount(page);
    expect(coins, 'coins earned offline').toBeGreaterThan(0);

    // A second cold start, still without a server, keeps the progress.
    await page.goto(url);
    await waitReady(page);
    await playFromTitle(page);
    await playAs(page, 1, 'Ada');
    await expectCoins(page, coins);
  } finally {
    if (running) await server.close();
  }
});

test('installed, the game also opens in the browser offline mode', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    "WebKit's emulated offline mode fails navigations before the service worker sees them (a real device does not); the test above covers WebKit with the server gone",
  );
  test.setTimeout(120_000);
  await newFamily(page, { name: 'Ben' });
  await leaveHub(page);
  await install(page);
  await closeGrownUps(page);
  await context.setOffline(true);
  try {
    await page.reload();
    await waitReady(page);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    expect(await controlled(page)).toBe(true);
    await playFromTitle(page);
    await playAs(page, 1, 'Ben');
    await startPlacement(page);
    await answerCorrectly(page, 'pointer');
    await expectSaved(page);
  } finally {
    await context.setOffline(false);
  }
});

test('a browser that cannot install says so, and the game still works online', async ({
  page,
  context,
}) => {
  // Without service workers there is nothing to install with.
  await context.addInitScript(() => {
    delete (Navigator.prototype as unknown as { serviceWorker?: unknown }).serviceWorker;
  });
  await newFamily(page, { name: 'Cleo' });
  await leaveHub(page);
  await openGrownUps(page, 'offline');
  await expect(status(page)).toHaveAttribute('data-state', 'unavailable');
  await expect(status(page)).toHaveText(
    'This browser cannot install Dragon Valley for offline play. A recent browser on a secure web page can.',
  );
  await expect(page.getByTestId('offline-install')).toHaveCount(0);
});
