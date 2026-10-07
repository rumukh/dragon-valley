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

interface InSight {
  readonly root: number;
  readonly greeting: number;
  /** Frames the hub was on the stage but out of sight (the stage kept transparent, #49). */
  readonly hiddenFrames: number;
}

/**
 * From now on, watch every animation frame for the hub's greeting coming into sight (its own and
 * its ancestors' opacity at least 0.5: the stage may keep a new screen transparent until it is
 * drawn at the keeper's text size), and keep the sizes drawn at that first frame. What a child
 * sees first, not merely what is in the page.
 */
async function watchHubComingIntoSight(page: Page): Promise<() => Promise<InSight | null>> {
  await page.evaluate(() => {
    const scope = window as unknown as { __dvQaHubInSight?: InSight | null };
    scope.__dvQaHubInSight = null;
    let hiddenFrames = 0;
    const frame = (): void => {
      const greeting = document.querySelector('[data-testid="hub-greeting"]');
      if (greeting) {
        let opacity = 1;
        for (let node: Element | null = greeting; node; node = node.parentElement) {
          opacity *= Number(getComputedStyle(node).opacity);
        }
        if (opacity >= 0.5) {
          scope.__dvQaHubInSight = {
            root: parseFloat(getComputedStyle(document.documentElement).fontSize),
            greeting: parseFloat(getComputedStyle(greeting).fontSize),
            hiddenFrames,
          };
          return;
        }
        hiddenFrames += 1;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { __dvQaHubInSight?: InSight | null }).__dvQaHubInSight ?? null,
    );
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
  const inSight = await watchHubComingIntoSight(page);
  await playAs(page, 1, 'Ada');
  // The sizes at the first frame the hub was in sight: the text must not show at 100 % first.
  await expect.poll(inSight, { message: 'the hub comes into sight' }).not.toBeNull();
  const opened = (await inSight())!;
  const doubled = (sizes: { root: number; greeting: number }): boolean =>
    sizes.root === normal.root * 2 && Math.abs(sizes.greeting - normal.greeting * 2) < 0.5;
  // DV-QA-13, fixed: WebKit drew the hub's first frame at 100 % (the stage now goes transparent,
  // its style flushed, before the hub is inserted).
  expect(opened.root, "the hub comes into sight at the keeper's 200 %: a 48 px root").toBe(48);
  expect(opened.greeting, 'and the greeting twice its size at 100 %').toBeCloseTo(
    normal.greeting * 2,
    0,
  );
  testInfo.annotations.push({
    type: 'DV-QA-13 evidence',
    description: `as the hub came into sight: root ${opened.root} px, greeting ${opened.greeting} px (at 100 %: ${normal.root} and ${normal.greeting}), after ${opened.hiddenFrames} frames kept out of sight`,
  });
  if (!doubled(opened)) {
    await expect
      .poll(async () => doubled(await hubSizes(page)), {
        message: 'the hub reaches 200 %',
        timeout: 5_000,
        intervals: [25],
      })
      .toBe(true);
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
