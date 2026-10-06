/**
 * Reduced motion (plan §2.10, docs/app.md §7): decorative motion stops when the device asks for
 * it (`prefers-reduced-motion: reduce`) or when a grown-up turns on "Reduce motion" for a keeper.
 * The praise is still there in words; only the movement goes.
 *
 * Measured in the page during a few right answers of the placement check: fruit flying into the
 * dragon's mouth (`.dv-flyer`) and coins flying to the purse (`.dv-flying-coin`) added to the
 * effects layer, then, on the hub, the animations still running (`document.getAnimations()`)
 * and the longest CSS animation duration.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  answerCorrectly,
  closeGrownUps,
  expectHub,
  leaveHub,
  newFamily,
  openGrownUps,
  playAs,
  quitRound,
  setSwitch,
  settingsFor,
  startPlacement,
} from './support/app';

interface Motion {
  readonly fruit: number;
  readonly flyingCoins: number;
  /** Animations still running on the hub, half a second after it appeared. */
  readonly running: string[];
  /** The longest animation duration CSS sets on the hub, in ms. */
  readonly longestCss: number;
}

async function watchEffects(page: Page): Promise<void> {
  await page.evaluate(() => {
    const counts = { fruit: 0, flyingCoins: 0 };
    (window as unknown as { __dvQaMotion: typeof counts }).__dvQaMotion = counts;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches('.dv-flyer')) counts.fruit++;
          if (node.matches('.dv-flying-coin')) counts.flyingCoins++;
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

async function measure(page: Page): Promise<Motion> {
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const counts = (window as unknown as { __dvQaMotion: { fruit: number; flyingCoins: number } })
      .__dvQaMotion;
    const running = document
      .getAnimations()
      .filter((animation) => animation.playState === 'running')
      .map((animation) => {
        const timing = animation.effect?.getComputedTiming();
        const name = animation instanceof CSSAnimation ? animation.animationName : 'script';
        return `${name} ${String(timing?.duration)}ms x${String(timing?.iterations)}`;
      });
    let longestCss = 0;
    for (const element of document.querySelectorAll('main *')) {
      const style = getComputedStyle(element);
      if (style.animationName === 'none') continue;
      for (const part of style.animationDuration.split(',')) {
        const value = part.trim();
        const ms = value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000;
        longestCss = Math.max(longestCss, ms);
      }
    }
    return { ...counts, running, longestCss };
  });
}

/** Three right answers with the effects layer watched, then back on the hub. */
async function playAndLook(page: Page, name: string): Promise<Motion> {
  await startPlacement(page);
  await watchEffects(page);
  for (let step = 0; step < 3; step++) await answerCorrectly(page, 'pointer');
  const counts = await page.evaluate(
    () =>
      (window as unknown as { __dvQaMotion: { fruit: number; flyingCoins: number } }).__dvQaMotion,
  );
  await quitRound(page, name);
  await expectHub(page, name);
  const hub = await measure(page);
  return { ...counts, running: hub.running, longestCss: hub.longestCss };
}

test.describe('without a motion preference (the control)', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('right answers send coins flying, and the dragons move', async ({ page }) => {
    await newFamily(page, { name: 'Ada' });
    const motion = await playAndLook(page, 'Ada');
    // An egg has no mouth yet: fruit flies only to hatched dragons, so only coins fly here.
    expect(motion.flyingCoins, 'coins fly to the purse').toBeGreaterThan(0);
    expect(motion.running.length, 'something is still moving on the hub').toBeGreaterThan(0);
    expect(motion.longestCss).toBeGreaterThan(100);
  });
});

test.describe('when the device asks for reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing flies and nothing keeps moving', async ({ page }) => {
    await newFamily(page, { name: 'Ben' });
    const motion = await playAndLook(page, 'Ben');
    expect(motion.fruit, 'no flying fruit').toBe(0);
    expect(motion.flyingCoins, 'no flying coins').toBe(0);
    expect(motion.running, 'no animation still running').toEqual([]);
    expect(motion.longestCss, 'CSS animations collapse to an instant').toBeLessThanOrEqual(1);
  });
});

test.describe('when a grown-up turns on "Reduce motion" for a keeper', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('nothing flies and nothing keeps moving for that keeper', async ({ page }) => {
    await newFamily(page, { name: 'Cleo' }, { name: 'Dan' });
    await leaveHub(page);
    await openGrownUps(page, 'settings');
    await settingsFor(page, 1);
    await setSwitch(page, 'setting-reduced-motion', true);
    await closeGrownUps(page);

    await playAs(page, 1, 'Cleo');
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    const motion = await playAndLook(page, 'Cleo');
    expect(motion.fruit).toBe(0);
    expect(motion.flyingCoins).toBe(0);
    expect(motion.running).toEqual([]);
    expect(motion.longestCss).toBeLessThanOrEqual(1);

    // Dan did not ask for it.
    await leaveHub(page);
    await playAs(page, 2, 'Dan');
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'false');
    const moving = await playAndLook(page, 'Dan');
    expect(moving.flyingCoins).toBeGreaterThan(0);
  });
});
