/**
 * The class a keeper is in (docs/grades-plan.md): the new-keeper editor asks "Which class is
 * <name> in?" after the name and the picture, 3rd class chosen until another is, and the
 * grown-ups can change it per keeper behind the gate. A class this version of the valley has no
 * lessons for yet changes nothing: the keeper plays on as before, and the grown-ups are told so.
 */
import { expect, test } from './support/fixtures';
import {
  boot,
  expectHub,
  expectScreen,
  fillKeeper,
  leaveHub,
  meetFirstEgg,
  openGrownUps,
} from './support/app';

test('the editor asks for the class; a class without lessons yet leaves the game as it was', async ({
  page,
}) => {
  await boot(page);
  await page.getByTestId('title-play').click();
  await expectScreen(page, 'editor');
  await fillKeeper(page, { name: 'Ema' });
  await expect(page.getByTestId('keeper-grade')).toContainText('Which class is Ema in?');
  await expect(
    page.getByTestId('grade-3').locator('input'),
    '3rd class until changed',
  ).toBeChecked();
  await page.getByTestId('grade-2').click();
  await expect(page.getByTestId('grade-2').locator('input')).toBeChecked();
  await page.getByTestId('keeper-save').click();

  await meetFirstEgg(page);
  await expectHub(page, 'Ema');
  await expect(page.getByTestId('hub-window'), 'the Magic Window of a 3rd grader').toBeVisible();

  await leaveHub(page);
  await openGrownUps(page, 'settings');
  const field = page.getByTestId('setting-grade');
  await expect(field).toContainText('every earlier region stays open for practice');
  await expect(page.getByTestId('setting-grade-3')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('setting-grade-1').click();
  await expect(page.getByText('no lessons for that class yet')).toBeVisible();
  await expect(page.getByTestId('setting-grade-3')).toHaveAttribute('aria-pressed', 'true');
});
