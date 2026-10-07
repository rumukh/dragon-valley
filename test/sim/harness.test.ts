/**
 * The simulation harness drives the real rules: a synthetic child plays its first session through
 * the runtime host without a rejected step, the day's report records what happened (answers,
 * success, coins by reason, the first hatch), and a mistake is made for every kind of answer.
 *
 * Gate-sized on purpose (a short first session of two children: each commit costs tens of
 * milliseconds with the v1 pack). The long runs and the named balance checks are
 * `node scripts/simulate.mjs --check` (docs/balance-report.md).
 */
import { afterAll, describe, expect, it } from 'vitest';
import type { AnswerValue, GameView, ProblemRoundView } from '../../src/rules/contract';
import {
  KNOWN_BOX,
  dueAtSessionStart,
  emptyDay,
  marketAtEnd,
  mistake,
  overdueKnown,
  simulate,
  tallyEvents,
} from './driver';
import type { AnswerRecord, SimulationReport } from './driver';

const runs = new Map<string, Promise<SimulationReport>>();
const answers = new Map<string, AnswerRecord[]>();
const firstSession = (learner: 'perfect' | 'struggling') => {
  let report = runs.get(learner);
  if (!report) {
    const records: AnswerRecord[] = [];
    answers.set(learner, records);
    report = simulate(learner, 1, {
      seed: 'harness',
      answersPerDay: 24,
      onAnswer: (record) => records.push(record),
    });
    runs.set(learner, report);
  }
  return report;
};
afterAll(() => {
  runs.clear();
  answers.clear();
});

describe('the learner simulation', () => {
  it('plays a perfect first session: every answer right and quick, coins, the first hatch', async () => {
    const report = await firstSession('perfect');
    const day = report.days[0]!;
    expect(report.failures, 'rejected steps').toEqual([]);
    expect(day.answers, 'answers').toBeGreaterThanOrEqual(24);
    expect(day.correct, 'right answers').toBe(day.answers);
    expect(day.fast, 'quick answers').toBe(day.correct);
    expect(
      day.coinsBy['answer'],
      'a coin per right answer, more with boards',
    ).toBeGreaterThanOrEqual(day.correct);
    expect(day.hatched.length, 'eggs hatched in the first session').toBeGreaterThan(0);
    expect(day.bought.length, 'bought a cosmetic in the market').toBeGreaterThan(0);
    expect(day.cosmeticsOwned, 'owns what it bought').toBeGreaterThanOrEqual(day.bought.length);
    expect(report.levelDays['sunny-meadow.1'], 'Sunny Meadow 1 completed on day 0').toBe(0);
  });

  it('plays a struggling first session without a rejected step, with misses and coins', async () => {
    const report = await firstSession('struggling');
    const day = report.days[0]!;
    expect(report.failures, 'rejected steps').toEqual([]);
    expect(day.correct, 'some answers right').toBeGreaterThan(0);
    expect(day.correct, 'some answers wrong').toBeLessThan(day.answers);
    expect(day.fast, 'no quick answers').toBe(0);
    expect(day.coins, 'coins earned').toBeGreaterThan(0);
  });

  it('records every answer with the item, its tier and box before it, and the recall', async () => {
    const day = (await firstSession('struggling')).days[0]!;
    const records = answers.get('struggling')!;
    const graded = records.filter((r) => r.step === 'answer');
    expect(graded.length, 'a record per graded answer').toBe(day.answers);
    expect(graded.filter((r) => r.right).length, 'right answers').toBe(day.correct);
    const firsts = graded.filter((r, i) => graded.findIndex((o) => o.item === r.item) === i);
    // A board (the Egg Grid) may credit a fact before its first problem: then it is in box 0-1.
    expect(
      firsts.filter((r) => r.tier !== 'learning' || (r.box ?? 0) > 1).map((r) => r.item),
      "an item's first answer: a learning item, in box 0-1 at most",
    ).toEqual([]);
    expect(
      firsts.filter((r) => r.box === null).length,
      'most first answers find no box yet',
    ).toBeGreaterThan(firsts.length / 2);
    const again = graded.filter((r, i) => graded.findIndex((o) => o.item === r.item) !== i);
    expect(again.length, 'some items come back (re-asks, reviews)').toBeGreaterThan(0);
    expect(
      again.filter((r) => r.box === null).map((r) => r.item),
      'an item answered before has a box',
    ).toEqual([]);
    expect(
      records.filter((r) => r.day !== 0 || r.recall < 0 || r.recall > 100),
      'day 0, recall 0-100',
    ).toEqual([]);
    expect(
      records.some((r) => r.protected),
      'the mix protects the struggling child once its success drops',
    ).toBe(true);
    await firstSession('perfect');
    expect(
      answers.get('perfect')!.filter((r) => r.protected).length,
      'a child who is always right is never protected',
    ).toBe(0);
  });
});

describe('the market a day report records', () => {
  it('tallies purchases, gifted cosmetics and gift coins from the day events', () => {
    const entry = emptyDay(3, '2026-10-08', true);
    const report = {
      eggDays: {},
      stages: {},
      levelDays: {},
      bossDays: {},
    } as unknown as SimulationReport;
    tallyEvents(report, entry, [
      { type: 'item.purchased', data: { item: 'bow-tie', price: 20 } },
      { type: 'gift.opened', data: { grant: { kind: 'cosmetic', item: 'hat-party' } } },
      { type: 'gift.opened', data: { grant: { kind: 'coins', amount: 9 } } },
      { type: 'coins.earned', data: { amount: 9, reason: 'gift' } },
    ]);
    expect(entry).toMatchObject({
      bought: ['bow-tie'],
      gifted: ['hat-party'],
      giftOpened: true,
      coins: 9,
      coinsBy: { gift: 9 },
    });
  });

  it('counts unlocked, unowned items, and those dearer than the coins left', () => {
    const item = (id: string, price: number, available: boolean, owned: boolean) =>
      ({
        id,
        price,
        available,
        owned,
        affordable: price <= 40,
      }) as GameView['market']['items'][number];
    const view = {
      coins: 40,
      market: {
        items: [
          item('owned', 15, true, true),
          item('exactly-affordable', 40, true, false),
          item('dear', 41, true, false),
          item('locked-dear', 300, false, false),
        ],
      },
    };
    expect(marketAtEnd(view)).toEqual({ coinsAtEnd: 40, forSale: 2, toSaveFor: 1 });
  });
});

describe('the known facts the no-starving check watches', () => {
  it('counts facts at bronze and up (box 2+) past their review day, most overdue first', () => {
    expect(KNOWN_BOX, 'bronze is box 2').toBe(2);
    const items = {
      'mul:7x8': { box: 1, due: 80 },
      'div:56:7': { box: 2, due: 91 },
      'mul:6x7': { box: 5, due: 95 },
      'word:sharing': { box: 3, due: 91 },
      'mul:3x4': { box: 4, due: 101 },
    };
    expect(
      overdueKnown(items, 100),
      'box 1 is still being learned; not due yet is not overdue',
    ).toEqual([
      { item: 'div:56:7', days: 9 },
      { item: 'word:sharing', days: 9 },
      { item: 'mul:6x7', days: 5 },
    ]);
    expect(overdueKnown(items, 101)).toContainEqual({ item: 'mul:3x4', days: 0 });
    expect(dueAtSessionStart(items, 100), 'what a session start records').toEqual({
      dueAtStart: 3,
      maxOverdueAtStart: 9,
      mostOverdue: 'div:56:7',
    });
    expect(dueAtSessionStart({ 'mul:7x8': { box: 1, due: 80 } }, 100)).toEqual({
      dueAtStart: 0,
      maxOverdueAtStart: 0,
      mostOverdue: null,
    });
  });
});

describe('mistakes', () => {
  const view = (choices: AnswerValue[] | null): ProblemRoundView =>
    ({
      problem: {
        index: 1,
        item: 'rem:d5',
        problem: { kind: 'divrem', dividend: 23, divisor: 5 },
        input: choices ? 'choice' : 'keypad',
        choices,
        step: 'answer',
        reask: false,
        hinted: false,
      },
    }) as unknown as ProblemRoundView;

  it('picks another offered choice, or a near miss of any kind of answer', () => {
    const right: AnswerValue = { kind: 'remainder', quotient: 4, remainder: 3 };
    const wrong: AnswerValue = { kind: 'remainder', quotient: 3, remainder: 8 };
    expect(mistake(view([right, wrong]), right)).toEqual(wrong);
    const answers: AnswerValue[] = [
      { kind: 'number', value: 56 },
      right,
      { kind: 'operation', operation: 'mul' },
      { kind: 'relation', relation: 'eq' },
      { kind: 'term', term: 'product' },
    ];
    for (const answer of answers) {
      expect(mistake(view(null), answer), answer.kind).not.toEqual(answer);
      expect(mistake(view(null), answer).kind, answer.kind).toBe(answer.kind);
    }
  });
});
