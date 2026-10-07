/**
 * Bosses and the finale (plan §2.6; docs/app.md §14): a boss round shows a mood meter
 * (`boss-meter`, an ARIA meter such as "Happy meter", "3 of 15") that a right answer fills by
 * one and a miss leaves as it is; the boss is won over when it is full. The Seven-Headed Dragon,
 * the finale, is won over head by head: its meter is shared evenly between its seven heads
 * (21 = 7 × 3) and each head asks one skill of the finale's activity, in order (the rules'
 * `chooseItem`: head = ⌊value × heads / target⌋). Everything is read from the screen: the meter's
 * value before each problem, and the problem's own form (support/problem.ts).
 */
import { expect, test } from './support/fixtures';
import {
  answerCorrectly,
  answerWrongly,
  goOn,
  keeperWithRegions,
  playRound,
  results,
  startLevel,
  throughHatches,
} from './support/app';
import type { Played } from './support/app';

test.use({ reducedMotion: 'reduce' });

test("a region boss: the Forest Witch's meter fills with each right answer, holds on a miss, and she is won over", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await keeperWithRegions(page, 'Ada', ['whispering-woods']);
  await startLevel(page, 'whispering-woods', 'whispering-woods.boss');
  const meter = page.getByTestId('boss-meter');
  await expect(meter, 'the witch has a happy meter').toHaveAttribute('aria-label', 'Happy meter');
  await expect(meter, 'it fills at 15').toHaveAttribute('aria-valuemax', '15');
  await expect(meter, 'it starts empty').toHaveAttribute('aria-valuenow', '0');
  await expect(meter, 'and says how full it is').toContainText('0 of 15');

  await answerCorrectly(page, 'keyboard');
  await expect(meter, 'a right answer fills it by one').toHaveAttribute('aria-valuenow', '1');
  await answerWrongly(page, 'keyboard');
  await expect(meter, 'a miss leaves it as it is').toHaveAttribute('aria-valuenow', '1');
  await goOn(page);

  const played = await playRound(page, 'keyboard');
  const values = played.map((item) => item.meter);
  expect(values, 'each right answer filled the meter by one more').toEqual(
    values.map((_, index) => 1 + index),
  );
  expect(played.length, 'she was won over when the meter was full').toBe(14);
  await expect(results(page)).toBeVisible();
  await throughHatches(page);
  await expect(page.getByTestId('results-title')).toBeVisible();
});

/** The finale's seven skills, one per head, as the screen shows them. */
const HEADS = [
  'times tables',
  'division',
  'division with a remainder',
  'two-digit × one-digit',
  'order of operations',
  'comparison',
  'story',
] as const;
type Head = (typeof HEADS)[number];

function kindOf(item: Played): Head | 'other' {
  const signs = item.tokens.flatMap((token) => (token.kind === 'op' ? [token.op] : []));
  const equals = item.tokens.findIndex((token) => token.kind === 'equals');
  const operands = item.tokens
    .slice(0, equals < 0 ? undefined : equals)
    .flatMap((token) => (token.kind === 'number' ? [token.value] : []));
  if (item.story !== '') return 'story';
  if (item.answer.kind === 'relation') return 'comparison';
  if (item.answer.kind === 'remainder') return 'division with a remainder';
  if (signs.length >= 2) return 'order of operations';
  if (signs.join() === 'mul') {
    if (operands.every((n) => n <= 10)) return 'times tables';
    return operands.some((n) => n >= 11 && n <= 99) && operands.some((n) => n >= 2 && n <= 9)
      ? 'two-digit × one-digit'
      : 'other';
  }
  if (signs.join() === 'div') return 'division';
  return 'other';
}

test('the finale: the Seven-Headed Dragon is won over head by head, one skill per head', async ({
  page,
}, testInfo) => {
  test.setTimeout(480_000);
  await keeperWithRegions(page, 'Ada', ['dragon-castle']);
  await startLevel(page, 'dragon-castle', 'dragon-castle.boss');
  const meter = page.getByTestId('boss-meter');
  await expect(meter, 'the dragon has one meter for its seven heads').toHaveAttribute(
    'aria-valuemax',
    '21',
  );
  const played = await playRound(page, 'keyboard');
  testInfo.annotations.push({
    type: 'problems asked',
    description: played.map((item) => `${item.meter}: ${item.written}`).join(' | '),
  });
  const heads = played.map((item) => Math.floor(((item.meter ?? 0) * 7) / 21));
  const asked = played.map(kindOf);
  expect(
    asked,
    'every head asked its own skill, in order: tables, division, remainders, two-digit × one-digit, order of operations, comparisons, stories',
  ).toEqual(heads.map((head) => HEADS[head]));
  expect(new Set(heads).size, 'all seven heads were won over').toBe(7);
  expect(Math.max(...played.map((item) => item.meter ?? 0)), 'the meter filled up').toBe(20);
  await expect(results(page)).toBeVisible();
  await throughHatches(page);
  await expect(page.getByTestId('results-title')).toBeVisible();
  testInfo.annotations.push({
    type: 'finale results',
    description: (await page.getByTestId('round-results').innerText()).replace(/\s+/g, ' '),
  });
});
