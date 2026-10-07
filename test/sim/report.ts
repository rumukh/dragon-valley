/**
 * Summaries, named balance checks and the markdown report of learner simulations. Pure functions
 * over `SimulationReport`s (driver.ts), shared by the Vitest checks and `scripts/simulate.mjs`.
 */
import type { DayReport, SimulationReport } from './driver';
import type { LearnerName } from './learners';

export interface Spread {
  min: number;
  median: number;
  max: number;
}

/** Min, median and max of integers (zeros for an empty list). */
export function spread(values: readonly number[]): Spread {
  if (values.length === 0) return { min: 0, median: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0]!,
    median: sorted[(sorted.length - 1 - ((sorted.length - 1) % 2)) / 2]!,
    max: sorted[sorted.length - 1]!,
  };
}

/** `part` of `whole` in whole percent, rounded down (0 when `whole` is 0). */
export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : (part * 100 - ((part * 100) % whole)) / whole;
}

export const sessionsOf = (report: SimulationReport): DayReport[] =>
  report.days.filter((day) => day.played);

export interface Summary {
  learner: string;
  days: number;
  sessions: number;
  answers: number;
  successPct: number;
  fastPct: number;
  /** Success per session, in percent. */
  success: Spread;
  answersPerSession: Spread;
  minutesPerSession: Spread;
  coinsPerSession: Spread;
  coinsByReason: Record<string, number>;
  stickers: number;
  stickersPerWeek: Spread;
  goalSessions: number;
  giftSessions: number;
  levelsCompleted: number;
  /** Day index of the last first-time level completion. */
  lastNewLevelDay: number | null;
  bossDays: Record<string, number>;
  finaleDay: number | null;
  /** Day index each table dragon reached each stage. */
  stages: Record<string, Record<string, number>>;
  finalStages: Record<string, string>;
  window: SimulationReport['window'];
  division: SimulationReport['division'];
  /** Days the most overdue known fact (box 2+) had waited when a session began, over all sessions. */
  maxOverdue: number;
  /** Known facts (box 2+) due when a session began, over the last 10 sessions. */
  dueLate: Spread;
  overdueAtEnd: { item: string; days: number }[];
  /** Times-table dragons adult and crowned at the end, and the day the last one became adult. */
  tablesAdult: number;
  tablesCrowned: number;
  lastTableAdultDay: number | null;
  /** The day the child owned every cosmetic, or null. */
  marketFullDay: number | null;
  /**
   * Glimmer's Market: the last session that ended with something to save for, the waits between
   * new cosmetics from the market or the gift, and the day of the first purchase.
   */
  lastSaving: number;
  acquisitionWait: Spread;
  firstPurchaseDay: number | null;
  coinsLeft: number;
  dimFacts: string[];
  failures: string[];
  commits: number;
}

export function summarise(report: SimulationReport): Summary {
  const sessions = sessionsOf(report);
  const answers = sessions.reduce((sum, d) => sum + d.answers, 0);
  const correct = sessions.reduce((sum, d) => sum + d.correct, 0);
  const fast = sessions.reduce((sum, d) => sum + d.fast, 0);
  const coinsByReason: Record<string, number> = {};
  for (const day of sessions) {
    for (const [reason, amount] of Object.entries(day.coinsBy)) {
      coinsByReason[reason] = (coinsByReason[reason] ?? 0) + amount;
    }
  }
  const weeks: number[] = [];
  for (let start = 0; start + 7 <= report.days.length; start += 7) {
    weeks.push(report.days.slice(start, start + 7).reduce((sum, d) => sum + d.stickers.length, 0));
  }
  const newLevelDays = sessions.filter((d) => d.levels.length > 0).map((d) => d.index);
  const adultDays = report.content.tableDragons
    .map((dragon) => report.stages[dragon]?.['adult'])
    .filter((day): day is number => day !== undefined);
  const crowned = report.content.tableDragons.filter(
    (dragon) => report.stages[dragon]?.['crowned'] !== undefined,
  );
  const market = sessions.find((d) => d.cosmeticsOwned >= report.content.cosmetics);
  return {
    learner: report.learner,
    days: report.daysSimulated,
    sessions: sessions.length,
    answers,
    successPct: percent(correct, answers),
    fastPct: percent(fast, correct),
    success: spread(
      sessions.filter((d) => d.answers > 0).map((d) => percent(d.correct, d.answers)),
    ),
    answersPerSession: spread(sessions.map((d) => d.answers)),
    minutesPerSession: spread(sessions.map((d) => (d.answerMs - (d.answerMs % 60_000)) / 60_000)),
    coinsPerSession: spread(sessions.map((d) => d.coins)),
    coinsByReason,
    stickers: sessions.reduce((sum, d) => sum + d.stickers.length, 0),
    stickersPerWeek: spread(weeks),
    goalSessions: sessions.filter((d) => d.goalReached).length,
    giftSessions: sessions.filter((d) => d.giftOpened).length,
    levelsCompleted: Object.keys(report.levelDays).length,
    lastNewLevelDay: newLevelDays.length > 0 ? newLevelDays[newLevelDays.length - 1]! : null,
    bossDays: report.bossDays,
    finaleDay: report.finaleDay,
    stages: report.stages,
    finalStages: report.finalStages,
    window: report.window,
    division: report.division,
    maxOverdue: Math.max(0, ...sessions.map((d) => d.maxOverdueAtStart)),
    dueLate: spread(sessions.slice(-10).map((d) => d.dueAtStart)),
    overdueAtEnd: report.overdue,
    tablesAdult: adultDays.length,
    tablesCrowned: crowned.length,
    lastTableAdultDay:
      adultDays.length === report.content.tableDragons.length ? Math.max(...adultDays) : null,
    marketFullDay: market?.index ?? null,
    lastSaving: lastSavingSession(report),
    acquisitionWait: spread(acquisitionGaps(report)),
    firstPurchaseDay: sessions.find((d) => d.bought.length > 0)?.index ?? null,
    coinsLeft: report.coins,
    dimFacts: report.dimFacts,
    failures: report.failures,
    commits: report.days.reduce((sum, d) => sum + d.commits, 0),
  };
}

export interface CheckResult {
  learner: LearnerName;
  id: string;
  /** The check's name with what was measured: reads as a finding when it fails. */
  name: string;
  ok: boolean;
}

/**
 * Balance targets, each from docs/design.md or the simulation brief (docs/testing.md §4). They are
 * fixed before measuring and never moved to make a run pass; docs/balance-report.md records the
 * measured values and the reasons.
 */
export const TARGETS = {
  /** Success per session of the average child (testing.md §4: 70-90 %). */
  success: { low: 70, high: 90, sessionsShare: 75 },
  /**
   * The struggling child's median success per session: at least `floor` (acceptance), inside
   * the average child's band as a stretch. A struggling child progresses more slowly but keeps
   * succeeding (the coordinator's decision on balance-report.md §5.1, testing.md §4).
   */
  strugglingSuccess: { floor: 60 },
  /** Coins per session, median (design §7.1: a 15-minute session earns roughly 50-80 coins). */
  coins: { low: 50, high: 80 },
  /**
   * Days a known fact (bronze and up: box 2+, driver.ts `KNOWN_BOX`) may wait past its review
   * day (testing.md §4: interval plus a grace). Facts in box 0-1 are still being learned.
   */
  graceDays: 7,
  /**
   * The average child grows every times-table dragon to adult (90 % of its multiplication and
   * division facts at silver, its boss won over) within 12 weeks of play, five days a week: the
   * new tables 6-9 belong to the first half of 3rd grade, and 12 weeks is a school trimester.
   */
  tablesAdultDays: 84,
  /** The perfect child reaches the finale within 4 weeks of daily play. */
  perfectFinaleDays: 28,
  /** An egg hatches within this many sessions of the child receiving it. */
  hatchSessions: 5,
  /**
   * The struggling child's steady path (the coordinator's decision for 1.2.0, replacing "every
   * level and boss within the run" for this child only). For a struggling child success matters
   * more than speed, and the rules' protection slows its progress by design, so it must keep
   * moving rather than finish the valley in 12 weeks:
   * - no stall: while levels remain, every week with play completes at least one new level;
   * - every boss of a region whose lessons it finished is won over (lessons finished in the last
   *   `bossGraceDays` days of the run may still have the boss ahead);
   * - a regression floor: at least `floorShare` % of the levels within `floorDays` days (45 of
   *   59; scaled down for a shorter run).
   */
  steadyPath: { floorShare: 75, floorDays: 84, bossGraceDays: 7 },
  /**
   * Glimmer's Market (the coordinator's O5 for the 1.2.0 economy): a new cosmetic about every 5
   * sessions (about weekly) matters more to an 8-year-old than a market that lasts all year, and
   * it is kinder to slower children; the valley's own rewards (stickers, hatching, growth, the
   * Window, the finale) carry the rest of the year, and a later art update can add cosmetics. The
   * gift chest gives coins only, so new cosmetics come from levels and the market.
   * - `lastsSessions`: the average child still has something on sale it cannot afford yet after
   *   this many sessions (a shorter run must end with something to save for);
   * - `pace`: the median wait for something new from the market (or the gift) for each child,
   *   and for the average child the longest wait while cosmetics remain;
   * - `firstWeekDays`: every child buys its first cosmetic in its first week.
   * The simulated child buys the cheapest item it can afford at the end of each session.
   */
  market: {
    lastsSessions: 110,
    pace: {
      average: { median: 6, longest: 10 },
      slow: { median: 8 },
      struggling: { median: 12 },
    } as Partial<Record<LearnerName, { median: number; longest?: number }>>,
    firstWeekDays: 7,
  },
} as const;

/** The learners each check applies to. */
const ALL: readonly LearnerName[] = ['perfect', 'average', 'struggling', 'slow'];

interface Check {
  id: string;
  learners: readonly LearnerName[];
  evaluate(report: SimulationReport): { ok: boolean; name: string };
}

/** Sessions played from day `from` to day `to` (inclusive). */
function sessionsBetween(report: SimulationReport, from: number, to: number): number {
  return report.days.filter((d) => d.played && d.index >= from && d.index <= to).length;
}

/**
 * The day a level was first completed: its completion event, or day 0 for a level the placement
 * check completed (one star, no event); `null` when it was never completed.
 */
export function completionDay(report: SimulationReport, level: string): number | null {
  const day = report.levelDays[level];
  if (day !== undefined) return day;
  return (report.stars[level] ?? 0) >= 1 ? 0 : null;
}

/** Success (whole percent) of every session with answers. */
function successRates(report: SimulationReport): number[] {
  return sessionsOf(report)
    .filter((d) => d.answers > 0)
    .map((d) => percent(d.correct, d.answers));
}

/**
 * Sessions waited between new cosmetics from the market or the gift chest (level rewards are
 * not counted), and, while cosmetics are still missing at the end, the wait since the last one.
 */
export function acquisitionGaps(report: SimulationReport): number[] {
  const sessions = sessionsOf(report);
  const got: number[] = [];
  sessions.forEach((d, i) => {
    if (d.bought.length + d.gifted.length > 0) got.push(i);
  });
  const gaps = got.slice(1).map((at, k) => at - got[k]!);
  const last = sessions[sessions.length - 1];
  const missing = last !== undefined && last.cosmeticsOwned < report.content.cosmetics;
  const tail = got.length > 0 ? sessions.length - 1 - got[got.length - 1]! : 0;
  if (missing && tail > 0) gaps.push(tail);
  return gaps;
}

/** The last session (1-based) that ended with something on sale the child could not afford. */
export function lastSavingSession(report: SimulationReport): number {
  let last = 0;
  sessionsOf(report).forEach((d, i) => {
    if (d.toSaveFor > 0) last = i + 1;
  });
  return last;
}

export const CHECKS: readonly Check[] = [
  {
    id: 'accepted',
    learners: ALL,
    evaluate: (r) => ({
      ok: r.failures.length === 0,
      name: `every step of the simulation was accepted (${r.failures.length} rejected${r.failures.length ? `: ${r.failures.slice(0, 3).join(', ')}` : ''})`,
    }),
  },
  {
    id: 'first-hatch',
    learners: ALL,
    evaluate: (r) => {
      const hatched = r.days[0]?.hatched ?? [];
      return {
        ok: hatched.length > 0,
        name: `the first egg hatched in the first session (design §4.1; hatched: ${hatched.join(', ') || 'none'})`,
      };
    },
  },
  {
    id: 'success-band',
    learners: ['average'],
    evaluate: (r) => {
      const { low, high, sessionsShare } = TARGETS.success;
      const rates = successRates(r);
      const inside = rates.filter((rate) => rate >= low && rate <= high).length;
      const median = spread(rates).median;
      const share = percent(inside, rates.length);
      return {
        ok: share >= sessionsShare && median >= low && median <= high,
        name: `success per session within ${low}-${high} % in ${inside} of ${rates.length} sessions (${share} %, target ${sessionsShare} %), median ${median} %`,
      };
    },
  },
  {
    id: 'success-floor',
    learners: ['struggling'],
    evaluate: (r) => {
      const { floor } = TARGETS.strugglingSuccess;
      const { low, high } = TARGETS.success;
      const rates = successRates(r);
      const inside = rates.filter((rate) => rate >= low && rate <= high).length;
      const median = spread(rates).median;
      const stretch = median >= low && median <= high ? 'reached' : 'not reached';
      return {
        ok: median >= floor,
        name: `median success per session ${median} %, at least ${floor} % (stretch ${low}-${high} %: ${stretch}; ${inside} of ${rates.length} sessions in it)`,
      };
    },
  },
  {
    id: 'rewarded',
    learners: ALL,
    evaluate: (r) => {
      const sessions = sessionsOf(r);
      const paid = sessions.filter((d) => d.coins > 0).length;
      return {
        ok: paid === sessions.length,
        name: `earned coins in ${paid} of ${sessions.length} sessions (fewest ${spread(sessions.map((d) => d.coins)).min})`,
      };
    },
  },
  {
    id: 'progress-weekly',
    learners: ['average', 'struggling', 'slow'],
    evaluate: (r) => {
      const weeks: boolean[] = [];
      for (let start = 0; start < r.days.length; start += 7) {
        const week = r.days.slice(start, start + 7).filter((d) => d.played);
        if (week.length === 0) continue;
        weeks.push(
          week.some(
            (d) =>
              d.levels.length + d.hatched.length + d.grew.length + d.stickers.length + d.panes > 0,
          ),
        );
      }
      const moved = weeks.filter(Boolean).length;
      return {
        ok: moved === weeks.length,
        name: `saw progress (a level, a hatch, growth, a sticker or a lit pane) in ${moved} of ${weeks.length} weeks`,
      };
    },
  },
  {
    id: 'gift',
    learners: ALL,
    evaluate: (r) => {
      const goal = sessionsOf(r).filter((d) => d.goalReached);
      const gifted = goal.filter((d) => d.giftOpened).length;
      return {
        ok: gifted === goal.length,
        name: `opened the gift in ${gifted} of the ${goal.length} sessions that reached the daily goal (testing.md §4)`,
      };
    },
  },
  {
    id: 'hatch-pace',
    learners: ALL,
    evaluate: (r) => {
      const waits = Object.entries(r.eggDays).map(([dragon, day]) => {
        const hatched = r.stages[dragon]?.['hatchling'];
        const end = hatched ?? r.days.length - 1;
        return { dragon, sessions: sessionsBetween(r, day, end), hatched: hatched !== undefined };
      });
      const late = waits.filter((w) => !w.hatched || w.sessions > TARGETS.hatchSessions);
      const longest = Math.max(0, ...waits.map((w) => w.sessions));
      return {
        ok: late.length === 0,
        name: `hatched every egg within ${TARGETS.hatchSessions} sessions of receiving it (${waits.length} eggs, longest ${longest} sessions${late.length ? `; late: ${late.map((w) => `${w.dragon} ${w.hatched ? w.sessions : 'never'}`).join(', ')}` : ''})`,
      };
    },
  },
  {
    id: 'no-dead-end',
    learners: ['perfect', 'average', 'slow'],
    evaluate: (r) => {
      // A level placed out by the placement check counts as completed (one star, no event).
      const done = r.content.levels.filter((level) => (r.stars[level] ?? 0) >= 1);
      const last = Math.max(0, ...Object.values(r.levelDays));
      return {
        ok: done.length === r.content.levels.length,
        name: `completed ${done.length} of ${r.content.levels.length} levels within ${r.daysSimulated} days (the last on day ${last})`,
      };
    },
  },
  {
    id: 'bosses',
    learners: ['perfect', 'average', 'slow'],
    evaluate: (r) => {
      const won = r.content.bosses.filter((boss) => r.bossDays[boss] !== undefined);
      const last = Math.max(0, ...Object.values(r.bossDays));
      return {
        ok: won.length === r.content.bosses.length,
        name: `won over ${won.length} of ${r.content.bosses.length} bosses within ${r.daysSimulated} days (the last on day ${last})`,
      };
    },
  },
  {
    id: 'steady-path',
    learners: ['struggling'],
    evaluate: (r) => {
      const { floorShare, floorDays, bossGraceDays } = TARGETS.steadyPath;
      const total = r.content.levels.length;
      const day = (level: string) => completionDay(r, level);
      const doneBefore = (end: number) =>
        r.content.levels.filter((level) => {
          const at = day(level);
          return at !== null && at < end;
        }).length;
      const weeks: { start: number; newLevel: boolean }[] = [];
      for (let start = 0; start < r.daysSimulated; start += 7) {
        const days = r.days.slice(start, start + 7);
        if (!days.some((d) => d.played) || doneBefore(start) >= total) continue;
        weeks.push({ start, newLevel: days.some((d) => d.levels.length > 0) });
      }
      const stalled = weeks.filter((w) => !w.newLevel).map((w) => w.start);
      const lastDay = r.daysSimulated - 1;
      const finished = r.content.regions.filter(
        (region) =>
          region.boss !== null &&
          region.lessons.every((level) => {
            const at = day(level);
            return at !== null && at <= lastDay - bossGraceDays;
          }),
      );
      const won = finished.filter((region) => r.bossDays[region.boss!] !== undefined);
      const cutoff = Math.min(floorDays, r.daysSimulated);
      const needed = Math.ceil((total * floorShare * cutoff) / (100 * floorDays));
      const byCutoff = doneBefore(cutoff);
      const all = doneBefore(r.daysSimulated);
      const last = Math.max(0, ...r.content.levels.map((level) => day(level) ?? 0));
      return {
        ok: stalled.length === 0 && won.length === finished.length && byCutoff >= needed,
        name: `kept moving: a new level in ${weeks.length - stalled.length} of ${weeks.length} weeks with play while levels remained${stalled.length > 0 ? ` (none in the weeks from day ${stalled.join(', ')})` : ''}; won over the bosses of ${won.length} of ${finished.length} finished regions; ${byCutoff} of ${total} levels within ${cutoff} days (at least ${needed}); every level: ${all} of ${total} (the last on day ${last})`,
      };
    },
  },
  {
    id: 'no-starving',
    learners: ['average', 'struggling', 'slow'],
    evaluate: (r) => {
      const worst = sessionsOf(r).reduce(
        (max, d) =>
          d.maxOverdueAtStart > max.days
            ? { days: d.maxOverdueAtStart, item: d.mostOverdue, day: d.index }
            : max,
        { days: 0, item: null as string | null, day: 0 },
      );
      return {
        ok: worst.days <= TARGETS.graceDays,
        name: `no known fact (bronze and up) waited more than ${TARGETS.graceDays} days past its review day (the longest: ${worst.days} days${worst.item ? `, ${worst.item} on day ${worst.day}` : ''})`,
      };
    },
  },
  {
    id: 'tables-mastered',
    learners: ['average'],
    evaluate: (r) => {
      const days = r.content.tableDragons.map((dragon) => r.stages[dragon]?.['adult']);
      const reached = days.filter((day): day is number => day !== undefined);
      const last = reached.length === days.length ? Math.max(...reached) : null;
      return {
        ok: last !== null && last <= TARGETS.tablesAdultDays,
        name: `grew every times-table dragon to adult (90 % silver) within ${TARGETS.tablesAdultDays} days (${reached.length} of ${days.length} adult${last !== null ? `, the last on day ${last}` : ''})`,
      };
    },
  },
  {
    id: 'coins-pace',
    learners: ['average', 'struggling', 'slow'],
    evaluate: (r) => {
      const { low, high } = TARGETS.coins;
      const median = spread(sessionsOf(r).map((d) => d.coins)).median;
      return {
        ok: median >= low && median <= high,
        name: `earned a median of ${median} coins per session (design §7.1: ${low}-${high})`,
      };
    },
  },
  {
    id: 'market-lasts',
    learners: ['average'],
    evaluate: (r) => {
      const { lastsSessions } = TARGETS.market;
      const sessions = sessionsOf(r);
      const last = lastSavingSession(r);
      const needed = Math.min(lastsSessions, sessions.length);
      return {
        ok: sessions.length > 0 && last >= needed,
        name: `still had something on sale to save for after ${last} of ${sessions.length} sessions (target ${lastsSessions}${sessions.length < lastsSessions ? `; a run this short must end with one` : ''})`,
      };
    },
  },
  {
    id: 'market-pace',
    learners: ['average', 'slow', 'struggling'],
    evaluate: (r) => {
      const limit = TARGETS.market.pace[r.learner]!;
      const gaps = acquisitionGaps(r);
      const { median, max } = spread(gaps);
      const longestOk = limit.longest === undefined || max <= limit.longest;
      return {
        ok: gaps.length > 0 && median <= limit.median && longestOk,
        name: `got something new from the market or the gift every ${median} sessions (median of ${gaps.length} waits, at most ${limit.median}; the longest ${max}${limit.longest === undefined ? '' : `, at most ${limit.longest}`})`,
      };
    },
  },
  {
    id: 'starter-week',
    learners: ALL,
    evaluate: (r) => {
      const { firstWeekDays } = TARGETS.market;
      const first = r.days.find((d) => d.played && d.bought.length > 0);
      return {
        ok: first !== undefined && first.index < firstWeekDays,
        name: `bought a first cosmetic within ${firstWeekDays} days (on day ${first?.index ?? 'never'})`,
      };
    },
  },
  {
    id: 'fluency',
    learners: ['slow'],
    evaluate: (r) => {
      const crowned = Object.values(r.finalStages).filter((s) => s === 'crowned').length;
      const silver = r.window.silver + r.division.silver;
      return {
        ok: r.window.gold + r.division.gold === 0 && crowned === 0 && silver > 0,
        name: `lit ${silver} panes silver but none gold and crowned no dragon without quick answers (gold ${r.window.gold + r.division.gold}, crowned ${crowned})`,
      };
    },
  },
  {
    id: 'perfect-pace',
    learners: ['perfect'],
    evaluate: (r) => ({
      ok: r.finaleDay !== null && r.finaleDay < TARGETS.perfectFinaleDays,
      name: `reached the finale within ${TARGETS.perfectFinaleDays} days of daily play (day ${r.finaleDay ?? 'never'})`,
    }),
  },
];

/** The named balance checks of every report (each check for the learners it applies to). */
export function runChecks(reports: readonly SimulationReport[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (const check of CHECKS) {
    for (const report of reports.filter((r) => check.learners.includes(r.learner))) {
      const { ok, name } = check.evaluate(report);
      results.push({
        learner: report.learner,
        id: check.id,
        name: `${report.learner}: ${name}`,
        ok,
      });
    }
  }
  return results;
}

/** The markdown report of a set of simulations. */
export function markdown(
  summaries: readonly Summary[],
  checks: readonly CheckResult[],
  run: { days: number; seed: string; balance?: string },
): string {
  const s3 = (s: Spread) => `${s.min} / ${s.median} / ${s.max}`;
  const lines = [
    `# Learner simulation: ${run.days} days, seed "${run.seed}"${run.balance ? `, balance ${run.balance}` : ''}`,
    '',
    'Spreads are min / median / max over the sessions played.',
    '',
    '## Play and learning',
    '',
    '| Learner | Sessions | Answers per session | Success | Success per session | Quick | Valley done (day) | Table dragons adult (last day) | Crowned | Window dim / bronze / silver / gold | Division panel | Due at start, last 10 sessions | Longest overdue (days) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const s of summaries) {
    const w = s.window;
    const d = s.division;
    lines.push(
      `| ${s.learner} | ${s.sessions} | ${s3(s.answersPerSession)} | ${s.successPct} % | ${s3(s.success)} % | ${s.fastPct} % | ${s.finaleDay ?? 'not yet'} | ${s.tablesAdult} of 11 (${s.lastTableAdultDay ?? '-'}) | ${s.tablesCrowned} | ${w.dim} / ${w.bronze} / ${w.silver} / ${w.gold} | ${d.dim} / ${d.bronze} / ${d.silver} / ${d.gold} | ${s3(s.dueLate)} | ${s.maxOverdue} |`,
    );
  }
  lines.push(
    '',
    '## Rewards',
    '',
    '| Learner | Coins per session | Coins by source (total) | Daily goal | Gifts | Stickers | First purchase (day) | Something to save for until (session) | Wait for something new (sessions) | Every cosmetic owned (day) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const s of summaries) {
    const sources = Object.entries(s.coinsByReason)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, amount]) => `${reason} ${amount}`)
      .join(', ');
    lines.push(
      `| ${s.learner} | ${s3(s.coinsPerSession)} | ${sources} | ${s.goalSessions} of ${s.sessions} | ${s.giftSessions} | ${s.stickers} | ${s.firstPurchaseDay ?? 'never'} | ${s.lastSaving} | ${s3(s.acquisitionWait)} | ${s.marketFullDay ?? 'not yet'} |`,
    );
  }
  lines.push('', '## Checks', '');
  for (const check of checks) lines.push(`- ${check.ok ? 'PASS' : 'FAIL'} ${check.name}`);
  lines.push('', '## Details', '');
  for (const s of summaries) {
    const stages = Object.entries(s.stages)
      .map(
        ([dragon, reached]) =>
          `${dragon} ${Object.entries(reached)
            .map(([stage, day]) => `${stage} ${day}`)
            .join(', ')}`,
      )
      .join('; ');
    const overdue = s.overdueAtEnd
      .slice(0, 5)
      .map((o) => `${o.item} ${o.days}`)
      .join(', ');
    lines.push(
      `- **${s.learner}**: stages by day: ${stages || 'none'}. Still dim: ${s.dimFacts.length} (${s.dimFacts.slice(0, 12).join(', ')}${s.dimFacts.length > 12 ? ', …' : ''}). Most overdue at the end (days): ${overdue || 'none'}. Coins left: ${s.coinsLeft}. Commits: ${s.commits}.`,
    );
  }
  return lines.join('\n') + '\n';
}
