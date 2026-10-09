/**
 * The simulation drives younger children through a grades 1-3 fixture pack (grade-pack.ts): a
 * 1st grader and a 2nd grader play a short run without a rules failure, start in their own
 * grade's region and are never sent to a later grade's. A smoke test of the grade rules with the
 * synthetic learners; the balance study for grades 1-2 waits for the real regions (G3 Content).
 */
import { describe, expect, it, vi } from 'vitest';
import { GRADE_STARTS, gradePack } from '../unit/progression/grade-pack';
import { simulate } from './driver';

vi.setConfig({ testTimeout: 300_000 });

describe('younger learners in the simulation', () => {
  const pack = gradePack();

  for (const [learner, grade] of [
    ['first-grader', 1],
    ['second-grader', 2],
  ] as const) {
    it(`a ${learner} plays from the grade ${grade} start without rules failures`, async () => {
      const report = await simulate(learner, 7, { pack, grade, answersPerDay: 20 });
      expect(report.failures).toEqual([]);
      const answers = report.days.reduce((sum, day) => sum + day.answers, 0);
      expect(answers).toBeGreaterThan(0);
      const levels = Object.keys(report.levelDays);
      expect(levels.length).toBeGreaterThan(0);
      expect(levels[0]!.startsWith(`${GRADE_STARTS[grade]}.`), levels.join()).toBe(true);
      const later = grade === 1 ? [GRADE_STARTS[2], GRADE_STARTS[3]] : [GRADE_STARTS[3]];
      for (const region of later) {
        expect(
          levels.some((level) => level.startsWith(`${region}.`)),
          region,
        ).toBe(false);
      }
    });
  }
});
