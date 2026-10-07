/**
 * The finale (docs/design.md §3.9, docs/app.md §14): the Seven-Headed Dragon is won over head by
 * head, three right answers a head, and the finale beat shows every head cured and, from its
 * second line, the Magic Window whole again in the castle hall.
 *
 * - Head by head: a grown-up unlocks Dragon Castle ahead, and the child goes straight to the
 *   boss and cures the first head (its problems are plain multiplication facts, which the page
 *   oracle solves).
 * - The finale: the rules themselves win over the dragon in a fresh game, and the save, stopped
 *   on the finale beat, is loaded as a keeper's backup (support/finale.ts).
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  answerCorrectly,
  boot,
  createFirstKeeper,
  expectHub,
  expectScreen,
  keeperCard,
  keeperWithRegions,
  leaveHub,
  loadBackup,
  round,
  startLevel,
} from './support/app';
import { FINALE_BEAT, finaleBackup } from './support/finale';

/** The text of the praise that follows `act` (it shows only briefly). */
async function praiseAfter(page: Page, act: () => Promise<unknown>): Promise<string> {
  await page.evaluate(() => {
    const node = document.querySelector('[data-testid="feedback"]');
    const scope = window as unknown as { __dvQaPraise?: string[] };
    scope.__dvQaPraise = [];
    if (!node) return;
    new MutationObserver(() => {
      if (node.getAttribute('data-kind') === 'correct') {
        scope.__dvQaPraise!.push(node.textContent ?? '');
      }
    }).observe(node, { attributes: true, childList: true, subtree: true });
  });
  await act();
  return page.evaluate(() =>
    ((window as unknown as { __dvQaPraise?: string[] }).__dvQaPraise ?? []).join(' | '),
  );
}

test('the Seven-Headed Dragon is won over head by head', async ({ page }) => {
  await keeperWithRegions(page, 'Ada', ['dragon-castle']);
  await startLevel(page, 'dragon-castle', 'dragon-castle.boss');
  await expect(round(page)).toBeVisible();

  const heads = page.getByTestId('boss-heads');
  const boss = page.getByTestId('round-boss');
  await expect(heads).toHaveText('0 of 7 heads cured');
  await expect(boss).toHaveAttribute('data-cured', '0');
  await expect(boss).toHaveAttribute('aria-label', 'The Seven-Headed Dragon: 0 of 7 heads cured.');
  for (let answer = 1; answer < 3; answer++) {
    const praise = await praiseAfter(page, () => answerCorrectly(page, 'keyboard'));
    expect(praise, 'a head needs three right answers').not.toContain('A head is cured!');
  }
  await expect(heads).toHaveText('0 of 7 heads cured');
  const praise = await praiseAfter(page, () => answerCorrectly(page, 'keyboard'));
  expect(praise, 'the third right answer cures the first head').toContain('A head is cured!');
  await expect(heads).toHaveText('1 of 7 heads cured');
  await expect(boss).toHaveAttribute('data-cured', '1');
  await expect(boss.locator('svg')).toHaveAttribute('data-cured', '1');
  await expect(heads.locator('[data-cured="true"]')).toHaveCount(1);
});

test('the finale: every head cured and the Magic Window whole again', async ({ page }) => {
  const backup = await finaleBackup();
  await boot(page);
  await createFirstKeeper(page, { name: 'Ema' });
  await leaveHub(page);
  await loadBackup(page, backup, 'Ema');

  await keeperCard(page, 1).click();
  await expectScreen(page, 'play');
  const story = page.getByTestId('screen-story');
  await expect(story).toHaveAttribute('data-beat', FINALE_BEAT);
  await expect(page.getByTestId('story-line')).toHaveText(
    'All seven heads smile at once. No more sneezes!',
  );
  const figure = story.locator('.dv-story__figure');
  await expect(figure).toHaveAttribute('data-figure', 'seven-headed');
  await expect(figure.locator('svg')).toHaveAttribute('data-cured', '7');
  await expect(page.getByTestId('hall-window'), 'the window comes with the next line').toHaveCount(
    0,
  );

  await page.getByTestId('story-next').click();
  await expect(page.getByTestId('story-line')).toHaveText('The Magic Window shines, whole again.');
  const window = page.getByTestId('hall-window');
  await expect(window).toBeVisible();
  await expect(window.locator('.dv-pane-gold')).toHaveCount(231);
  await expect(window.locator('.dv-pane-dim')).toHaveCount(0);

  await page.getByTestId('story-next').click();
  await expect(page.getByTestId('story-line')).toHaveText(
    'Look! The Seven-Headed Dragon is your friend now.',
  );
  await expect(page.getByTestId('hall-window')).toBeVisible();
  await page.getByTestId('story-next').click();
  await expect(page.getByTestId('story-line')).toHaveText(
    'Thank you, Dragon Keeper. The valley is warm again.',
  );
  await page.getByTestId('story-next').click();
  await expectHub(page, 'Ema');
});
