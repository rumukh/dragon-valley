import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import {
  answerCorrectly,
  answerWrongly,
  changeOnPanel,
  currentScreen,
  expectHub,
  finishStory,
  goOn,
  leaveHub,
  leaveResults,
  openGrownUps,
  playAs,
  playRound,
  results,
  throughHatches,
} from './app';
import { finishCurrentMinigame } from './collections';

export async function setDailyGoal(page: Page, keeper: string, goal: 10 | 20): Promise<void> {
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await page.getByTestId(`setting-goal-${goal}`).click();
  await expect(page.getByTestId(`setting-goal-${goal}`)).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('parent-close').click();
  await playAs(page, 1, keeper);
  await expect(page.getByTestId('daily-goal')).toHaveAttribute('aria-valuemax', String(goal));
}

export async function openRegionEarly(page: Page, region: string): Promise<void> {
  const rules = page.getByTestId('parent-rules');
  await expect(rules, "the keeper's game settings are shown").toBeVisible();
  await expect(rules.getByText(/These settings appear after/)).toHaveCount(0);
  const toggle = page.getByTestId(`setting-unlock-${region}`);
  if ((await toggle.count()) === 0 || (await toggle.isChecked())) return;
  await changeOnPanel(page, () => toggle.click());
  await expect
    .poll(async () => (await toggle.count()) === 0 || (await toggle.isChecked()), {
      message: `${region} is open early`,
    })
    .toBe(true);
}

export async function finishRoundWithMistakes(page: Page, wrongAnswers: number): Promise<void> {
  let misses = 0;
  for (let step = 0; step < 80 && !(await results(page).isVisible()); step++) {
    if (await page.getByTestId('feedback-next').isVisible()) {
      await goOn(page);
      continue;
    }
    if (misses < wrongAnswers) {
      await answerWrongly(page, 'keyboard');
      misses += 1;
    } else {
      await answerCorrectly(page, 'keyboard');
    }
  }
  await expect(results(page), 'the round ends').toBeVisible();
}

export async function finishVisibleActivity(page: Page, keeper: string): Promise<void> {
  for (let step = 0; step < 10; step++) {
    await expect
      .poll(
        async () =>
          (await page.getByTestId('screen-story').isVisible()) ||
          (await page.getByTestId('screen-minigame').isVisible()) ||
          (await page.getByTestId('screen-round').isVisible()) ||
          (await results(page).isVisible()) ||
          (await page.getByTestId('screen-hub').isVisible()),
        { message: 'an activity, results or the hub' },
      )
      .toBe(true);
    if (await page.getByTestId('screen-story').isVisible()) {
      await finishStory(page);
      continue;
    }
    if (await page.getByTestId('screen-minigame').isVisible()) {
      await finishCurrentMinigame(page);
      await throughHatches(page);
      await page.getByTestId('results-continue').click();
      continue;
    }
    if (await page.getByTestId('screen-round').isVisible()) {
      await playRound(page, 'keyboard');
      await throughHatches(page);
      await page.getByTestId('results-continue').click();
      continue;
    }
    if (await results(page).isVisible()) {
      await throughHatches(page);
      await leaveResults(page, keeper);
      return;
    }
    if (await page.getByTestId('screen-hub').isVisible()) return;
    if ((await currentScreen(page)) !== 'play') continue;
  }
  await expectHub(page, keeper);
}

export async function openDailyGift(page: Page, keeper: string): Promise<void> {
  for (let step = 0; step < 8; step++) {
    const adventure = page.getByTestId('hub-adventure');
    await expect(adventure).toBeVisible();
    if ((await adventure.textContent()) === 'Open your gift!') {
      await adventure.click();
      await expect(page.getByTestId('gift-dialog')).toBeVisible();
      await page.getByTestId('gift-close').click();
      await expectHub(page, keeper);
      return;
    }
    await adventure.click();
    await finishVisibleActivity(page, keeper);
    await expectHub(page, keeper);
  }
  throw new Error('The Daily Adventure did not offer the gift.');
}

export async function expectPractisedDays(page: Page, days: readonly string[]): Promise<void> {
  for (const day of days) {
    await expect(
      page.getByTestId('week').locator(`[aria-label="${day}: you played"]`),
    ).toHaveAttribute('data-practised', 'true');
  }
}
