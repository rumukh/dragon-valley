/**
 * Show me (docs/app.md §14): the hint shows the problem's picture, and the answer given after it
 * is taken at once. The hint is a commit of its own, so the round sends the answer against the
 * view after it; before, the stale-view guard refused that first answer ("Let's try that
 * again.") and the child had to answer twice.
 */
import { expect, test } from './support/fixtures';
import { answerCorrectly, newFamily, startPlacement } from './support/app';

test.use({ reducedMotion: 'reduce' });

test('after Show me, the answer is taken at once, by keyboard or by tapping', async ({ page }) => {
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  for (const via of ['keyboard', 'pointer'] as const) {
    const hint = page.getByTestId('round-hint');
    await expect(hint, 'a fact with a picture offers Show me').toBeVisible();
    await hint.click();
    await expect(page.locator('.dv-round__model .dv-model'), 'the picture is shown').toBeVisible();
    await expect(hint, 'Show me is used up').toHaveCount(0);
    await answerCorrectly(page, via);
    await expect(page.getByText("Let's try that again."), 'nothing was refused').toHaveCount(0);
  }
});
