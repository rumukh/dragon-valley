/**
 * Large text and reflow (WCAG 1.4.4 Resize Text, 1.4.10 Reflow; plan §2.11 "text scales to
 * 200 % with reflow"): at 200 % nothing scrolls sideways, nothing is cut off, and every control
 * stays at least 48 px.
 *
 * - A keeper's own text size (the grown-ups' Text size 200 %) applies to everything that keeper
 *   plays: checked on the hub, through the placement check and around the valley (map, levels,
 *   a choice round, Egg Grid, the collections) at tablet, desktop and phone sizes, with
 *   screenshots for review (`text-200/`).
 * - Every screen also grows with the browser's zoom: checked at 200 % zoom of a tablet and a
 *   desktop window (half as many CSS pixels), keeper screens and grown-up screens alike.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  chooseSetting,
  closeGrownUps,
  expectHub,
  leaveHub,
  newFamily,
  openGrownUps,
  playAs,
} from './support/app';
import { unlessKnown } from './support/known-issues';
import { checkStop, writeContactSheet, ZOOMED } from './support/screens';
import { installSpeech, TYPICAL_VOICES } from './support/speech';
import { grownUpWalk, placesWalk, roundWalk, welcomeWalk } from './support/tour';
import type { Stop } from './support/tour';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ context }) => {
  await installSpeech(context, TYPICAL_VOICES);
});

function readingSize(page: Page): Promise<number> {
  return page.locator('html').evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
}

/** The root's size and the hub greeting's, as drawn now. */
function hubSizes(page: Page): Promise<{ root: number; greeting: number }> {
  return page.evaluate(() => {
    const greeting = document.querySelector('[data-testid="hub-greeting"]');
    return {
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      greeting: greeting ? parseFloat(getComputedStyle(greeting).fontSize) : Number.NaN,
    };
  });
}

test("a keeper's text at 200 %: the hub and a whole round reflow at every size", async ({
  page,
}, testInfo) => {
  test.setTimeout(600_000);
  await newFamily(page, { name: 'Ada' });
  const normal = await hubSizes(page);
  expect(normal.root, 'the reading size is 24 px at 100 %').toBe(24);
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await chooseSetting(page, 'setting-text-200');
  await closeGrownUps(page);
  await playAs(page, 1, 'Ada');
  // Read at once, as the hub appears: the text must not show at 100 % first.
  const opened = await hubSizes(page);
  const doubled = (sizes: { root: number; greeting: number }): boolean =>
    sizes.root === normal.root * 2 && Math.abs(sizes.greeting - normal.greeting * 2) < 0.5;
  await unlessKnown(testInfo, 'DV-QA-13', async () => {
    expect(opened.root, "the hub appears at the keeper's 200 %: a 48 px root").toBe(48);
    expect(opened.greeting, 'and the greeting twice its size at 100 %').toBeCloseTo(
      normal.greeting * 2,
      0,
    );
  });
  if (!doubled(opened)) {
    const started = Date.now();
    await expect
      .poll(async () => doubled(await hubSizes(page)), {
        message: 'the hub reaches 200 %',
        timeout: 5_000,
        intervals: [25],
      })
      .toBe(true);
    testInfo.annotations.push({
      type: 'DV-QA-13 evidence',
      description: `as the hub appeared: root ${opened.root} px, greeting ${opened.greeting} px (at 100 %: ${normal.root} and ${normal.greeting}); 200 % about ${Date.now() - started} ms later`,
    });
  }
  expect(await readingSize(page), 'the reading size doubled to 48 px').toBe(48);

  const stops: Stop[] = [];
  const visit = async (stop: Stop): Promise<void> => {
    stops.push(stop);
    await checkStop(page, testInfo, stop, {
      screenshots: true,
      axe: false,
      layout: true,
      set: 'text-200',
    });
  };
  await visit({ name: '06-hub', description: "Ada's hub at 200 % text" });
  await roundWalk(page, visit);
  await placesWalk(page, visit, 'Ada');
  await expectHub(page, 'Ada');
  writeContactSheet(testInfo, 'text-200', stops, { set: 'text-200' });
});

test('every screen at 200 % browser zoom', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const visit = async (stop: Stop): Promise<void> => {
    await checkStop(page, testInfo, stop, {
      screenshots: false,
      axe: false,
      layout: true,
      viewports: ZOOMED,
    });
  };
  await welcomeWalk(page, visit);
  await roundWalk(page, visit);
  await placesWalk(page, visit, 'Ada');
  await grownUpWalk(page, visit);
});
