/**
 * A hidden page pauses the game (plan §2.11, docs/app.md §5): while the child has switched away
 * (another app, a sleeping tablet), the time does not count against an answer's speed, the
 * Lightning Arena's clock stands still, and read-aloud stops talking. The page is hidden the way a
 * browser reports it: `document.visibilityState` and a `visibilitychange` event.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  awaitOpenProblem,
  expectNextProblem,
  feedbackAfter,
  giveAnswer,
  keeperWithRegions,
  leaveHub,
  loadBackup,
  newFamily,
  playAs,
  results,
  startLevel,
  startPlacement,
  throughHatches,
} from './support/app';
import { readAnswer } from './support/problem';
import { meadowWonBackup } from './support/saves';
import { installSpeech, speechLog, TYPICAL_VOICES } from './support/speech';

test.use({ reducedMotion: 'reduce' });

/** Hide or show the page, as a browser does when the child switches away and back. */
async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (value ? 'hidden' : 'visible'),
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

/** A choice answer counts as quick under 2.5 s (data.balance.response.choice.fastMs). */
const WAIT_MS = 3_500;

/** Play the round to its results, waiting before each answer: in view, or with the page hidden. */
async function playWithWaits(page: Page, hidden: boolean): Promise<void> {
  for (let step = 0; step < 40; step++) {
    await awaitOpenProblem(page);
    if (await results(page).isVisible()) return;
    const answer = await readAnswer(page);
    if (hidden) await setHidden(page, true);
    // The duration is the subject: longer than a quick answer may take.
    await page.waitForTimeout(WAIT_MS);
    if (hidden) await setHidden(page, false);
    const kind = await feedbackAfter(page, () => giveAnswer(page, answer, 'keyboard'));
    expect(kind, `the right answer ${JSON.stringify(answer)} is praised`).toBe('correct');
    await expectNextProblem(page);
  }
  await expect(results(page), 'the round ends').toBeVisible();
}

test('time with the page hidden does not make answers slow: three stars, where waits in view give two', async ({
  page,
}) => {
  test.setTimeout(600_000);
  // Giant's Peaks 3 is a single round of choice tiles: finishing it finishes the level.
  await keeperWithRegions(page, 'Ada', ['giants-peaks']);
  await startLevel(page, 'giants-peaks', 'giants-peaks.3');
  await playWithWaits(page, false);
  await throughHatches(page);
  await expect(
    page.getByTestId('stars'),
    'all right but none quick: two stars (three need 60 % quick answers)',
  ).toHaveAttribute('data-earned', '2');
  await page.getByTestId('results-continue').click();

  await startLevel(page, 'giants-peaks', 'giants-peaks.3');
  await playWithWaits(page, true);
  await throughHatches(page);
  await expect(
    page.getByTestId('stars'),
    'the same waits with the page hidden did not count: every answer quick, three stars',
  ).toHaveAttribute('data-earned', '3');
});

test("the Lightning Arena's clock stands still while the page is hidden", async ({ page }) => {
  test.slow();
  const backup = await meadowWonBackup();
  await newFamily(page, { name: 'Ada' });
  await leaveHub(page);
  await loadBackup(page, backup, 'Ada');
  await playAs(page, 1, 'Ada');
  await page.getByTestId('hub-arena').click();
  const clock = page.getByTestId('arena-time');
  await expect(clock, 'the Arena counts its seconds down').toBeVisible();
  const secondsLeft = async (): Promise<number> =>
    Number(await clock.getAttribute('aria-valuenow'));
  // The clock runs in view.
  const start = await secondsLeft();
  await expect.poll(secondsLeft, { message: 'the clock runs in view' }).toBeLessThan(start);

  const before = await secondsLeft();
  await setHidden(page, true);
  await page.waitForTimeout(4_000); // the duration is the subject
  await setHidden(page, false);
  const after = await secondsLeft();
  expect(
    before - after,
    'four seconds hidden took at most one second off the clock',
  ).toBeLessThanOrEqual(1);
  await expect.poll(secondsLeft, { message: 'the clock runs again in view' }).toBeLessThan(after);
});

test('read-aloud stops when the page is hidden', async ({ page, context }) => {
  await installSpeech(context, TYPICAL_VOICES);
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  await page.getByTestId('read-aloud').click();
  await expect
    .poll(async () => (await speechLog(page)).spoken.length, { message: 'the problem is read' })
    .toBeGreaterThan(0);
  const cancels = (await speechLog(page)).cancels;
  await setHidden(page, true);
  await expect
    .poll(async () => (await speechLog(page)).cancels, {
      message: 'hiding the page stops the voice',
    })
    .toBeGreaterThan(cancels);
  await setHidden(page, false);
});
