/**
 * The whole valley (v1 content, plan §4): each region played. The grown-ups open the region
 * early ("Game settings", which opens every level of it), so each test goes straight to a level
 * whose first activity brings the region's own kind of problem, and plays the whole activity with
 * the answer oracle (support/problem.ts) to its results:
 *
 * | Region           | Level, activity                   | Every problem is…                        |
 * | ---------------- | --------------------------------- | ---------------------------------------- |
 * | Whispering Woods | 6, Riddle Scrolls                 | a story: its sign first, then its number |
 * | Fire Mountain    | 3, Feeding Time                   | a number to find (the whole round)       |
 * | Crystal Caves    | 6, Riddle Scrolls                 | a story: its sign first, then its number |
 * | Sharing Lake     | 5, Riddle Scrolls                 | a story: its sign first, then its number |
 * | Leftover Lagoon  | 2, Feeding Time (tapped)          | a division with a remainder (`? r ?`)    |
 * | Giant's Peaks    | 1, Feeding Time                   | a multiplication by 10 or 100            |
 * | Giant's Peaks    | 4, Feeding Time (keypad)          | two-digit × one-digit                    |
 * | Riddle Ruins     | 3, Compare Stones                 | a comparison (`<` `>` `=`, brackets too) |
 * | Riddle Ruins     | 4, Feeding Time                   | a term question                          |
 * | Dragon Castle    | 3, Feeding Time                   | answered (what is asked depends on the   |
 * |                  |                                   | keeper's focus egg: see the case)        |
 *
 * Sunny Meadow is the placement check's and the earlier specs' ground; the boards (Sharing Feast,
 * Golem Orders) are boards.spec.ts's, the bosses and the finale bosses.spec.ts's.
 */
import { expect, test } from './support/fixtures';
import type { TestInfo } from '@playwright/test';
import { keeperWithRegions, playRound, results, startLevel, throughHatches } from './support/app';
import type { Played, Via } from './support/app';

test.use({ reducedMotion: 'reduce' });

interface Case {
  readonly region: string;
  readonly level: string;
  readonly title: string;
  readonly via: Via;
  /** What the activity must have asked, as a bug report would say it. */
  readonly must: string;
  readonly saw: (played: readonly Played[]) => boolean;
}

const numbers = (item: Played): number[] =>
  item.tokens.flatMap((token) => (token.kind === 'number' ? [token.value] : []));
const signs = (item: Played): string[] =>
  item.tokens.flatMap((token) => (token.kind === 'op' ? [token.op] : []));

/** Every story asked its sign first (`8 ○ 2 = ?`), then its number under the same story. */
function signThenNumber(played: readonly Played[]): boolean {
  const signSteps = played.flatMap((item, index) => (item.step === 'operation' ? [index] : []));
  return (
    signSteps.length > 0 &&
    signSteps.every((index) => {
      const next = played[index + 1];
      return next?.step === 'answer' && next.story === played[index]!.story;
    })
  );
}

const CASES: readonly Case[] = [
  {
    region: 'whispering-woods',
    level: 'whispering-woods.6',
    title: "Whispering Woods: Riddle Scrolls ask a story's sign, then its number",
    via: 'keyboard',
    must: 'each story its sign first, then its number',
    saw: signThenNumber,
  },
  {
    region: 'fire-mountain',
    level: 'fire-mountain.3',
    title: 'Fire Mountain: a whole Feeding Time',
    via: 'pointer',
    must: 'numbers only, every one answered',
    saw: (played) => played.every((item) => item.answer.kind === 'number'),
  },
  {
    region: 'crystal-caves',
    level: 'crystal-caves.6',
    title: 'Crystal Caves: Riddle Scrolls with sharing and grouping stories',
    via: 'pointer',
    must: 'each story its sign first, then its number',
    saw: signThenNumber,
  },
  {
    region: 'sharing-lake',
    level: 'sharing-lake.5',
    title: 'Sharing Lake: Riddle Scrolls tell "more than" from "times as many"',
    via: 'keyboard',
    must: 'each story its sign first, then its number',
    saw: signThenNumber,
  },
  {
    region: 'leftover-lagoon',
    level: 'leftover-lagoon.2',
    title: 'Leftover Lagoon: Feeding Time divides with a remainder, tapped on the keypad',
    via: 'pointer',
    must: 'only divisions answered as "quotient r remainder"',
    saw: (played) => played.every((item) => item.answer.kind === 'remainder'),
  },
  {
    region: 'giants-peaks',
    level: 'giants-peaks.1',
    title: "Giant's Peaks: Feeding Time with ×10 and ×100",
    via: 'pointer',
    must: 'only multiplications by 10 or 100',
    saw: (played) =>
      played.every(
        (item) => signs(item).join() === 'mul' && numbers(item).some((n) => n === 10 || n === 100),
      ),
  },
  {
    region: 'giants-peaks',
    level: 'giants-peaks.4',
    title: "Giant's Peaks: a two-digit number times a one-digit number, on the keypad",
    via: 'keyboard',
    must: 'only two-digit × one-digit multiplications',
    saw: (played) =>
      played.every((item) => {
        const [a = 0, b = 0] = numbers(item);
        return (
          signs(item).join() === 'mul' &&
          ((a >= 11 && a <= 99 && b >= 2 && b <= 9) || (b >= 11 && b <= 99 && a >= 2 && a <= 9))
        );
      }),
  },
  {
    region: 'riddle-ruins',
    level: 'riddle-ruins.3',
    title: 'Riddle Ruins: Compare Stones ask for <, > or =',
    via: 'pointer',
    must: 'only comparisons, answered with a sign',
    saw: (played) => played.every((item) => item.answer.kind === 'relation'),
  },
  {
    region: 'riddle-ruins',
    level: 'riddle-ruins.4',
    title: 'Riddle Ruins: Feeding Time names the terms (factor, product, dividend…)',
    via: 'keyboard',
    must: 'only term questions',
    saw: (played) => played.every((item) => item.answer.kind === 'term'),
  },
  {
    region: 'dragon-castle',
    level: 'dragon-castle.3',
    title: 'Dragon Castle: a whole Feeding Time',
    via: 'pointer',
    // Seven skills, but a keeper still learning is served their focus egg's facts first
    // (selection.ts, pickLearning): the kinds asked depend on the keeper, so only the play is
    // checked here; the finale (bosses.spec.ts) serves its skills head by head.
    must: 'every problem answered',
    saw: (played) => played.length > 0,
  },
];
function record(testInfo: TestInfo, played: readonly Played[]): void {
  testInfo.annotations.push({
    type: 'problems asked',
    description: played
      .map((item) => (item.story ? `[story, ${item.step}] ${item.written}` : item.written))
      .join(' | '),
  });
}

for (const item of CASES) {
  test(item.title, async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await keeperWithRegions(page, 'Ada', [item.region]);
    await startLevel(page, item.region, item.level);
    await expect(page.getByTestId('screen-round'), 'the activity is a problem round').toBeVisible();
    const played = await playRound(page, item.via);
    record(testInfo, played);
    expect(played.length, 'the activity asked problems').toBeGreaterThan(0);
    expect(item.saw(played), `${item.level} asked ${item.must}`).toBe(true);
    await expect(results(page)).toBeVisible();
    await throughHatches(page);
    await expect(page.getByTestId('results-title'), 'the results say how it went').toBeVisible();
  });
}
