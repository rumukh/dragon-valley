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
import type { AnswerValue, ProblemRoundView } from '../../src/rules/contract';
import { mistake, simulate } from './driver';
import type { SimulationReport } from './driver';

const runs = new Map<string, Promise<SimulationReport>>();
const firstSession = (learner: 'perfect' | 'struggling') => {
  let report = runs.get(learner);
  if (!report) {
    report = simulate(learner, 1, { seed: 'harness', answersPerDay: 24 });
    runs.set(learner, report);
  }
  return report;
};
afterAll(() => runs.clear());

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
