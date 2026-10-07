/**
 * Activity coverage for the typed minigame boards not played by the older e2e suite: Memory
 * Match, Number Trail, Fact Family Nest and Egg Grid. Each board is solved from rendered cards,
 * stones, nest numbers or grid goals, with one wrong move kept as kind feedback first.
 */
import { expect, test } from './support/fixtures';
import { keeperWithRegions, playRound, results, startLevel } from './support/app';
import { unlessKnown } from './support/known-issues';
import {
  continueToNextActivity,
  playEggGridByTouch,
  playFactFamily,
  playMemoryMatch,
  playNumberTrail,
} from './support/activities';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(() => {
  test.setTimeout(600_000);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('Memory Match by touch: flip cards, turn back a mismatch, then pair facts', async ({
    page,
  }) => {
    await keeperWithRegions(page, 'Ada', ['whispering-woods']);
    await startLevel(page, 'whispering-woods', 'whispering-woods.3');
    await playRound(page, 'pointer');
    await continueToNextActivity(page);
    await playMemoryMatch(page, 'touch', 'value');
    await expect(results(page), 'the Memory Match ends on its results').toBeVisible();
  });

  test("Giant's Peaks Number Trail by touch: order the tens stones", async ({ page }) => {
    await keeperWithRegions(page, 'Ada', ['giants-peaks']);
    await startLevel(page, 'giants-peaks', 'giants-peaks.2');
    await playNumberTrail(page, 'touch');
    await expect(results(page), 'the tens Number Trail ends on its results').toBeVisible();
  });

  test('Egg Grid by touch: build a split five-plus array from the shown goal', async ({ page }) => {
    await keeperWithRegions(page, 'Ada', ['fire-mountain']);
    await startLevel(page, 'fire-mountain', 'fire-mountain.1');
    await playEggGridByTouch(page);
    await expect(results(page), 'the split Egg Grid ends on its results').toBeVisible();
  });
});

test('Memory Match by keyboard: focus cards and press Enter to match them', async ({ page }) => {
  await keeperWithRegions(page, 'Ada', ['fire-mountain']);
  await startLevel(page, 'fire-mountain', 'fire-mountain.5');
  await playRound(page, 'keyboard');
  await continueToNextActivity(page);
  await playMemoryMatch(page, 'keyboard', 'value');
  await expect(results(page), 'the keyboard Memory Match ends on its results').toBeVisible();
});

test('Fact Family Nest, then family Memory Match: complete × and : facts from the nest numbers', async ({
  page,
}) => {
  await keeperWithRegions(page, 'Ada', ['sharing-lake']);
  await startLevel(page, 'sharing-lake', 'sharing-lake.3');
  await playFactFamily(page, 'keyboard');
  await continueToNextActivity(page);
  await playMemoryMatch(page, 'keyboard', 'family');
  await expect(results(page), 'the family Memory Match ends on its results').toBeVisible();
});

test('Memory Match remainder cards: pair a division with its quotient and remainder', async ({
  page,
}) => {
  await keeperWithRegions(page, 'Ada', ['leftover-lagoon']);
  await startLevel(page, 'leftover-lagoon', 'leftover-lagoon.3');
  await playRound(page, 'keyboard');
  await continueToNextActivity(page);
  await playMemoryMatch(page, 'keyboard', 'value');
  await expect(results(page), 'the remainder Memory Match ends on its results').toBeVisible();
});

test('Memory Match term cards: pair term names with rendered example sentences', async ({
  page,
}, testInfo) => {
  await keeperWithRegions(page, 'Ada', ['riddle-ruins']);
  await startLevel(page, 'riddle-ruins', 'riddle-ruins.4');
  await playRound(page, 'keyboard');
  await continueToNextActivity(page);
  // The rules pair a term with an example whose number of that term is highlighted ("which is
  // 42 in 6 · 7 = 42?"): the card must show, and say, which number that is.
  let examples = 0;
  await playMemoryMatch(page, 'keyboard', 'term', async (card, face) => {
    if (!face.includes('=') || examples++ > 0) return;
    await unlessKnown(testInfo, 'DV-QA-17', async () => {
      await expect(
        card.locator('mark, [data-highlight], [class*="asked"], [class*="highlight"]'),
        `the example "${face}" marks the number its term names`,
      ).toHaveCount(1, { timeout: 2_000 });
      await expect(card, 'and its name says which number that is').toHaveAttribute(
        'aria-label',
        /highlight|marked|which/i,
        { timeout: 2_000 },
      );
    });
  });
  expect(examples, 'an example card was turned over').toBeGreaterThan(0);
  await expect(results(page), 'the term Memory Match ends on its results').toBeVisible();
});

test('Number Trail by keyboard: move each skip-counting stone into its gap', async ({ page }) => {
  await keeperWithRegions(page, 'Ada', ['fire-mountain']);
  await startLevel(page, 'fire-mountain', 'fire-mountain.3');
  await playRound(page, 'keyboard');
  await continueToNextActivity(page);
  await playNumberTrail(page, 'keyboard');
  await expect(results(page), 'the keyboard Number Trail ends on its results').toBeVisible();
});
