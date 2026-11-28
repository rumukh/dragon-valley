/**
 * A phone held upright: a round, Memory Match and the results each fit one screen (docs/app.md
 * §7), so no answer, key or "Turn back" starts below the fold and no reward hides in a list that
 * scrolls. The Android emulator QA (2026-11-27) found all four out of view at 411 × 731, a Pixel
 * 2's screen; 360 × 640 is the smallest phone checked. Young players' bigger numerals and words
 * fit as well.
 */
import { expect, test } from './support/fixtures';
import type { Locator, Page } from '@playwright/test';
import {
  answerCorrectly,
  answerMode,
  awaitOpenProblem,
  leaveHub,
  leaveResults,
  loadBackup,
  newFamily,
  playAs,
  results,
  round,
  startLevel,
  startPlacement,
  throughHatches,
} from './support/app';
import { continueToNextActivity } from './support/activities';
import { brookBackupBefore } from './support/saves';
import { settle } from './support/screens';

test.use({ reducedMotion: 'reduce' });

const PHONES = [
  { width: 411, height: 731 },
  { width: 360, height: 640 },
] as const;

/**
 * At each phone size the page needs no scrolling, every part lies wholly on the screen, and no
 * list scrolls inside it.
 */
async function expectOneScreen(
  page: Page,
  what: string,
  parts: Locator,
  lists: readonly Locator[] = [],
): Promise<void> {
  for (const phone of PHONES) {
    await page.setViewportSize(phone);
    await settle(page);
    const where = `${what} at ${phone.width} × ${phone.height}`;
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight), {
        message: `${where} needs no scrolling`,
      })
      .toBeLessThanOrEqual(phone.height);
    const boxes = await parts.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        const name = element.getAttribute('data-testid') ?? element.textContent?.trim();
        return { name, top: box.top, bottom: box.bottom };
      }),
    );
    expect(boxes.length, `${where}: its parts are on the page`).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.top, `${where}: ${box.name} starts on the screen`).toBeGreaterThanOrEqual(-0.5);
      expect(box.bottom, `${where}: ${box.name} ends on the screen`).toBeLessThanOrEqual(
        phone.height + 0.5,
      );
    }
    for (const list of lists) {
      expect(
        await list.evaluate((node) => node.scrollHeight - node.clientHeight),
        `${where}: nothing in the list is scrolled out of view`,
      ).toBeLessThanOrEqual(1);
    }
  }
  await page.setViewportSize(PHONES[0]);
}

async function playToResults(page: Page): Promise<void> {
  for (let answered = 0; answered < 30 && (await round(page).isVisible()); answered++) {
    await answerCorrectly(page, 'pointer');
  }
  await expect(results(page)).toBeVisible();
}

test('a 3rd grader on a phone: the placement check, its rewards, Feeding Time and Memory Match each fit one screen', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize(PHONES[0]);
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  // Three right answers in a row: the streak shows, and the screen still fits.
  for (let answered = 0; answered < 3; answered++) await answerCorrectly(page, 'pointer');
  await awaitOpenProblem(page);
  await expect(page.getByTestId('streak'), 'a streak is shown').toHaveText(/in a row/);
  expect(await answerMode(page), 'the placement check is answered on the keypad').toBe('keypad');
  await expectOneScreen(
    page,
    'the placement check',
    page.locator(
      '[data-testid="problem"], [data-testid="keypad-display"], [data-testid^="keypad-"]:is(button), [data-testid="streak"]',
    ),
  );

  await playToResults(page);
  await throughHatches(page);
  await expectOneScreen(
    page,
    "the placement check's results",
    page.locator('[data-testid^="celebrate-"], [data-testid="results-continue"]'),
    [page.getByTestId('results-celebrations')],
  );
  await leaveResults(page, 'Ada');

  await startLevel(page, 'sunny-meadow', 'sunny-meadow.2');
  await awaitOpenProblem(page);
  expect(await answerMode(page), 'Twos and Fives is answered with choices').toBe('choice');
  await expectOneScreen(
    page,
    'Feeding Time',
    page.locator('[data-testid="problem"], [data-testid^="choice-"]'),
  );

  await playToResults(page);
  await continueToNextActivity(page);
  const cards = page.getByTestId('match-grid').getByRole('button');
  const turnBack = page.getByTestId('match-turn-back');
  for (let first = 0; first + 1 < (await cards.count()); first += 2) {
    await cards.nth(first).click();
    await cards.nth(first + 1).click();
    await expect(cards.nth(first + 1)).not.toHaveAttribute('data-state', 'hidden');
    if ((await turnBack.count()) > 0) break;
  }
  await expect(turnBack, 'two cards that are not a pair wait to be turned back').toBeVisible();
  await expectOneScreen(
    page,
    'Memory Match',
    page.locator('[data-testid^="match-card-"], [data-testid="match-turn-back"]'),
  );
});

for (const [level, mode] of [
  ['pebble-brook.5', 'keypad'],
  ['pebble-brook.3', 'choice'],
] as const) {
  test(`a 1st grader on a phone: ${level}, answered ${mode === 'keypad' ? 'on the keypad' : 'with choices'}, fits one screen`, async ({
    page,
  }) => {
    test.slow();
    const backup = await brookBackupBefore(level);
    await page.setViewportSize(PHONES[0]);
    await newFamily(page, { name: 'Lea' });
    await leaveHub(page);
    await loadBackup(page, backup, 'Lea');
    await playAs(page, 1, 'Lea');
    await startLevel(page, 'pebble-brook', level);
    await awaitOpenProblem(page);
    expect(await answerMode(page)).toBe(mode);
    await expectOneScreen(
      page,
      level,
      page.locator(
        '[data-testid="problem"], [data-testid="keypad-display"], [data-testid^="keypad-"]:is(button), [data-testid^="choice-"]',
      ),
    );
  });
}
