/**
 * The day (plan §2.9, docs/app.md §14): the Daily Adventure leads through the day's plan, the
 * daily goal counts right answers and gives the gift once, the dragons get sleepy after it while
 * play goes on, and the next day (the page's clock moved) brings snack time, the week's practised
 * days and a new gift. Pacing (#27): after today's level and the day's mini-game, a day below 70 %
 * success suggests snack time or a review, never a new level; a good day suggests the next level.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  closeGrownUps,
  expectHub,
  finishRound,
  leaveHub,
  leaveResults,
  newFamily,
  openGrownUps,
  playAs,
  playFromTitle,
  reload,
  startLevel,
  startPlacement,
} from './support/app';
import {
  expectPractisedDays,
  finishRoundWithMistakes,
  finishVisibleActivity,
  openRegionEarly,
  openDailyGift,
  setDailyGoal,
  startAdventure,
} from './support/daily';

test.use({ reducedMotion: 'reduce' });

test('Daily Adventure reaches the goal, gives one gift today, resets tomorrow and starts with snacks', async ({
  page,
}) => {
  test.setTimeout(480_000);
  await page.clock.setFixedTime(new Date('2026-03-02T09:00:00'));
  await newFamily(page, { name: 'Ada' });
  await setDailyGoal(page, 'Ada', 10);

  await startPlacement(page);
  await finishRound(page, 'keyboard');
  await leaveResults(page, 'Ada');
  await expect(page.getByTestId('daily-goal')).toHaveAttribute('aria-valuenow', '10');
  await expect(page.getByText('Goal reached! Your dragons are sleepy now.')).toBeVisible();

  await openDailyGift(page, 'Ada');
  await expect(page.getByTestId('hub-adventure')).not.toHaveText('Open your gift!');
  await expect(page.getByTestId('hub-adventure')).toBeEnabled();

  await page.clock.setFixedTime(new Date('2026-03-03T09:00:00'));
  await reload(page);
  await playFromTitle(page);
  await playAs(page, 1, 'Ada');
  await expectPractisedDays(page, ['Monday', 'Tuesday']);
  await expect(page.getByTestId('hub-adventure')).toHaveText('Snack time for hungry dragons!');
  await openDailyGift(page, 'Ada');
  await expect(page.getByTestId('hub-adventure')).not.toHaveText('Open your gift!');
});

async function keeperReadyForPacing(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-03-02T09:00:00'));
  await newFamily(page, { name: 'Pip' });
  await startPlacement(page);
  await finishRound(page, 'keyboard');
  await leaveResults(page, 'Pip');
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await openRegionEarly(page, 'sharing-lake');
  await closeGrownUps(page);
  await page.clock.setFixedTime(new Date('2026-03-03T09:00:00'));
  await reload(page);
  await playFromTitle(page);
  await playAs(page, 1, 'Pip');
}

/**
 * After today's level the Daily Adventure offers the day's mini-game whatever the success; pacing
 * chooses what comes after it. Plays the mini-game and returns the suggestion that follows.
 */
async function afterTheDaysMiniGame(page: Page, keeper: string): Promise<string> {
  const adventure = page.getByTestId('hub-adventure');
  await expect(adventure, "after today's level comes the day's mini-game").toHaveText(
    /^Play again: /,
  );
  await startAdventure(page);
  await finishVisibleActivity(page, keeper);
  await expectHub(page, keeper);
  return (await adventure.textContent()) ?? '';
}

test("a low-success day holds new levels: after the day's mini-game, snack time or a review", async ({
  page,
}) => {
  test.setTimeout(360_000);
  await keeperReadyForPacing(page);
  await startLevel(page, 'sharing-lake', 'sharing-lake.2');
  await finishRoundWithMistakes(page, 6);
  await leaveResults(page, 'Pip');
  expect(
    await afterTheDaysMiniGame(page, 'Pip'),
    'below 70 % success: snack time or a review replay, not a new level',
  ).toMatch(/^(Snack time for hungry dragons!|Play again: )/);
});

test("a good-success day goes on: after the day's mini-game, the next level", async ({ page }) => {
  test.setTimeout(360_000);
  await keeperReadyForPacing(page);
  await startLevel(page, 'sharing-lake', 'sharing-lake.2');
  await finishRoundWithMistakes(page, 0);
  await leaveResults(page, 'Pip');
  expect(await afterTheDaysMiniGame(page, 'Pip'), 'a good day: the next level').toMatch(/^Play: /);
});
