/**
 * The v1 boards played from what they show (support/boards.ts), each once by touch and once by
 * keyboard: Sharing Feast (Sharing Lake 1; Leftover Lagoon 1 with remainders; Giant's Peaks 5
 * with two-digit totals, followed by its Feeding Time of two-digit divisions) and Golem Orders
 * (Riddle Ruins 1, the order of operations; Riddle Ruins 2, with brackets). Each board is first
 * given a wrong step, which must get a kind line instead of finishing the board.
 */
import { expect, test } from './support/fixtures';
import { keeperWithRegions, playRound, results, startLevel, throughHatches } from './support/app';
import { playGolemOrders, playSharingFeast } from './support/boards';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(() => {
  test.setTimeout(300_000);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('Sharing Feast by touch: deal the fruit, then say how many are in each basket', async ({
    page,
  }) => {
    await keeperWithRegions(page, 'Ada', ['sharing-lake']);
    await startLevel(page, 'sharing-lake', 'sharing-lake.1');
    await playSharingFeast(page, 'touch');
    await expect(results(page), 'the Sharing Feast ends on its results').toBeVisible();
  });

  test('Golem Orders by touch: pick the next gear, then say its result', async ({ page }) => {
    await keeperWithRegions(page, 'Ada', ['riddle-ruins']);
    await startLevel(page, 'riddle-ruins', 'riddle-ruins.1');
    await playGolemOrders(page, 'touch');
    await expect(results(page), 'Golem Orders ends on its results').toBeVisible();
  });
});

test('Sharing Feast by keyboard: share with leftovers, type the quotient and the remainder', async ({
  page,
}) => {
  await keeperWithRegions(page, 'Ada', ['leftover-lagoon']);
  await startLevel(page, 'leftover-lagoon', 'leftover-lagoon.1');
  await playSharingFeast(page, 'keyboard');
  await expect(results(page), 'the remainder Sharing Feast ends on its results').toBeVisible();
});

test('Golem Orders by keyboard: brackets first, with focus and keys only', async ({ page }) => {
  await keeperWithRegions(page, 'Ada', ['riddle-ruins']);
  await startLevel(page, 'riddle-ruins', 'riddle-ruins.2');
  await playGolemOrders(page, 'keyboard');
  await expect(results(page), 'the bracketed Golem Orders ends on its results').toBeVisible();
});

test("Giant's Peaks: a Sharing Feast of two-digit totals, then Feeding Time divides them", async ({
  page,
}) => {
  await keeperWithRegions(page, 'Ada', ['giants-peaks']);
  await startLevel(page, 'giants-peaks', 'giants-peaks.5');
  await playSharingFeast(page, 'keyboard');
  await expect(results(page)).toBeVisible();
  await throughHatches(page);
  // On to the level's next activity.
  await page.getByTestId('results-continue').click();
  const play = page.getByTestId('level-play');
  await expect(page.getByTestId('screen-round').or(play)).toBeVisible();
  if (await play.isVisible()) await play.click();
  await expect(page.getByTestId('screen-round'), 'Feeding Time follows the feast').toBeVisible();
  const played = await playRound(page, 'keyboard');
  expect(
    played.map((item) => item.written),
    'every problem divides a two-digit number by a one-digit one',
  ).toEqual(
    played.map((item) =>
      /^\d{2} : [2-9] = \?$/.test(item.written)
        ? item.written
        : `not 2-digit : 1-digit: ${item.written}`,
    ),
  );
  expect(played.length, 'the round asked problems').toBeGreaterThan(0);
});
