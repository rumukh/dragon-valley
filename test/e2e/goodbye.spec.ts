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

test('a day with stickers ends with goodbye and the Dragon Diary', async ({ page }) => {
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
