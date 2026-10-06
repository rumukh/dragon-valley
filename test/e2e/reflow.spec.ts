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
 * DV-QA-13 (WebKit): <html> carries the keeper's text scale but keeps the old font size. Attach
 * what the page says, then restyle <html> with a passing attribute (which the game never reads)
 * so the rest of the test still checks the screens at 200 %.
 */
async function restyleStaleRoot(page: Page, testInfo: TestInfo): Promise<void> {
  const seen = await page.evaluate(async () => {
    const root = document.documentElement;
    const size = (): string => getComputedStyle(root).fontSize;
    const frame = (): Promise<void> =>
      new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const greeting = document.querySelector('[data-testid="hub-greeting"]');
    const evidence: Record<string, string> = {
      userAgent: navigator.userAgent,
      inlineTextScale: root.style.getPropertyValue('--aegis-text-scale'),
      computedTextScale: getComputedStyle(root).getPropertyValue('--aegis-text-scale').trim(),
      computedReading: getComputedStyle(root).getPropertyValue('--dv-reading').trim(),
      rootFontSize: size(),
      greetingFontSize: greeting ? getComputedStyle(greeting).fontSize : 'no greeting',
    };
    await frame();
    await frame();
    evidence['afterTwoFrames'] = size();
    root.style.setProperty('--aegis-text-scale', evidence['inlineTextScale'] ?? '');
    evidence['afterSettingTheSameScale'] = size();
    root.setAttribute('data-qa-restyle', '');
    evidence['afterAnAttributeChange'] = size();
    root.removeAttribute('data-qa-restyle');
    evidence['afterRemovingIt'] = size();
    return evidence;
  });
  await testInfo.attach('DV-QA-13 evidence', {
    body: JSON.stringify(seen, null, 2),
    contentType: 'application/json',
  });
  testInfo.annotations.push({ type: 'DV-QA-13 evidence', description: JSON.stringify(seen) });
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
  await unlessKnown(testInfo, 'DV-QA-13', () => expectReadingSize(page, 48));
  if ((await readingSize(page)) !== 48) {
    await restyleStaleRoot(page, testInfo);
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
