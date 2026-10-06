/**
 * Keepers (child profiles, docs/app.md §4 "Family"): up to four on a device, renamed by the
 * child, removed only by a grown-up behind the gate and a confirmation, and a removal erases
 * that keeper's own saved data.
 */
import { expect, test } from './support/fixtures';
import {
  addKeeper,
  answerCorrectly,
  chooseSetting,
  expectCoins,
  expectSaved,
  expectScreen,
  keeperCard,
  leaveHub,
  newFamily,
  openGrownUps,
  openTab,
  passGate,
  playAs,
  playFromTitle,
  quitRound,
  reload,
  settingsFor,
  startPlacement,
} from './support/app';
import { gameKey, preferencesKey, readHistory } from './support/storage';

test('the valley has room for four keepers, in fixed slots', async ({ page }) => {
  await newFamily(
    page,
    { name: 'Ada', avatar: 'keeper-1' },
    { name: 'Ben', avatar: 'keeper-2' },
    { name: 'Cleo', avatar: 'keeper-3' },
  );
  await leaveHub(page);
  await expect(page.getByTestId('keeper-add')).toBeVisible();
  await addKeeper(page, { name: 'Dan', avatar: 'keeper-8' });
  await leaveHub(page);

  for (const [slot, name] of [
    [1, 'Ada'],
    [2, 'Ben'],
    [3, 'Cleo'],
    [4, 'Dan'],
  ] as const) {
    await expect(keeperCard(page, slot)).toHaveAccessibleName(`Play as ${name}`);
  }
  await expect(page.getByTestId('keeper-add'), 'no fifth keeper').toHaveCount(0);
  await expect(page.getByText('The valley has room for four keepers.')).toBeVisible();

  await openGrownUps(page);
  await expect(page.getByTestId('parent-keepers').getByRole('listitem')).toHaveCount(4);
  await expect(page.getByTestId('parent-add'), 'grown-ups cannot add a fifth either').toHaveCount(
    0,
  );
});

test('a child renames their keeper and changes the picture', async ({ page }) => {
  await newFamily(page, { name: 'Tom', avatar: 'keeper-5' });
  await leaveHub(page);
  await page.getByTestId('keeper-edit-profile-1').click();
  await expectScreen(page, 'editor');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Change your keeper');
  await expect(page.getByTestId('keeper-name')).toHaveValue('Tom');
  await expect(page.getByTestId('avatar-keeper-5').locator('input')).toBeChecked();
  await page.getByTestId('keeper-name').fill('Tomáš');
  await page.getByTestId('avatar-keeper-6').click();
  await page.getByTestId('keeper-save').click();
  await expectScreen(page, 'keepers');
  await expect(keeperCard(page, 1)).toHaveAccessibleName('Play as Tomáš');

  await reload(page);
  await playFromTitle(page);
  await page.getByTestId('keeper-edit-profile-1').click();
  await expect(page.getByTestId('keeper-name')).toHaveValue('Tomáš');
  await expect(page.getByTestId('avatar-keeper-6').locator('input')).toBeChecked();
});

test('removing a keeper needs the gate and a confirmation, and erases their saved data', async ({
  page,
}) => {
  await newFamily(page, { name: 'Ema' }, { name: 'Filip', avatar: 'keeper-4' });
  await leaveHub(page);
  await playAs(page, 1, 'Ema');
  await startPlacement(page);
  await answerCorrectly(page, 'keyboard');
  await expectSaved(page);
  await quitRound(page, 'Ema');
  await leaveHub(page);
  const emaGame = await gameKey(page, 'profile-1');

  // The child's own editor offers removal, but only behind the gate.
  await page.getByTestId('keeper-edit-profile-1').click();
  await page.getByTestId('keeper-remove').click();
  await expect(page.getByTestId('parent-gate')).toBeVisible();
  await page.getByTestId('gate-cancel').click();
  await expect(page.getByTestId('parent-gate')).toHaveCount(0);
  await expect(page.getByTestId('confirm-dialog'), 'no gate, no question').toHaveCount(0);

  await page.getByTestId('keeper-remove').click();
  await passGate(page);
  const confirm = page.getByTestId('confirm-dialog');
  await expect(confirm).toContainText('Remove Ema?');
  await expect(confirm).toContainText(
    "This deletes Ema's dragons, progress and settings on this device.",
  );
  await page.getByTestId('confirm-cancel').click();
  await expect(confirm).toHaveCount(0);
  await expectScreen(page, 'editor');

  await page.getByTestId('keeper-remove').click();
  await passGate(page);
  await page.getByTestId('confirm-ok').click();
  await expectScreen(page, 'keepers');
  await expect(page.getByTestId('toast').last()).toHaveText('Ema was removed.');
  await expect(keeperCard(page, 1)).toHaveCount(0);
  await expect(keeperCard(page, 2), 'Filip keeps his slot').toHaveAccessibleName('Play as Filip');
  const erased = await readHistory(page, emaGame);
  expect(erased?.current, "Ema's game save is erased").toBeUndefined();
  expect(erased?.previous, 'no copy of it is kept').toBeUndefined();

  // The freed slot starts from nothing.
  await addKeeper(page, { name: 'Gita', avatar: 'keeper-7' });
  await expectCoins(page, 0);
  await leaveHub(page);
  await expect(keeperCard(page, 1)).toHaveAccessibleName('Play as Gita');
});

test("grown-ups remove a keeper from their area, and the keeper's settings go too", async ({
  page,
}) => {
  await newFamily(page, { name: 'Hana' }, { name: 'Ivo' });
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await settingsFor(page, 2);
  await chooseSetting(page, 'setting-notation-international');
  expect((await readHistory(page, preferencesKey('profile-2')))?.current).toBeDefined();

  await openTab(page, 'keepers');
  await page.getByTestId('parent-remove-profile-2').click();
  await expect(page.getByTestId('confirm-dialog')).toContainText('Remove Ivo?');
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('parent-keepers')).not.toContainText('Ivo');
  await expect(page.getByTestId('parent-keepers')).toContainText('Hana');
  expect(
    (await readHistory(page, preferencesKey('profile-2')))?.current,
    "Ivo's settings are erased",
  ).toBeUndefined();
});
