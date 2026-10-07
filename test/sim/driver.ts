/**
 * The learner simulation: a synthetic child (learners.ts) plays the real rules headlessly through
 * `createRuntimeHost`, one simulated day after another. Each day it starts a session and follows
 * the Daily Adventure (`hub.next`, docs/design.md §4.2): story, placement, snacks for hungry
 * dragons, the next level, a minigame for variety, the gift. With nothing new it feeds hungry
 * dragons, replays its weakest level or races in the Arena. A session lasts about 15 minutes
 * (`answersPerDay` answers); the child finishes the round it is in, claims finished quests, opens
 * the gift, then buys the cheapest cosmetic it can afford and puts it on a dragon. Story beats
 * take their first offered choice.
 *
 * Problems are answered by the learner model; minigame boards are played by the trace harness
 * (test/traces/support.ts), clumsily for a clumsy learner. Each step is one plain `dispatch`: the
 * trace bookkeeping of the command traces would double the cost of a simulated month.
 *
 * The report records, per day, what a parent would see (answers, success, speed, coins by reason,
 * stickers, eggs, hatches and growth, lit panes, new levels and bosses, quests, the goal, the gift
 * and the market) and how overdue the oldest due fact was when the session began.
 */
import type { ContentPack } from '@aegis/runtime';
import { dayNumber, isoDay } from '../../src/rules/contract';
import type {
  AnswerValue,
  ContentData,
  GameAction,
  GameView,
  MasteryLevel,
  ProblemRoundView,
} from '../../src/rules/contract';
import { itemTier } from '../../src/rules/learning/selection';
import type { ItemTier } from '../../src/rules/learning/selection';
import { Player, loadPack, oracle } from '../traces/support';
import type { Style } from '../traces/support';
import { LEARNERS, Learner, knowledgeKey } from './learners';
import type { LearnerName } from './learners';

/** The simulation starts on a Monday. */
export const FIRST_DAY = '2026-10-05';

export interface DayReport {
  /** 0-based day of the simulation. */
  index: number;
  day: string;
  played: boolean;
  answers: number;
  correct: number;
  fast: number;
  /** Total answering time, in milliseconds: a proxy for the session's length. */
  answerMs: number;
  coins: number;
  coinsBy: Record<string, number>;
  stickers: string[];
  /** Eggs received. */
  eggs: string[];
  hatched: string[];
  /** `dragon:stage` for every growth step. */
  grew: string[];
  /** Levels completed for the first time. */
  levels: string[];
  bosses: string[];
  /** Window panes (multiplication and division facts) that reached a higher mastery level. */
  panes: number;
  /** Cosmetics bought in the market, and cosmetics owned at the end of the day. */
  bought: string[];
  cosmeticsOwned: number;
  /** Cosmetics the daily gift gave. */
  gifted: string[];
  /**
   * The market at the end of the session, after shopping: coins left, items on sale (unlocked,
   * not owned) and those the child cannot afford yet (something to save for).
   */
  coinsAtEnd: number;
  forSale: number;
  toSaveFor: number;
  quests: number;
  goalReached: boolean;
  giftOpened: boolean;
  /** Known facts (box 2 and up, `KNOWN_BOX`) whose review day had come when the session began. */
  dueAtStart: number;
  /** Days the most overdue known fact had waited past its review day. */
  maxOverdueAtStart: number;
  mostOverdue: string | null;
  /** Commits the day took (a cost measure). */
  commits: number;
}

export interface SimulationReport {
  learner: LearnerName;
  seed: string;
  daysSimulated: number;
  /** What the content holds, for the checks: levels, bosses and the times-table dragons. */
  content: {
    revision: string;
    levels: string[];
    bosses: string[];
    tableDragons: string[];
    cosmetics: number;
  };
  days: DayReport[];
  /** Rejected steps: a simulation of a valid child has none. */
  failures: string[];
  /** Day index (0-based) each dragon first reached each stage. */
  stages: Record<string, Record<string, number>>;
  finalStages: Record<string, string>;
  /** Mastery of the 121 multiplication facts and the 110 division facts at the end. */
  window: Record<MasteryLevel, number>;
  division: Record<MasteryLevel, number>;
  /** Window and division facts still dim at the end. */
  dimFacts: string[];
  /** Each owned dragon at the end: stage, mastery shares (percent) and due items. */
  dragons: Record<
    string,
    {
      stage: string;
      seen: number;
      bronze: number;
      silver: number;
      gold: number;
      items: number;
      due: number;
    }
  >;
  stars: Record<string, number>;
  /** Day index each egg was received. */
  eggDays: Record<string, number>;
  /** Day index each boss was first defeated. */
  bossDays: Record<string, number>;
  /** Day index each level was first completed. */
  levelDays: Record<string, number>;
  finaleDay: number | null;
  coins: number;
  cosmetics: number;
  stickers: number;
  /** Known facts (box 2 and up) past their review day at the end, most overdue first. */
  overdue: { item: string; days: number }[];
}

/** The trace harness with plain dispatch steps and a mistake for every kind of answer. */
class SimPlayer extends Player {
  private simSteps = 0;

  override async act(action: GameAction): Promise<boolean> {
    // A simulated month is long: let the test runner's messages through now and then.
    if (++this.simSteps % 20 === 0) await new Promise((resolve) => setImmediate(resolve));
    const outcome = await this.host.dispatch(action);
    if (!outcome.ok) {
      this.failures.push(`${action.type}: ${outcome.error.code}`);
      return false;
    }
    if (action.type === 'answer' || action.type === 'placementAnswer') this.turn += 1;
    return true;
  }

  /** Answer the problem on screen as the learner decides: right, or a plausible mistake. */
  override async answer(): Promise<boolean> {
    const round = this.view().round;
    if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) return false;
    this.answered += 1;
    const right = this.style.right(this.answered, round);
    const expected = oracle(round.problem.problem, round.problem.step);
    const value = right ? expected : mistake(round, expected);
    const type = round.activity === 'placement' ? 'placementAnswer' : 'answer';
    return this.act({ type, value, elapsedMs: this.style.elapsedMs(this.answered, round) });
  }
}

/** A wrong answer: another offered choice, else a near miss of the right one. */
export function mistake(round: ProblemRoundView, expected: AnswerValue): AnswerValue {
  const key = JSON.stringify(expected);
  const other = round.problem?.choices?.find((choice) => JSON.stringify(choice) !== key);
  if (other !== undefined) return other;
  switch (expected.kind) {
    case 'number':
      return { kind: 'number', value: expected.value + 1 };
    case 'remainder':
      return { kind: 'remainder', quotient: expected.quotient, remainder: expected.remainder + 1 };
    case 'operation':
      return { kind: 'operation', operation: expected.operation === 'add' ? 'sub' : 'add' };
    case 'relation':
      return { kind: 'relation', relation: expected.relation === 'lt' ? 'gt' : 'lt' };
    case 'term':
      return { kind: 'term', term: expected.term === 'factor' ? 'product' : 'factor' };
  }
}

const event = <T>(data: unknown) => data as T;

async function resolveStory(player: Player): Promise<void> {
  for (let guard = 0; guard < 30; guard++) {
    const story = player.view().story;
    if (story === null) return;
    const choice = story.choices.find((c) => c.enabled);
    if (!(await player.choose(choice ? choice.id : null))) return;
  }
}

/** Play the active round to its end, answering problems and playing boards. */
async function playRound(player: Player): Promise<void> {
  for (let guard = 0; guard < 300; guard++) {
    await resolveStory(player);
    const round = player.view().round;
    if (round === null || round.status !== 'active') return;
    if (round.type === 'problems') {
      if (!(await player.answer())) return;
    } else {
      const before = player.hashes.length;
      await player.playBoard();
      if (player.hashes.length === before) return;
    }
  }
}

async function closeRound(player: Player): Promise<void> {
  await resolveStory(player);
  if (player.view().round !== null) await player.act({ type: 'endRound', reason: 'done' });
  await resolveStory(player);
}

/** Start a level (or one activity of it) and play the run to its end. */
async function playRun(player: Player, start: GameAction): Promise<void> {
  if (!(await player.act(start))) return;
  for (let guard = 0; guard < 12; guard++) {
    await playRound(player);
    await closeRound(player);
    const run = player.view().run;
    if (run === null || run.result !== null || run.next >= run.activities.length) return;
    const index = run.next;
    if (!(await player.act({ type: 'startActivity', activity: { kind: 'level', index } }))) return;
  }
}

async function tidyUp(player: Player): Promise<void> {
  for (const quest of player.view().daily?.quests ?? []) {
    if (quest.done && !quest.claimed) await player.act({ type: 'claimQuest', quest: quest.id });
  }
  if (player.view().daily?.gift === 'ready') await player.act({ type: 'openGift' });
}

/** At the end of a session the child visits the market: one item, the cheapest, worn at once. */
async function shop(player: Player): Promise<void> {
  const view = player.view();
  const item = view.market.items
    .filter((i) => i.available && !i.owned && i.affordable)
    .sort((a, b) => a.price - b.price || (a.id < b.id ? -1 : 1))[0];
  if (item === undefined || !(await player.act({ type: 'buy', item: item.id }))) return;
  const dragon = player
    .view()
    .dragons.find((d) => d.stage !== 'egg' && d.outfit[item.slot] === null);
  if (dragon !== undefined) {
    await player.act({ type: 'equip', dragon: dragon.id, slot: item.slot, item: item.id });
  }
}

/** Free play: hungry dragons first, then the weakest completed level, then the Arena. */
async function freePlay(player: Player, budgetLeft: number): Promise<boolean> {
  const view = player.view();
  if (view.hub.hungry.length > 0) {
    if (await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: null } })) {
      await playRound(player);
      await closeRound(player);
      return true;
    }
  }
  const replay = view.hub.regions
    .filter((r) => r.unlocked)
    .flatMap((r) => r.levels)
    .filter((l) => l.status === 'completed' && l.stars < 3)
    .sort((a, b) => a.stars - b.stars || a.order - b.order)[0];
  if (replay !== undefined) {
    await playRun(player, { type: 'startLevel', level: replay.id });
    return true;
  }
  if (view.hub.arena.available && budgetLeft > 0) {
    if (await player.act({ type: 'startActivity', activity: { kind: 'arena' } })) {
      for (let n = 0; n < budgetLeft && player.view().round?.status === 'active'; n++) {
        if (!(await player.answer())) break;
      }
      if (player.view().round?.status === 'active') {
        await player.act({ type: 'endRound', reason: 'time-up' });
      }
      await closeRound(player);
      return true;
    }
  }
  return false;
}

async function playSession(player: Player, budget: number): Promise<void> {
  const start = player.answered;
  for (let guard = 0; guard < 60; guard++) {
    await resolveStory(player);
    await tidyUp(player);
    const left = budget - (player.answered - start);
    if (left <= 0) break;
    const before = player.hashes.length;
    const view = player.view();
    const run = view.run;
    if (view.round !== null && view.round.status === 'active') {
      await playRound(player);
      await closeRound(player);
    } else if (view.round !== null) {
      await closeRound(player);
    } else if (run !== null && run.result === null && run.next < run.activities.length) {
      const index = run.next;
      await playRun(player, { type: 'startActivity', activity: { kind: 'level', index } });
    } else {
      const next = view.hub.next;
      if (next.kind === 'placement' || next.kind === 'snack') {
        const activity =
          next.kind === 'placement'
            ? { kind: 'placement' as const }
            : { kind: 'snack' as const, dragon: next.dragon };
        if (await player.act({ type: 'startActivity', activity })) {
          await playRound(player);
          await closeRound(player);
        }
      } else if (next.kind === 'level') {
        await playRun(player, { type: 'startLevel', level: next.level });
      } else if (next.kind === 'minigame') {
        const replay: GameAction = {
          type: 'startLevel',
          level: next.level,
          activity: next.activity,
        };
        await playRun(player, replay);
      } else if (next.kind === 'gift') {
        await player.act({ type: 'openGift' });
      } else if (next.kind === 'free-play') {
        if (!(await freePlay(player, left))) break;
      }
    }
    if (player.hashes.length === before) break;
  }
  await resolveStory(player);
  await tidyUp(player);
  await shop(player);
}

export function emptyDay(index: number, day: string, played: boolean): DayReport {
  return {
    index,
    day,
    played,
    answers: 0,
    correct: 0,
    fast: 0,
    answerMs: 0,
    coins: 0,
    coinsBy: {},
    stickers: [],
    eggs: [],
    hatched: [],
    grew: [],
    levels: [],
    bosses: [],
    panes: 0,
    bought: [],
    cosmeticsOwned: 0,
    gifted: [],
    coinsAtEnd: 0,
    forSale: 0,
    toSaveFor: 0,
    quests: 0,
    goalReached: false,
    giftOpened: false,
    dueAtStart: 0,
    maxOverdueAtStart: 0,
    mostOverdue: null,
    commits: 0,
  };
}

const LEVELS: readonly MasteryLevel[] = ['dim', 'bronze', 'silver', 'gold'];

function counts(cells: readonly { level: MasteryLevel }[]): Record<MasteryLevel, number> {
  const result = { dim: 0, bronze: 0, silver: 0, gold: 0 };
  for (const cell of cells) result[cell.level] += 1;
  return result;
}

export interface SimulateOptions {
  seed?: string;
  pack?: ContentPack<ContentData>;
  /** Answers per session instead of the learner's own (a short run for the Vitest gate). */
  answersPerDay?: number;
  /** Called after every simulated day (progress reporting in the script). */
  onDay?: (day: DayReport) => void;
  /** Called for every problem the learner answers (analysis: `simulate.mjs --answers`). */
  onAnswer?: (answer: AnswerRecord) => void;
}

/** One answer of the learner, with what the rules and the learner knew before it. */
export interface AnswerRecord {
  /** 0-based day of the simulation. */
  day: number;
  activity: ProblemRoundView['activity'];
  /** The level of the round, and whether it had been completed before (a replay). */
  level: string | null;
  replay: boolean;
  item: string;
  /** `operation` for a story's first step (which operation?), else `answer`. */
  step: 'answer' | 'operation';
  /** The item's tier in the mix and its Leitner box before the answer (`null`: never answered). */
  tier: ItemTier;
  box: number | null;
  reask: boolean;
  input: 'choice' | 'keypad';
  /** How well the learner recalled the fact (0-100), and the answer. */
  recall: number;
  right: boolean;
  elapsedMs: number;
}

/**
 * A fact is known at bronze or better: Leitner box 2 and up. The no-starving guarantee covers
 * known facts; facts in box 0-1 are still being learned (docs/testing.md §4).
 */
export const KNOWN_BOX = 2;

/** The known facts whose review day `day` has reached, most overdue first. */
export function overdueKnown(
  items: Readonly<Record<string, { readonly box: number; readonly due: number }>>,
  day: number,
): { item: string; days: number }[] {
  return Object.entries(items)
    .filter(([, record]) => record.box >= KNOWN_BOX && record.due <= day)
    .map(([item, record]) => ({ item, days: day - record.due }))
    .sort((a, b) => b.days - a.days || (a.item < b.item ? -1 : 1));
}

/** What a day report records about due known facts when a session begins on `day`. */
export function dueAtSessionStart(
  items: Readonly<Record<string, { readonly box: number; readonly due: number }>>,
  day: number,
): Pick<DayReport, 'dueAtStart' | 'maxOverdueAtStart' | 'mostOverdue'> {
  const due = overdueKnown(items, day);
  return {
    dueAtStart: due.length,
    maxOverdueAtStart: due[0]?.days ?? 0,
    mostOverdue: due[0]?.item ?? null,
  };
}

/** What a day report records about the market when the session ends (after shopping). */
export function marketAtEnd(
  view: Pick<GameView, 'coins' | 'market'>,
): Pick<DayReport, 'coinsAtEnd' | 'forSale' | 'toSaveFor'> {
  const forSale = view.market.items.filter((item) => item.available && !item.owned);
  return {
    coinsAtEnd: view.coins,
    forSale: forSale.length,
    toSaveFor: forSale.filter((item) => item.price > view.coins).length,
  };
}

/**
 * Add a day's events to its report: answers, coins by reason, stickers, eggs, hatches and growth,
 * lit panes, purchases and gifts, levels and bosses, quests, the goal and the gift.
 */
export function tallyEvents(
  report: SimulationReport,
  entry: DayReport,
  events: readonly { type: string; data: unknown }[],
): void {
  const index = entry.index;
  for (const e of events) {
    if (e.type === 'answer.incorrect') entry.answers += 1;
    else if (e.type === 'answer.correct') {
      entry.answers += 1;
      entry.correct += 1;
      if (event<{ bucket: string }>(e.data).bucket === 'fast') entry.fast += 1;
    } else if (e.type === 'coins.earned') {
      const { amount, reason } = event<{ amount: number; reason: string }>(e.data);
      entry.coins += amount;
      entry.coinsBy[reason] = (entry.coinsBy[reason] ?? 0) + amount;
    } else if (e.type === 'sticker.earned') {
      entry.stickers.push(event<{ sticker: string }>(e.data).sticker);
    } else if (e.type === 'egg.received') {
      const dragon = event<{ dragon: string }>(e.data).dragon;
      entry.eggs.push(dragon);
      report.eggDays[dragon] ??= index;
    } else if (e.type === 'pane.lit') {
      entry.panes += 1;
    } else if (e.type === 'item.purchased') {
      entry.bought.push(event<{ item: string }>(e.data).item);
    } else if (e.type === 'dragon.hatched') {
      const dragon = event<{ dragon: string }>(e.data).dragon;
      entry.hatched.push(dragon);
      (report.stages[dragon] ??= {})['hatchling'] ??= index;
    } else if (e.type === 'dragon.grew' || e.type === 'dragon.crowned') {
      const { dragon, stage } = event<{ dragon: string; stage?: string }>(e.data);
      const reached = stage ?? 'crowned';
      entry.grew.push(`${dragon}:${reached}`);
      (report.stages[dragon] ??= {})[reached] ??= index;
    } else if (e.type === 'level.completed') {
      const { level, firstTime } = event<{ level: string; firstTime: boolean }>(e.data);
      if (firstTime) {
        entry.levels.push(level);
        report.levelDays[level] ??= index;
      }
    } else if (e.type === 'boss.defeated') {
      const boss = event<{ boss: string }>(e.data).boss;
      entry.bosses.push(boss);
      report.bossDays[boss] ??= index;
    } else if (e.type === 'finale.completed') report.finaleDay ??= index;
    else if (e.type === 'quest.claimed') entry.quests += 1;
    else if (e.type === 'daily.goal-reached') entry.goalReached = true;
    else if (e.type === 'gift.opened') {
      entry.giftOpened = true;
      const { grant } = event<{ grant: { kind: string; item?: string } }>(e.data);
      if (grant.kind === 'cosmetic' && grant.item !== undefined) entry.gifted.push(grant.item);
    }
  }
}
/** Simulate `days` days of a learner, from `FIRST_DAY`. */
export async function simulate(
  learner: LearnerName,
  days: number,
  options: SimulateOptions = {},
): Promise<SimulationReport> {
  const seed = options.seed ?? 'simulation';
  const profile = LEARNERS[learner];
  const child = new Learner(profile, seed);
  let decision: { n: number; right: boolean; elapsedMs: number } | null = null;
  let today = 0;
  const style: Style = {
    right: (n: number, view: ProblemRoundView) => {
      const problem = view.problem!;
      const expected = oracle(problem.problem, problem.step);
      const digits = expected.kind === 'number' ? String(expected.value).length : 2;
      const recall = child.recall(knowledgeKey(problem.item));
      decision = { n, ...child.respond(view, digits) };
      if (options.onAnswer) {
        const state = player.state();
        const level = view.source.kind === 'level' ? view.source.level : null;
        options.onAnswer({
          day: today,
          activity: view.activity,
          level,
          replay: level !== null && (state.levels[level]?.stars ?? 0) > 0,
          item: problem.item,
          step: problem.step,
          tier: itemTier(state, problem.item, state.day ?? 0),
          box: state.items[problem.item]?.box ?? null,
          reask: problem.reask,
          input: problem.input,
          recall,
          right: decision.right,
          elapsedMs: decision.elapsedMs,
        });
      }
      return decision.right;
    },
    elapsedMs: (n: number) => (decision !== null && decision.n === n ? decision.elapsedMs : 4000),
    clumsy: profile.clumsy,
  };
  const pack = options.pack ?? loadPack();
  const player = new SimPlayer(style, `${seed}:${learner}`, undefined, pack);
  const report: SimulationReport = {
    learner,
    seed,
    daysSimulated: days,
    content: {
      revision: pack.revision,
      levels: pack.data.levels.map((level) => level.id),
      bosses: pack.data.bosses.map((boss) => boss.id),
      tableDragons: pack.data.dragons.filter((d) => d.kind === 'table').map((d) => d.id),
      cosmetics: pack.data.cosmetics.length,
    },
    days: [],
    failures: [],
    stages: {},
    finalStages: {},
    window: { dim: 0, bronze: 0, silver: 0, gold: 0 },
    division: { dim: 0, bronze: 0, silver: 0, gold: 0 },
    dimFacts: [],
    dragons: {},
    stars: {},
    eggDays: {},
    bossDays: {},
    levelDays: {},
    finaleDay: null,
    coins: 0,
    cosmetics: 0,
    stickers: 0,
    overdue: [],
  };
  const first = dayNumber(FIRST_DAY)!;
  for (let index = 0; index < days; index++) {
    const day = first + index;
    today = index;
    const entry = emptyDay(index, isoDay(day), profile.playsOn(index));
    report.days.push(entry);
    if (!entry.played) {
      options.onDay?.(entry);
      continue;
    }
    child.day = day;
    const fromEvent = player.events.length;
    const fromCommit = player.hashes.length;
    await player.act({ type: 'startSession', day: entry.day });
    Object.assign(entry, dueAtSessionStart(player.state().items, day));
    const elapsedBefore = child.elapsedMs;
    await playSession(player, options.answersPerDay ?? profile.answersPerDay);
    entry.answerMs = child.elapsedMs - elapsedBefore;
    entry.cosmeticsOwned = player.state().cosmetics.owned.length;
    Object.assign(entry, marketAtEnd(player.view()));
    entry.commits = player.hashes.length - fromCommit;
    tallyEvents(report, entry, player.events.slice(fromEvent));
    options.onDay?.(entry);
  }
  const view: GameView = player.view();
  const state = player.state();
  const lastDay = first + days - 1;
  report.failures = [...player.failures];
  report.finalStages = Object.fromEntries(view.dragons.map((d) => [d.id, d.stage]));
  report.window = counts(view.window.cells);
  report.division = counts(view.window.division);
  report.dimFacts = [...view.window.cells, ...view.window.division]
    .filter((cell) => cell.level === 'dim')
    .map((cell) => cell.item);
  report.dragons = Object.fromEntries(
    view.dragons.map((d) => [d.id, { stage: d.stage, ...d.mastery, due: d.dueItems }]),
  );
  report.stars = Object.fromEntries(
    view.hub.regions.flatMap((r) => r.levels).map((l) => [l.id, l.stars]),
  );
  report.coins = view.coins;
  report.cosmetics = state.cosmetics.owned.length;
  report.stickers = Object.keys(state.stickers).length;
  report.overdue = overdueKnown(state.items, lastDay);
  await player.dispose();
  return report;
}

/** Mastery levels in order, for summaries. */
export { LEVELS as MASTERY_ORDER };
