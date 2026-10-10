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

describe('a 1st grader in the shipped Pebble Brook', () => {
  it('hatches every brook dragon, beats the Will-o-Wisps and walks on to Hundred Hills', async () => {
    const report = await simulate('first-grader', 8, { grade: 1, answersPerDay: 25 });
    expect(report.failures).toEqual([]);
    const days = report.days.filter((day) => day.played);
    expect(days[0]!.hatched.length, 'the first egg hatches in the first session').toBe(1);
    const hatched = days.flatMap((day) => day.hatched);
    for (const dragon of ['dot', 'hop', 'nibble']) expect(hatched, dragon).toContain(dragon);
    expect(days.flatMap((day) => day.bosses)).toContain('will-o-wisps');
    expect(Object.keys(report.levelDays)).toContain('hundred-hills.1');
    const answers = days.reduce((sum, day) => sum + day.answers, 0);
    const correct = days.reduce((sum, day) => sum + day.correct, 0);
    const success = (correct * 100) / answers;
    expect(success).toBeGreaterThanOrEqual(65);
    expect(success).toBeLessThanOrEqual(95);
  });
});

describe('a 2nd grader in the shipped Hundred Hills and Market Square', () => {
  it('hatches the first egg on day one, beats both grade 2 bosses and walks on to Sunny Meadow', async () => {
    const report = await simulate('second-grader', 14, { grade: 2, answersPerDay: 35 });
    expect(report.failures).toEqual([]);
    const days = report.days.filter((day) => day.played);
    expect(days[0]!.hatched.length, 'the first egg hatches in the first session').toBeGreaterThan(0);
    const hatched = days.flatMap((day) => day.hatched);
    for (const dragon of ['bead', 'tumble', 'penny']) expect(hatched, dragon).toContain(dragon);
    const bosses = days.flatMap((day) => day.bosses);
    expect(bosses).toContain('long-broad-sharp-eyes');
    expect(bosses).toContain('otesanek');
    expect(Object.keys(report.levelDays)).toContain('sunny-meadow.1');
    const answers = days.reduce((sum, day) => sum + day.answers, 0);
    const correct = days.reduce((sum, day) => sum + day.correct, 0);
    const success = (correct * 100) / answers;
    expect(success).toBeGreaterThanOrEqual(65);
    expect(success).toBeLessThanOrEqual(95);
  });
});
