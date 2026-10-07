/**
 * The valley map with every region awake (docs/app.md §14): each place keeps a readable name.
 * While the names fit, the places' buttons stand on the picture; when the map is too narrow for
 * them (a phone, or a keeper's text at 200 %), the same buttons line up under it, in the valley's
 * order, and the picture keeps each place's emblem as a pin. No two names ever overlap.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  chooseSetting,
  closeGrownUps,
  expectScreen,
  leaveHub,
  newFamily,
  openGrownUps,
  playAs,
  unlockAhead,
} from './support/app';

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The regions in the valley's order, from the shipped content pack. */
function valleyOrder(testInfo: TestInfo): string[] {
  const root = testInfo.config.configFile ? dirname(testInfo.config.configFile) : process.cwd();
  const pack = JSON.parse(
    readFileSync(join(root, 'content', 'dragon-valley.content.json'), 'utf8'),
  ) as { data: { regions: { id: string; order: number }[] } };
  return [...pack.data.regions].sort((a, b) => a.order - b.order).map((region) => region.id);
}

async function boxes(places: Locator): Promise<Box[]> {
  return places.evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
}

function overlaps(a: Box, b: Box): boolean {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 1 && height > 1;
}

async function openValley(page: Page, regions: readonly string[], large: boolean): Promise<void> {
  await newFamily(page, { name: 'Ada' });
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  if (large) await chooseSetting(page, 'setting-text-200');
  for (const region of regions.slice(1)) await unlockAhead(page, region);
  await closeGrownUps(page);
  await playAs(page, 1, 'Ada');
  await page.getByTestId('hub-map').click();
  await expectScreen(page, 'map');
}

async function expectReadableNames(page: Page, regions: readonly string[]): Promise<void> {
  const places = page.locator('.dv-map__place');
  await expect(places).toHaveCount(regions.length);
  const found = await boxes(places);
  const width = page.viewportSize()!.width;
  for (const [index, box] of found.entries()) {
    expect(box.x, `${regions[index]} starts inside the screen`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${regions[index]} ends inside the screen`).toBeLessThanOrEqual(
      width,
    );
    for (const [other, next] of found.entries()) {
      if (other <= index) continue;
      expect(overlaps(box, next), `${regions[index]} and ${regions[other]} do not overlap`).toBe(
        false,
      );
    }
  }
}

test('every place on the map keeps its name on the picture, side by side', async ({
  page,
}, testInfo) => {
  const regions = valleyOrder(testInfo);
  await page.setViewportSize({ width: 1180, height: 820 });
  await openValley(page, regions, false);
  await expect(page.getByTestId('map-area')).toHaveAttribute('data-compact', 'false');
  await expect(page.locator('.dv-map .dv-map__place')).toHaveCount(regions.length);
  await expect(page.locator('.dv-map__pin').first()).toBeHidden();
  await expectReadableNames(page, regions);
});

test('at 200 % text the names line up under the map, in the valley order', async ({
  page,
}, testInfo) => {
  const regions = valleyOrder(testInfo);
  await openValley(page, regions, true);
  for (const size of [
    { width: 1180, height: 820 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const area = page.getByTestId('map-area');
    await expect(area).toHaveAttribute('data-compact', 'true');
    await expect(
      page.locator('.dv-map .dv-map__place'),
      'no button left on the picture',
    ).toHaveCount(0);
    await expect(page.locator('.dv-map__pin')).toHaveCount(regions.length);
    await expect(page.locator('.dv-map__pin').first()).toBeVisible();
    const order = await page
      .locator('.dv-map__place')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-testid')));
    expect(order).toEqual(regions.map((region) => `map-region-${region}`));
    const picture = (await page.locator('.dv-map').boundingBox())!;
    const first = (await page.getByTestId(`map-region-${regions[0]}`).boundingBox())!;
    expect(first.y, 'the names start under the picture').toBeGreaterThanOrEqual(
      picture.y + picture.height,
    );
    await expectReadableNames(page, regions);
  }
  await page.getByTestId(`map-region-${regions[0]}`).click();
  await expectScreen(page, 'region');
});
