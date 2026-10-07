/**
 * The collections (plan §2.7, docs/app.md §14): Glimmer's Market sells a cosmetic for its price
 * (one too dear says so and takes nothing), the Dragon Den dresses a dragon and keeps the outfit
 * after a reload, the Sticker Album shows earned and unearned stickers on their region's page and
 * turns pages, and the Magic Window starts dark and lights the facts a keeper practised.
 */
import { expect, test } from './support/fixtures';
import {
  finishRound,
  closeGrownUps,
  leaveHub,
  leaveResults,
  newFamily,
  openGrownUps,
  openRegionsEarly,
  playAs,
  playRound,
  startLevel,
  startPlacement,
} from './support/app';
import {
  buyMarketItem,
  closeCollection,
  equipCosmetic,
  expectTooDear,
  hatchFirstDragon,
  openCollection,
  removeCosmetic,
} from './support/collections';

test.use({ reducedMotion: 'reduce' });

test('market purchases and Dragon Den outfits are saved and removable', async ({ page }) => {
  test.setTimeout(360_000);
  await newFamily(page, { name: 'Ada' });

  await openCollection(page, 'market');
  await expectTooDear(page, { id: 'hat-flower-crown', name: 'Flower Crown', missing: 20 });
  await closeCollection(page, 'Ada');

  await startPlacement(page);
  await finishRound(page, 'keyboard');
  await leaveResults(page, 'Ada');
  await hatchFirstDragon(page, 'Ada');

  await openCollection(page, 'market');
  await buyMarketItem(page, {
    id: 'hat-flower-crown',
    name: 'Flower Crown',
    slot: 'head',
    price: 20,
  });
  await closeCollection(page, 'Ada');

  await openCollection(page, 'den');
  await equipCosmetic(page, {
    dragon: 'bubbles',
    slot: 'head',
    item: 'hat-flower-crown',
    name: 'Flower Crown',
    previewClass: '.dv-hat-flower-crown',
  });
  await removeCosmetic(page, { slot: 'head', previewClass: '.dv-hat-flower-crown' });
});

test('Sticker Album shows earned and unearned stickers and turns pages with Next and the arrow keys', async ({
  page,
}) => {
  test.slow();
  await newFamily(page, { name: 'Ben' });
  await startPlacement(page);
  await finishRound(page, 'keyboard');
  await leaveResults(page, 'Ben');

  await openCollection(page, 'album');
  await expect(page.getByTestId('album-sunny-meadow')).toBeVisible();
  const stickers = page.getByTestId('album-sunny-meadow').locator('.dv-album__sticker');
  await expect(stickers.filter({ hasText: 'Show What You Know' })).toHaveAttribute(
    'data-earned',
    'true',
  );
  await expect(stickers.filter({ hasText: 'Meadow Star' })).toHaveAttribute('data-earned', 'false');
  await expect(stickers.filter({ hasText: 'Meadow Star' })).toContainText('Not yet.');

  await page.getByTestId('album-next').click();
  await expect(page.getByTestId('album-whispering-woods')).toBeVisible();
  await page.getByTestId('album-tab-whispering-woods').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('album-fire-mountain')).toBeVisible();
});

test('Magic Window starts dark and lights practised multiplication and division facts', async ({
  page,
}) => {
  test.setTimeout(600_000);
  await newFamily(page, { name: 'Cleo' });
  await openCollection(page, 'window');
  await expect(page.getByTestId('window-counts')).toContainText('Still dark: 121');
  await expect(
    page.getByTestId('screen-window').locator('.dv-pane[data-op="div"].dv-pane-dim'),
  ).toHaveCount(110);
  await closeCollection(page, 'Cleo');

  await startPlacement(page);
  await finishRound(page, 'keyboard');
  await leaveResults(page, 'Cleo');
  await hatchFirstDragon(page, 'Cleo');
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await openRegionsEarly(page, ['sharing-lake']);
  await closeGrownUps(page);
  await playAs(page, 1, 'Cleo');
  await startLevel(page, 'sharing-lake', 'sharing-lake.2');
  await playRound(page, 'keyboard');
  await leaveResults(page, 'Cleo');
  await openCollection(page, 'window');

  const litMultiplication = await page
    .getByTestId('screen-window')
    .locator('.dv-pane[data-op="mul"]:not(.dv-pane-dim)')
    .count();
  const litDivision = await page
    .getByTestId('screen-window')
    .locator('.dv-pane[data-op="div"]:not(.dv-pane-dim)')
    .count();
  expect(litMultiplication, 'multiplication panes practised in the check light up').toBeGreaterThan(
    0,
  );
  expect(litDivision, 'division panes practised in the check light up').toBeGreaterThan(0);
  await expect(page.getByTestId('window-counts')).not.toContainText('Still dark: 121');
});
