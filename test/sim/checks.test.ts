/**
 * The named balance checks judge simulation reports correctly: each passes a report that meets
 * its target and fails, naming what it measured, one that misses it. Synthetic reports keep these
 * tests instant; the long runs that feed the checks are `node scripts/simulate.mjs --check`.
 */
import { describe, expect, it } from 'vitest';
import type { DayReport, SimulationReport } from './driver';
import type { LearnerName } from './learners';
import { TARGETS, markdown, percent, runChecks, spread, summarise } from './report';

function day(index: number, patch: Partial<DayReport> = {}): DayReport {
  return {
    index,
    day: `2026-10-${String(5 + index).padStart(2, '0')}`,
    played: true,
    answers: 40,
    correct: 32,
    fast: 20,
    answerMs: 600_000,
    coins: 60,
    coinsBy: { answer: 32, quest: 28 },
    stickers: [],
    eggs: [],
    hatched: index === 0 ? ['bubbles'] : [],
    grew: [],
    levels: [],
    bosses: [],
    panes: 3,
    bought: [],
    cosmeticsOwned: 2,
    quests: 2,
    goalReached: true,
    giftOpened: true,
    dueAtStart: 10,
    maxOverdueAtStart: 2,
    mostOverdue: 'mul:7x8',
    commits: 100,
    ...patch,
  };
}

/** A report of a learner that meets every target, for 14 days. */
function report(learner: LearnerName, patch: Partial<SimulationReport> = {}): SimulationReport {
  const days = Array.from({ length: 14 }, (_, i) => day(i));
  return {
    learner,
    seed: 'test',
    daysSimulated: days.length,
    content: {
      revision: '1.0.0',
      levels: ['a.1', 'a.boss'],
      bosses: ['troll'],
      tableDragons: ['bubbles', 'sunny'],
      cosmetics: 6,
    },
    days,
    failures: [],
    stages: {
      bubbles: { hatchling: 0, adult: 10 },
      sunny: { hatchling: 1, adult: 12 },
    },
    finalStages: { bubbles: 'adult', sunny: 'adult' },
    window: { dim: 0, bronze: 0, silver: 121, gold: 0 },
    division: { dim: 0, bronze: 0, silver: 110, gold: 0 },
    dimFacts: [],
    dragons: {},
    stars: { 'a.1': 3, 'a.boss': 3 },
    eggDays: { bubbles: 0, sunny: 0 },
    bossDays: { troll: 3 },
    levelDays: { 'a.1': 0, 'a.boss': 3 },
    finaleDay: 3,
    coins: 800,
    cosmetics: 5,
    stickers: 10,
    overdue: [],
    ...patch,
  };
}

const check = (r: SimulationReport, id: string) => {
  const found = runChecks([r]).find((c) => c.id === id);
  if (!found) throw new Error(`no check ${id} for ${r.learner}`);
  return found;
};

describe('summaries', () => {
  it('computes medians and percentages with integer arithmetic', () => {
    expect(spread([5, 1, 3])).toEqual({ min: 1, median: 3, max: 5 });
    expect(spread([4, 1, 3, 2])).toEqual({ min: 1, median: 2, max: 4 });
    expect(percent(2, 3)).toBe(66);
    expect(percent(1, 0)).toBe(0);
    const s = summarise(report('average'));
    expect(s.sessions).toBe(14);
    expect(s.successPct).toBe(80);
    expect(s.coinsPerSession.median).toBe(60);
  });

  it('renders every check in the markdown report', () => {
    const r = report('average');
    const text = markdown([summarise(r)], runChecks([r]), { days: 14, seed: 'test' });
    expect(text).toContain('| average | 14 |');
    expect(text).toContain('PASS average: success per session within 70-90 %');
  });
});

describe('the balance checks pass a report that meets every target', () => {
  for (const learner of ['perfect', 'average', 'struggling', 'slow'] as const) {
    it(learner, () => {
      const patch: Partial<SimulationReport> =
        learner === 'perfect'
          ? {}
          : learner === 'slow'
            ? { window: { dim: 0, bronze: 0, silver: 121, gold: 0 } }
            : {};
      const failed = runChecks([report(learner, patch)]).filter((c) => !c.ok);
      expect(failed.map((c) => c.name)).toEqual([]);
    });
  }
});

describe('the balance checks fail, by name, a report that misses a target', () => {
  it('a rejected step', () => {
    const c = check(report('average', { failures: ['answer: no-problem'] }), 'accepted');
    expect(c.ok).toBe(false);
    expect(c.name).toContain('1 rejected: answer: no-problem');
  });

  it('no hatch in the first session', () => {
    const r = report('average');
    r.days[0] = day(0, { hatched: [] });
    expect(check(r, 'first-hatch').ok).toBe(false);
  });

  it('success outside 70-90 % in too many sessions, or a median outside the band', () => {
    const low = report('average');
    low.days = low.days.map((d, i) => (i < 4 ? d : day(i, { correct: 24 })));
    const lowCheck = check(low, 'success-band');
    expect(lowCheck.ok).toBe(false);
    expect(lowCheck.name).toContain('in 4 of 14 sessions (28 %');
    const high = report('average');
    high.days = high.days.map((d, i) => day(i, { correct: 38 }));
    expect(check(high, 'success-band').name).toContain('median 95 %');
    expect(check(high, 'success-band').ok).toBe(false);
  });

  it('a struggling child under 60 % success; at 60 % it passes, short of the 70-90 % stretch', () => {
    const ids = runChecks([report('struggling')]).map((c) => c.id);
    expect(ids, "the struggling child's own target, not the band").toContain('success-floor');
    expect(ids).not.toContain('success-band');
    const under = report('struggling');
    under.days = under.days.map((d, i) => day(i, { correct: 23 }));
    const c = check(under, 'success-floor');
    expect(c.ok).toBe(false);
    expect(c.name).toContain(
      'median success per session 57 %, at least 60 % (stretch 70-90 %: not reached; 0 of 14 sessions in it)',
    );
    const floor = report('struggling');
    floor.days = floor.days.map((d, i) => day(i, { correct: 24 }));
    expect(check(floor, 'success-floor').ok, 'a median of exactly 60 % passes').toBe(true);
    expect(check(floor, 'success-floor').name).toContain('stretch 70-90 %: not reached');
    expect(check(report('struggling'), 'success-floor').name).toContain(
      'median success per session 80 %, at least 60 % (stretch 70-90 %: reached; 14 of 14 sessions in it)',
    );
  });

  it('a session without coins', () => {
    const r = report('struggling');
    r.days[5] = day(5, { coins: 0 });
    expect(check(r, 'rewarded').name).toContain('13 of 14 sessions (fewest 0)');
    expect(check(r, 'rewarded').ok).toBe(false);
  });

  it('a week without any progress', () => {
    const r = report('struggling');
    r.days = r.days.map((d, i) => (i >= 7 ? day(i, { panes: 0 }) : d));
    expect(check(r, 'progress-weekly').name).toContain('in 1 of 2 weeks');
    expect(check(r, 'progress-weekly').ok).toBe(false);
  });

  it('a goal reached without the gift', () => {
    const r = report('average');
    r.days[3] = day(3, { giftOpened: false });
    expect(check(r, 'gift').ok).toBe(false);
  });

  it('an egg that waits too long to hatch, or never hatches', () => {
    const r = report('average', { eggDays: { bubbles: 0, sunny: 0, clover: 2 } });
    const c = check(r, 'hatch-pace');
    expect(c.ok).toBe(false);
    expect(c.name).toContain('clover never');
    const slow = report('average', {
      stages: { bubbles: { hatchling: 0 }, sunny: { hatchling: 9 } },
    });
    expect(check(slow, 'hatch-pace').name).toContain(`sunny ${10}`);
  });

  it('a level never completed, a boss never won over', () => {
    const r = report('average', { stars: { 'a.1': 2, 'a.boss': 0 }, bossDays: {} });
    expect(check(r, 'no-dead-end').name).toContain('completed 1 of 2 levels');
    expect(check(r, 'no-dead-end').ok).toBe(false);
    expect(check(r, 'bosses').name).toContain('won over 0 of 1 bosses');
    expect(check(r, 'bosses').ok).toBe(false);
  });

  it('a due fact that starves', () => {
    const r = report('average');
    r.days[9] = day(9, { maxOverdueAtStart: TARGETS.graceDays + 1, mostOverdue: 'word:sharing' });
    const c = check(r, 'no-starving');
    expect(c.ok).toBe(false);
    expect(c.name).toContain(`the longest: ${TARGETS.graceDays + 1} days, word:sharing on day 9`);
  });

  it('a table dragon that is not adult in time', () => {
    const late = report('average', {
      stages: { bubbles: { adult: 10 }, sunny: { adult: TARGETS.tablesAdultDays + 1 } },
    });
    expect(check(late, 'tables-mastered').ok).toBe(false);
    const never = report('average', { stages: { bubbles: { adult: 10 } } });
    expect(check(never, 'tables-mastered').name).toContain('1 of 2 adult');
    expect(check(never, 'tables-mastered').ok).toBe(false);
  });

  it('coins per session above the design range', () => {
    const r = report('average');
    r.days = r.days.map((d, i) => day(i, { coins: 150 }));
    expect(check(r, 'coins-pace').name).toContain('median of 150 coins');
    expect(check(r, 'coins-pace').ok).toBe(false);
  });

  it('a market emptied too soon', () => {
    const r = report('average');
    r.days = r.days.map((d, i) => day(i, { cosmeticsOwned: i >= 5 ? 6 : 2 }));
    expect(check(r, 'market-lasts').name).toContain('owned all 6 on day 5');
    expect(check(r, 'market-lasts').ok).toBe(false);
  });

  it('a slow child with gold panes or a crowned dragon', () => {
    const gold = report('slow', { window: { dim: 0, bronze: 0, silver: 100, gold: 21 } });
    expect(check(gold, 'fluency').ok).toBe(false);
    const crowned = report('slow', { finalStages: { bubbles: 'crowned' } });
    expect(check(crowned, 'fluency').ok).toBe(false);
  });

  it('a perfect child that reaches the finale late', () => {
    const r = report('perfect', { finaleDay: TARGETS.perfectFinaleDays });
    expect(check(r, 'perfect-pace').ok).toBe(false);
    expect(check(report('perfect', { finaleDay: null }), 'perfect-pace').name).toContain('never');
  });
});
