/**
 * Board moves are never lost (docs/app.md §14): a move made while the one before it is still
 * being saved waits for it and then counts. Two quick taps on a basket put two fruit in it; two
 * quick taps on "One for each basket" deal two rounds. The second tap of each pair comes a task
 * after the first, so it always comes while the first move is still being saved.
 */
import { expect, test } from './support/fixtures';
import { keeperWithRegions, startLevel } from './support/app';
import { readFeastProblem } from './support/boards';

test.use({ reducedMotion: 'reduce' });

test('quick taps on the Sharing Feast all count: two fruit, then two rounds', async ({ page }) => {
  await keeperWithRegions(page, 'Ada', ['sharing-lake']);
  await startLevel(page, 'sharing-lake', 'sharing-lake.1');
  await expect(page.getByTestId('feast')).toBeVisible();
  const problem = await readFeastProblem(page);
  test.skip(problem.quotient < 3, 'this board has too little fruit for two rounds after two puts');
  const bowl = page.getByTestId('feast-bowl-count');
  await expect(bowl).toHaveText(`In the bowl: ${problem.total}`);

  // The second tap a moment after the first (a task later, as a finger's would be), long before
  // the first move is saved.
  const twice = (testId: string) =>
    page.getByTestId(testId).evaluate(async (button: HTMLButtonElement) => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      button.click();
    });

  await twice('feast-basket-0');
  await expect(page.getByTestId('feast-basket-0'), 'both taps put a fruit').toHaveAttribute(
    'data-count',
    '2',
  );
  await expect(bowl).toHaveText(`In the bowl: ${problem.total - 2}`);

  await twice('feast-deal');
  await expect(bowl, 'both taps dealt a round').toHaveText(
    `In the bowl: ${problem.total - 2 - 2 * problem.baskets}`,
  );
  await expect(page.getByTestId('feast-basket-0')).toHaveAttribute('data-count', '4');
  await expect(page.getByTestId(`feast-basket-${problem.baskets - 1}`)).toHaveAttribute(
    'data-count',
    '2',
  );
});
