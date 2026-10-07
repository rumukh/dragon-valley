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
    levels: index === 0 ? ['a.1'] : index === 3 ? ['a.boss'] : [],
    bosses: [],
    panes: 3,
    bought: index % 4 === 0 ? [`cosmetic-${index}`] : [],
    cosmeticsOwned: 2,
    gifted: [],
    coinsAtEnd: 40,
    forSale: 3,
    toSaveFor: 2,
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
      regions: [{ id: 'a', lessons: ['a.1'], boss: 'troll' }],
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
    const header = (reading?: boolean) =>
      markdown([summarise(r)], runChecks([r]), { days: 14, seed: 'test', reading }).split('\n')[0];
    expect(header(true)).toBe('# Learner simulation: 14 days, seed "test", reading modelled');
    expect(header(false)).toBe('# Learner simulation: 14 days, seed "test", without reading');
    expect(header(undefined)).toBe('# Learner simulation: 14 days, seed "test"');
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

  it('a market with nothing left to save for before 110 sessions', () => {
    const short = report('average');
    short.days = short.days.map((d, i) => day(i, { toSaveFor: i >= 11 ? 0 : 2 }));
    const c = check(short, 'market-lasts');
    expect(c.ok).toBe(false);
    expect(c.name).toContain(
      'after 11 of 14 sessions (target 110; a run this short must end with one)',
    );
    const endsEmpty = report('average');
    endsEmpty.days = endsEmpty.days.map((d, i) => day(i, { toSaveFor: i === 13 ? 0 : 2 }));
    expect(check(endsEmpty, 'market-lasts').ok, 'a short run must end with something').toBe(false);
    const year = (until: number) =>
      report('average', {
        days: Array.from({ length: 200 }, (_, i) => day(i, { toSaveFor: i < until ? 1 : 0 })),
      });
    expect(check(year(110), 'market-lasts').ok, 'something to save for until session 110').toBe(
      true,
    );
    expect(check(year(109), 'market-lasts').name).toContain('after 109 of 200 sessions');
    expect(check(year(109), 'market-lasts').ok).toBe(false);
  });

  /** A report of `days` days with a purchase on the days `buys` picks. */
  const buying = (learner: LearnerName, days: number, buys: (i: number) => boolean) =>
    report(learner, {
      days: Array.from({ length: days }, (_, i) => day(i, { bought: buys(i) ? ['hat'] : [] })),
    });

  it('new cosmetics too rarely for the average child, a long drought, or none at all', () => {
    const rare = buying('average', 30, (i) => i % 7 === 0);
    expect(check(rare, 'market-pace').name).toContain(
      'every 7 sessions (median of 5 waits, at most 6; the longest 7, at most 10)',
    );
    expect(check(rare, 'market-pace').ok, 'every 7 sessions is too rare').toBe(false);
    const six = buying('average', 30, (i) => i % 6 === 0);
    expect(check(six, 'market-pace').name).toContain('every 6 sessions');
    expect(check(six, 'market-pace').ok, 'a median of exactly 6 passes').toBe(true);
    const drought = report('average');
    drought.days = drought.days.map((d, i) =>
      day(i, { bought: [0, 1, 2, 3].includes(i) ? ['hat'] : [] }),
    );
    expect(check(drought, 'market-pace').name, 'cosmetics still missing at the end').toContain(
      'the longest 10, at most 10',
    );
    expect(check(drought, 'market-pace').ok, 'a wait of exactly 10 passes').toBe(true);
    const owned = report('average');
    owned.days = owned.days.map((d, i) =>
      day(i, { bought: [0, 1, 2, 3].includes(i) ? ['hat'] : [], cosmeticsOwned: 6 }),
    );
    expect(check(owned, 'market-pace').name, 'nothing left to wait for').toContain(
      'every 1 sessions (median of 3 waits',
    );
    const gifts = report('average');
    gifts.days = gifts.days.map((d, i) =>
      day(i, { bought: [], gifted: i % 3 === 0 ? ['bow'] : [] }),
    );
    expect(check(gifts, 'market-pace').ok, 'a gifted cosmetic is something new').toBe(true);
    const none = report('average');
    none.days = none.days.map((d, i) => day(i, { bought: [] }));
    expect(check(none, 'market-pace').ok).toBe(false);
    const long = buying('average', 30, (i) => [0, 1, 2, 3, 4, 5, 18].includes(i));
    expect(check(long, 'market-pace').name).toContain(
      'every 1 sessions (median of 7 waits, at most 6; the longest 13, at most 10)',
    );
    expect(check(long, 'market-pace').ok, 'a quick median does not hide a drought').toBe(false);
  });

  it('the slow child waits at most 8 sessions, the struggling child 12 (median)', () => {
    expect(
      check(
        buying('slow', 40, (i) => i % 8 === 0),
        'market-pace',
      ).ok,
      'slow: 8',
    ).toBe(true);
    const slow = check(
      buying('slow', 30, (i) => i % 9 === 0),
      'market-pace',
    );
    expect(slow.ok, 'slow: 9').toBe(false);
    expect(slow.name).toContain('every 9 sessions (median of 4 waits, at most 8; the longest 9)');
    const twelve = buying('struggling', 40, (i) => i % 12 === 0);
    expect(check(twelve, 'market-pace').ok, 'struggling: 12').toBe(true);
    const thirteen = check(
      buying('struggling', 40, (i) => i % 13 === 0),
      'market-pace',
    );
    expect(thirteen.ok, 'struggling: 13').toBe(false);
    expect(thirteen.name).toContain('every 13 sessions (median of 3 waits, at most 12');
    const lull = check(
      buying('struggling', 40, (i) => [0, 1, 2, 3, 4, 5, 30].includes(i)),
      'market-pace',
    );
    expect(lull.ok, 'no longest limit for the struggling child').toBe(true);
    expect(lull.name).toContain('the longest 25)');
    expect(
      runChecks([report('perfect')]).map((c) => c.id),
      'the perfect child is not paced',
    ).not.toContain('market-pace');
  });
  it('no cosmetic bought in the first week', () => {
    for (const learner of ['struggling', 'slow'] as const) {
      const late = report(learner);
      late.days = late.days.map((d, i) => day(i, { bought: i === 7 ? ['hat'] : [] }));
      expect(check(late, 'starter-week').name).toContain('within 7 days (on day 7)');
      expect(check(late, 'starter-week').ok).toBe(false);
      const never = report(learner);
      never.days = never.days.map((d, i) => day(i, { bought: [] }));
      expect(check(never, 'starter-week').name).toContain('on day never');
      expect(check(never, 'starter-week').ok).toBe(false);
      const sixth = report(learner);
      sixth.days = sixth.days.map((d, i) => day(i, { bought: i === 6 ? ['hat'] : [] }));
      expect(check(sixth, 'starter-week').ok, 'day 6 is still the first week').toBe(true);
    }
  });

  /**
   * A struggling child's report over `days` days with `total` levels, level i first completed on
   * `doneOn(i)` (null: never), one region holding the first five lessons and boss b1.
   */
  const pathReport = (
    total: number,
    days: number,
    doneOn: (i: number) => number | null,
    bossDay: number | null = 7,
  ) => {
    const levels = Array.from({ length: total }, (_, i) => `l.${i}`);
    const levelDays: Record<string, number> = {};
    levels.forEach((level, i) => {
      const at = doneOn(i);
      if (at !== null) levelDays[level] = at;
    });
    return report('struggling', {
      daysSimulated: days,
      days: Array.from({ length: days }, (_, i) =>
        day(i, { levels: levels.filter((level) => levelDays[level] === i) }),
      ),
      content: {
        revision: '1.0.0',
        levels,
        bosses: ['b1'],
        regions: [{ id: 'r', lessons: levels.slice(0, 5), boss: 'b1' }],
        tableDragons: ['bubbles', 'sunny'],
        cosmetics: 6,
      },
      levelDays,
      stars: {},
      bossDays: bossDay === null ? {} : { b1: bossDay },
    });
  };

  it("a struggling child that stalls, leaves a finished region's boss, or falls below ¾", () => {
    const steady = check(
      pathReport(59, 84, (i) => Math.floor((i * 81) / 58)),
      'steady-path',
    );
    expect(steady.ok, steady.name).toBe(true);
    expect(steady.name).toContain(
      'a new level in 12 of 12 weeks with play while levels remained; won over the bosses of 1 of 1 finished regions; 59 of 59 levels within 84 days (at least 45); every level: 59 of 59 (the last on day 81)',
    );
    const stall = check(
      pathReport(59, 84, (i) => (i < 10 ? i : i + 11)),
      'steady-path',
    );
    expect(stall.ok).toBe(false);
    expect(stall.name).toContain('(none in the weeks from day 14)');
    const holiday = pathReport(59, 84, (i) => (i < 10 ? i : i + 11));
    holiday.days = holiday.days.map((d) =>
      d.index >= 14 && d.index < 21 ? { ...d, played: false } : d,
    );
    expect(check(holiday, 'steady-path').ok, 'a week without play is not a stall').toBe(true);
    const early = check(
      pathReport(59, 84, (i) => Math.floor((i * 50) / 58)),
      'steady-path',
    );
    expect(early.ok, 'nothing left to do is not a stall').toBe(true);
    expect(early.name).toContain('a new level in 8 of 8 weeks with play while levels remained');
    const bossLeft = check(
      pathReport(59, 84, (i) => Math.floor((i * 81) / 58), null),
      'steady-path',
    );
    expect(bossLeft.ok).toBe(false);
    expect(bossLeft.name).toContain('won over the bosses of 0 of 1 finished regions');
    const lateLessons = check(
      pathReport(59, 84, (i) => (i < 5 ? 77 + i : Math.floor((i * 76) / 58)), null),
      'steady-path',
    );
    expect(lateLessons.name).toContain('won over the bosses of 0 of 0 finished regions');
    expect(lateLessons.ok, 'lessons finished in the last week: the boss may still be ahead').toBe(
      true,
    );
    const below = check(
      pathReport(59, 84, (i) => (i < 44 ? Math.floor((i * 83) / 43) : null)),
      'steady-path',
    );
    expect(below.ok).toBe(false);
    expect(below.name).toContain('44 of 59 levels within 84 days (at least 45); every level: 44');
    const floor = check(
      pathReport(59, 84, (i) => (i < 45 ? Math.floor((i * 83) / 44) : null)),
      'steady-path',
    );
    expect(floor.ok, 'exactly 45 of 59 levels').toBe(true);
    const half = check(
      pathReport(59, 42, (i) => (i < 23 ? Math.floor((i * 41) / 22) : null)),
      'steady-path',
    );
    expect(half.name, 'a 42-day run needs half the floor').toContain('(at least 23)');
    expect(half.ok).toBe(true);
    const ids = runChecks([report('struggling')]).map((c) => c.id);
    expect(ids).toContain('steady-path');
    expect(ids, 'the struggling child is not held to the whole valley').not.toContain(
      'no-dead-end',
    );
    expect(ids).not.toContain('bosses');
    expect(runChecks([report('average')]).map((c) => c.id)).toContain('no-dead-end');
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
