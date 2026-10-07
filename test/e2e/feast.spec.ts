/**
 * The Sharing Feast's early answer (docs/app.md §14; S2b's rule, #40): a child who knows the
 * answer types it with the fruit still in the bowl, and the board is finished. The fruit is then
 * dealt out to the fair share before their eyes (at once when motion is reduced), with "Well
 * done!" and the share, and the next board follows.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { keeperWithRegions, startLevel } from './support/app';
import { minigameStatus, readFeastProblem } from './support/boards';

async function answerAtOnce(page: Page): Promise<void> {
  await keeperWithRegions(page, 'Ada', ['sharing-lake']);
  await startLevel(page, 'sharing-lake', 'sharing-lake.1');
  await expect(page.getByTestId('feast')).toBeVisible();
  const problem = await readFeastProblem(page);
  const progress = page.getByTestId('minigame-progress');
  const before = Number((await progress.getAttribute('aria-valuenow')) ?? '0');
  await expect(page.getByTestId('feast-bowl-count')).toHaveText(`In the bowl: ${problem.total}`);

  // Typed straight away, nothing dealt: the answer is the fair share.
  await page.keyboard.type(String(problem.quotient));
  if (problem.asksRemainder) {
    await page.keyboard.press('r');
    await page.keyboard.type(String(problem.remainder));
  }
  await page.keyboard.press('Enter');

  await expect(minigameStatus(page), 'the right answer is praised with the share').toHaveText(
    problem.asksRemainder
      ? `Well done! Each basket gets ${problem.quotient}, and ${problem.remainder} ${problem.remainder === 1 ? 'is' : 'are'} left over.`
      : `Well done! Each basket gets ${problem.quotient}.`,
  );
  for (const index of [0, problem.baskets - 1]) {
    await expect(
      page.getByTestId(`feast-basket-${index}`),
      `basket ${index + 1} is dealt its fair share`,
    ).toHaveAttribute('data-count', String(problem.quotient));
  }
  await expect(page.getByTestId('feast-bowl-count')).toHaveText(
    `In the bowl: ${problem.remainder}`,
  );
  await expect
    .poll(
      async () =>
        (await page.getByTestId('round-results').isVisible()) ||
        Number((await progress.getAttribute('aria-valuenow')) ?? '0') > before,
      { message: 'then the next board (or the results) follows' },
    )
    .toBe(true);
}

test.describe('with motion reduced', () => {
  test.use({ reducedMotion: 'reduce' });
  test('a right answer with the fruit still in the bowl shares it out at once', async ({
    page,
  }) => {
    await answerAtOnce(page);
  });
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('a right answer with the fruit still in the bowl deals it out to the fair share', async ({
    page,
  }) => {
    await answerAtOnce(page);
  });
});
