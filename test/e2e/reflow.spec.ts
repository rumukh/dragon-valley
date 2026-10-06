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
import type { Page, TestInfo } from '@playwright/test';
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

async function expectReadingSize(page: Page, pixels: number): Promise<void> {
  await expect
    .poll(() => readingSize(page), {
      message: `the reading size is ${pixels} px`,
      timeout: 5_000,
    })
    .toBe(pixels);
}

/**
 * DV-QA-13 (WebKit): the hub showed while <html> already carried the keeper's text scale but
 * still had the old font size. Record what the page says and how long the size takes to catch
 * up by itself, frame by frame; if it does not within five seconds, record whether a passing
 * attribute (which the game never reads) restyles <html>, so the rest of the test still checks
 * the screens at 200 %.
 */
async function staleRootEvidence(page: Page, testInfo: TestInfo, opened: number): Promise<void> {
  const seen = await page.evaluate(async (deadline) => {
    const root = document.documentElement;
    const size = (): string => getComputedStyle(root).fontSize;
    const frame = (): Promise<void> =>
      new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
        setTimeout(resolve, 50);
      });
    const greeting = document.querySelector('[data-testid="hub-greeting"]');
    const evidence: Record<string, string> = {
      userAgent: navigator.userAgent,
      inlineTextScale: root.style.getPropertyValue('--aegis-text-scale'),
      computedTextScale: getComputedStyle(root).getPropertyValue('--aegis-text-scale').trim(),
      rootFontSize: size(),
      greetingFontSize: greeting ? getComputedStyle(greeting).fontSize : 'no greeting',
    };
    const started = performance.now();
    let frames = 0;
    while (size() !== '48px' && performance.now() - started < deadline) {
      await frame();
      frames += 1;
    }
    const waited = Math.round(performance.now() - started);
    evidence['caughtUp'] =
      size() === '48px' ? `after ${waited} ms (${frames} frames)` : `not within ${waited} ms`;
    if (size() !== '48px') {
      root.setAttribute('data-qa-restyle', '');
      evidence['afterAnAttributeChange'] = size();
      root.removeAttribute('data-qa-restyle');
    }
    return evidence;
  }, 5_000);
  const evidence = { openedAt: `${opened}px`, ...seen };
  await testInfo.attach('DV-QA-13 evidence', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  });
  testInfo.annotations.push({ type: 'DV-QA-13 evidence', description: JSON.stringify(evidence) });
}

test("a keeper's text at 200 %: the hub and a whole round reflow at every size", async ({
  page,
}, testInfo) => {
  test.setTimeout(600_000);
  await newFamily(page, { name: 'Ada' });
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await chooseSetting(page, 'setting-text-200');
  await closeGrownUps(page);
  await playAs(page, 1, 'Ada');
  const opened = await readingSize(page);
  await unlessKnown(testInfo, 'DV-QA-13', async () => {
    expect(opened, "the hub opens at the keeper's 200 % (a 48 px root)").toBe(48);
  });
  if (opened !== 48) {
    await staleRootEvidence(page, testInfo, opened);
    await expectReadingSize(page, 48);
  }

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
