/**
 * The placement check's three paths (plan §2.4, "Placement"; the rules' ladder,
 * src/rules/progression/ladder.ts, over `content.placement`). "Show the dragons what you know!"
 * asks a few keypad problems per step and climbs while the child passes each step:
 *
 * - A child who knows the meadow's facts passes every step. Sunny Meadow 2 to 5 are placed
 *   (completed with one star, replayable), their eggs arrive, and Sunny Meadow 6 opens. Sunny
 *   Meadow 1, the concept level, is never placed: it is still the next level to play.
 * - A child who misses three in a row is stopped gently, with nothing placed: the road begins at
 *   Sunny Meadow 1 and the rest stays locked.
 * - A child who leaves part-way keeps what was placed so far, and the check is not offered again
 *   (the grown-ups can run it again: grown-ups.spec.ts).
 */
import { expect, test } from './support/fixtures';
import type { Page } from '@playwright/test';
import {
  answerCorrectly,
  answerWrongly,
  expectHub,
  expectScreen,
  goOn,
  leaveResults,
  newFamily,
  quitRound,
  results,
  round,
  startPlacement,
  throughHatches,
} from './support/app';

test.use({ reducedMotion: 'reduce' });

const LEVELS = [
  'sunny-meadow.1',
  'sunny-meadow.2',
  'sunny-meadow.3',
  'sunny-meadow.4',
  'sunny-meadow.5',
  'sunny-meadow.6',
  'sunny-meadow.boss',
] as const;
type Level = (typeof LEVELS)[number];
/** How a level shows on the road: open, locked, the next one (glowing), or done with N stars. */
type Shown = 'next' | 'open' | 'locked' | `${1 | 2 | 3} stars`;

/** Sunny Meadow's road, read from its markers (the level card behind each is not opened). */
async function road(page: Page): Promise<Record<Level, Shown>> {
  await page.getByTestId('hub-map').click();
  await expectScreen(page, 'map');
  await page.getByTestId('map-region-sunny-meadow').click();
  await expectScreen(page, 'region');
  const shown = {} as Record<Level, Shown>;
  for (const level of LEVELS) {
    const marker = page.getByTestId(`level-${level}`);
    const status = await marker.getAttribute('data-status');
    if (status === 'completed') {
      const stars = /: ([123]) of 3 stars$/.exec((await marker.getAttribute('aria-label')) ?? '');
      shown[level] = `${Number(stars?.[1] ?? 0) as 1 | 2 | 3} stars`;
    } else if (status === 'open') {
      shown[level] = (await marker.getAttribute('data-glowing')) === 'true' ? 'next' : 'open';
    } else shown[level] = 'locked';
  }
  await page.getByTestId('region-back').click();
  await expectScreen(page, 'map');
  await expect(
    page.getByTestId('map-region-whispering-woods'),
    'Whispering Woods sleeps until the Bridge Troll is won over',
  ).toHaveCount(0);
  await page.getByTestId('map-back').click();
  await expectHub(page, 'Ada');
  return shown;
}

/** The results' celebrations, as their captions read. */
async function celebrations(page: Page): Promise<string[]> {
  return page
    .getByTestId('results-celebrations')
    .locator('[data-testid^="celebrate-"]')
    .allInnerTexts()
    .then((texts) => texts.map((text) => text.trim()));
}

test('a child who knows the meadow passes every step: Sunny Meadow 2 to 5 are placed, their eggs arrive and level 6 opens', async ({
  page,
}) => {
  test.slow();
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  let answered = 0;
  for (; answered < 30 && (await round(page).isVisible()); answered++) {
    await answerCorrectly(page, 'keyboard');
  }
  await expect(results(page)).toBeVisible();
  await throughHatches(page);
  await expect(page.getByTestId('results-title')).toHaveText('The dragons saw what you know!');
  await expect(page.getByTestId('results-summary')).toHaveText(`${answered} of ${answered} right.`);
  const said = await celebrations(page);
  for (const egg of ['Sunny', 'Goldie', 'Mirror', 'Puff']) {
    expect(said, `the eggs of the placed levels arrive (${said.join('; ')})`).toContain(
      `A new egg: ${egg}`,
    );
  }
  expect(said, 'the check earns its sticker').toContain('New sticker: Show What You Know');
  await leaveResults(page, 'Ada');
  await expect(page.getByTestId('hub-adventure'), 'the concept level comes first').toHaveText(
    'Play: Equal Groups',
  );
  expect(await road(page)).toEqual({
    'sunny-meadow.1': 'next',
    'sunny-meadow.2': '1 stars',
    'sunny-meadow.3': '1 stars',
    'sunny-meadow.4': '1 stars',
    'sunny-meadow.5': '1 stars',
    'sunny-meadow.6': 'open',
    'sunny-meadow.boss': 'locked',
  });
});

test('a child who misses three in a row is stopped gently, with nothing placed', async ({
  page,
}) => {
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  let missed = 0;
  for (; missed < 10 && (await round(page).isVisible()); missed++) {
    await answerWrongly(page, 'keyboard');
    await goOn(page);
  }
  expect(missed, 'the check stopped after three misses in a row').toBe(3);
  await expect(results(page)).toBeVisible();
  await throughHatches(page);
  await expect(page.getByTestId('results-title')).toHaveText('The dragons saw what you know!');
  expect(await celebrations(page), 'no level was placed, so no egg arrived').not.toContainEqual(
    expect.stringMatching(/^A new egg/),
  );
  await leaveResults(page, 'Ada');
  await expect(page.getByTestId('hub-adventure'), 'the check is done').toHaveText(
    'Play: Equal Groups',
  );
  expect(await road(page)).toEqual({
    'sunny-meadow.1': 'next',
    'sunny-meadow.2': 'locked',
    'sunny-meadow.3': 'locked',
    'sunny-meadow.4': 'locked',
    'sunny-meadow.5': 'locked',
    'sunny-meadow.6': 'locked',
    'sunny-meadow.boss': 'locked',
  });
});

test('a child who leaves part-way keeps the levels placed so far, and is not asked again', async ({
  page,
}) => {
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  // The first step: four ×2 and ×5 facts; all four right places Sunny Meadow 2.
  for (let answer = 0; answer < 4; answer++) await answerCorrectly(page, 'keyboard');
  await expect(round(page), 'the check goes on to its next step').toBeVisible();
  await quitRound(page, 'Ada');
  await expect(
    page.getByTestId('hub-adventure'),
    'the check is not offered again; the concept level comes next',
  ).toHaveText('Play: Equal Groups');
  expect(await road(page)).toEqual({
    'sunny-meadow.1': 'next',
    'sunny-meadow.2': '1 stars',
    'sunny-meadow.3': 'open',
    'sunny-meadow.4': 'locked',
    'sunny-meadow.5': 'locked',
    'sunny-meadow.6': 'locked',
    'sunny-meadow.boss': 'locked',
  });
});
