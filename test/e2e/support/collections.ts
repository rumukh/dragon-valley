import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import { playFactFamily, playMemoryMatch, playNumberTrail } from './activities';
import {
  coinCount,
  expectHub,
  expectSaved,
  expectScreen,
  leaveResults,
  playRound,
  startLevel,
  throughHatches,
} from './app';

export type CollectionPlace = 'market' | 'den' | 'album' | 'window';

export async function openCollection(page: Page, place: CollectionPlace): Promise<void> {
  await page.getByTestId(`hub-${place}`).click();
  await expectScreen(page, place);
}

export async function closeCollection(page: Page, keeper: string): Promise<void> {
  await page.getByTestId('collection-back').click();
  await expectHub(page, keeper);
}

export function marketItem(page: Page, name: string) {
  return page.getByTestId('market-items').locator('li').filter({ hasText: name });
}

export async function buyMarketItem(
  page: Page,
  options: { id: string; name: string; slot: string; price: number },
): Promise<number> {
  const before = await coinCount(page);
  const tab = page.getByTestId(`market-tab-${options.slot}`);
  if ((await tab.count()) > 0) {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-pressed', 'true');
  }
  const item = marketItem(page, options.name);
  await expect(item).toContainText(options.name);
  await page.getByTestId(`market-buy-${options.id}`).click();
  await expect(page.getByTestId('toast').last()).toContainText(`You bought ${options.name}!`);
  await expect(page.getByTestId('coins')).toHaveAttribute(
    'data-value',
    String(before - options.price),
  );
  await expect(item, `${options.name} is marked owned`).toContainText('Yours!');
  await expect(page.getByTestId(`market-buy-${options.id}`)).toHaveCount(0);
  return before - options.price;
}

export async function expectTooDear(
  page: Page,
  options: { id: string; name: string; missing: number },
): Promise<void> {
  const before = await coinCount(page);
  const item = marketItem(page, options.name);
  await expect(item).toContainText(options.name);
  const buy = page.getByTestId(`market-buy-${options.id}`);
  await expect(buy).toBeDisabled();
  await expect(buy).toHaveText(`Need ${options.missing} more coins`);
  await expect(page.getByTestId('coins')).toHaveAttribute('data-value', String(before));
}

export async function equipCosmetic(
  page: Page,
  options: { dragon: string; slot: string; item: string; name: string; previewClass: string },
): Promise<void> {
  await page.getByTestId(`den-dragon-${options.dragon}`).click();
  await page.getByTestId(`den-${options.slot}-${options.item}`).click();
  await expect(page.getByTestId(`den-${options.slot}-${options.item}`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('den-preview').locator(options.previewClass)).toHaveCount(1);
  // A move shows once taken; the reload must come after it is saved.
  await expectSaved(page);
  await page.reload();
  await expect(
    page.getByTestId('boot-status'),
    'the shell reports ready after reload',
  ).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
  await page.getByTestId('title-play').click();
  await page.getByTestId('keeper-profile-1').click();
  await openCollection(page, 'den');
  await page.getByTestId(`den-dragon-${options.dragon}`).click();
  await expect(page.getByTestId(`den-${options.slot}-${options.item}`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('den-preview').locator(options.previewClass)).toHaveCount(1);
}

export async function removeCosmetic(
  page: Page,
  options: { slot: string; previewClass: string },
): Promise<void> {
  await page.getByTestId(`den-${options.slot}-none`).click();
  await expect(page.getByTestId(`den-${options.slot}-none`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('den-preview').locator(options.previewClass)).toHaveCount(0);
}

export async function finishEggGrid(page: Page): Promise<void> {
  const grid = page.getByTestId('egg-grid');
  await expect(grid).toBeVisible();
  const board = () =>
    page.evaluate(() => ({
      over: document.querySelector('[data-testid="screen-results"]') !== null,
      goal: document.querySelector('[data-testid="egg-goal"]')?.textContent ?? '',
      found: [...document.querySelectorAll('[data-testid="egg-found"] li')].map((item) =>
        (item.textContent ?? '').replace(/\s/g, ''),
      ),
    }));
  for (let move = 0; move < 30; move++) {
    const before = await board();
    if (before.over) break;
    const eggs = Number(/of (\d+) eggs/.exec(before.goal)?.[1] ?? 0);
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find(
      (side) =>
        eggs % side === 0 &&
        eggs / side >= 1 &&
        eggs / side <= 10 &&
        !before.found.includes(`${side}·${eggs / side}`),
    );
    expect(rows, `a nest of ${eggs} left to find`).toBeDefined();
    await grid.locator(`[data-row="${rows}"][data-column="${eggs / rows!}"]`).click();
    await page.getByTestId('egg-check').click();
    await expect
      .poll(
        async () => {
          const after = await board();
          return after.over ||
            after.goal !== before.goal ||
            after.found.length > before.found.length
            ? 'moved'
            : 'waiting';
        },
        { message: 'the Egg Grid takes the nest', timeout: 30_000 },
      )
      .toBe('moved');
  }
  await expect(page.getByTestId('screen-results')).toBeVisible();
}

/**
 * Play whichever minigame board is showing to its results, from what it shows. The boards take a
 * move only once it is saved, so the activities' helpers wait for each move to be taken before the
 * next; Check sent while the last move is still saving would be dropped.
 */
export async function finishCurrentMinigame(page: Page): Promise<void> {
  if (await page.getByTestId('egg-grid').isVisible()) return finishEggGrid(page);
  if (await page.getByTestId('family-nest').isVisible()) return playFactFamily(page, 'keyboard');
  if (await page.getByTestId('match-grid').isVisible()) {
    return playMemoryMatch(page, 'keyboard', 'value');
  }
  if (await page.getByTestId('trail').isVisible()) return playNumberTrail(page, 'keyboard');
  throw new Error('No supported minigame board is visible.');
}

export async function hatchFirstDragon(page: Page, keeper: string): Promise<void> {
  await startLevel(page, 'sunny-meadow', 'sunny-meadow.1');
  if (await page.getByTestId('screen-minigame').isVisible()) {
    await finishCurrentMinigame(page);
    await throughHatches(page);
    await page.getByTestId('results-continue').click();
    await expect
      .poll(
        async () =>
          (await page.getByTestId('screen-round').isVisible()) ||
          (await page.getByTestId('screen-hub').isVisible()),
        { message: 'the next level activity or the hub' },
      )
      .toBe(true);
  }
  if (await page.getByTestId('screen-round').isVisible()) {
    await playRound(page, 'keyboard');
    await throughHatches(page);
    await leaveResults(page, keeper);
  } else {
    await expectHub(page, keeper);
  }
}
