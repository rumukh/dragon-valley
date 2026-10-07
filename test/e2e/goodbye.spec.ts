/**
 * Goodbye and the Dragon Diary (docs/app.md §14): leaving the valley after a day that brought
 * something shows what it brought, made from the game's data (here the stickers of a finished
 * placement check), and can go back to the valley or on to the keepers. A day that brought
 * nothing leaves at once, and the diary survives a reload.
 */
import { expect, test } from './support/fixtures';
import {
  expectHub,
  expectScreen,
  finishRound,
  leaveResults,
  newFamily,
  playAs,
  playFromTitle,
  reload,
  startPlacement,
} from './support/app';
import { hatchFirstDragon } from './support/collections';

test('a day with stickers ends with goodbye and the Dragon Diary', async ({ page }) => {
  test.slow(); // A whole placement check and a reload.
  await newFamily(page, { name: 'Ada' });
  await page.getByTestId('hub-back').click();
  await expectScreen(page, 'keepers');

  await playAs(page, 1, 'Ada');
  await startPlacement(page);
  await finishRound(page, 'keyboard');
  await leaveResults(page, 'Ada');
  await page.getByTestId('hub-back').click();
  await expectScreen(page, 'goodbye');
  await expect(page.getByTestId('goodbye-heading')).toHaveText('Goodbye, Ada!');
  const diary = page.getByTestId('diary');
  await expect(diary.getByRole('heading', { name: 'Dragon Diary' })).toBeVisible();
  await expect(page.getByTestId('diary-stickers')).toContainText('New sticker: ');

  await page.getByTestId('goodbye-back').click();
  await expectHub(page, 'Ada');
  await reload(page);
  await playFromTitle(page);
  await playAs(page, 1, 'Ada');
  await page.getByTestId('hub-back').click();
  await expectScreen(page, 'goodbye');
  await expect(page.getByTestId('diary-stickers'), 'the day is kept over a reload').toContainText(
    'New sticker: ',
  );
  await page.getByTestId('goodbye-done').click();
  await expectScreen(page, 'keepers');
});

test('a big first day still fits a laptop window: "See you soon!" stays in view', async ({
  page,
}) => {
  test.slow(); // A whole placement check and a whole level.
  await page.setViewportSize({ width: 1366, height: 657 });
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  await finishRound(page, 'keyboard');
  await leaveResults(page, 'Ada');
  await hatchFirstDragon(page, 'Ada');
  await page.getByTestId('hub-back').click();
  await expectScreen(page, 'goodbye');
  await expect(page.getByTestId('diary-stickers').locator('li'), 'a big day').not.toHaveCount(0);
  await expect(page.getByTestId('diary-dragons').locator('li')).not.toHaveCount(0);
  await expect(page.getByTestId('goodbye-done'), 'the way on is in sight').toBeInViewport({
    ratio: 1,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
  );
  expect(
    overflow,
    'the page itself does not scroll; the diary scrolls in its card',
  ).toBeLessThanOrEqual(1);
});
