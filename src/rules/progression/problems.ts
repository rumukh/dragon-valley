/**
 * Problem rounds: Feeding Time, the boss, snack time, the placement check (and later the other
 * problem activities). One problem is on screen at a time; each answer is graded, moves the
 * item's Leitner box, pays coins, counts for the day and may schedule a re-ask job about
 * `balance.reask.delay` turns later (at most `balance.reask.maxPerRound` per round, never in the
 * placement check). Re-ask jobs are anchored to the round's runtime phase, so leaving the round
 * cancels any that have not fired.
 *
 * Which item comes next is learning/selection.ts: re-asks first, then the activity's draw (the
 * mix for Feeding Time, spaced review for the boss's `reviewShare`, due reviews for snacks, the
 * current ladder step for placement). A round whose draw comes back empty serves nothing and
 * finishes: a snack of the valley's basket alone empties the basket as it goes.
 */
import { requireValue } from '@aegis/runtime';
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { EVENTS, OPERATORS, expectedAnswer, firstStep, sameAnswer } from '../contract';
import type {
  AnswerValue,
  InputMode,
  ItemState,
  PlacementProgress,
  Problem,
  ProblemActivityKind,
  ProblemRound,
  ProblemStep,
  ResolvedInputMode,
  RoundSource,
  Skill,
} from '../contract';
import { canGenerate, choicesFor, keypadPossible, problemFor } from '../learning/generate';
import { creditItem } from '../learning/credit';
import { digits, isDue, readingAllowanceMs, responseBucket } from '../learning/items';
import {
  blockedRecent,
  isRuleFact,
  isStrategyItem,
  lowSuccess,
  missedTwice,
  pickArena,
  pickMixed,
  pickPlacement,
  pickReview,
  pickSnack,
  roundFocus,
  roundTables,
} from '../learning/selection';
import { recordAnswer } from '../economy/daily';
import { earnCoins } from '../economy/rewards';
import { basketItems, firstTastes, itemsOf, taughtItems } from './dragons';
import { advanceLadder, ladderDone } from './ladder';
import type { Ctx, Data, ReadState } from '../types';

/** A phase allowance large enough that rounds are never limited by it. */
export const ROUND_ALLOWANCE = 1_000_000;
/** First tastes a snack serves at most (facts taught but never answered, every other problem). */
export const TASTES_PER_SNACK = 3;
/** Items remembered per round (the state schema's cap), for no-repeat and served-first draws. */
const RECENT_LIMIT = 20;

/** Integer division rounded down for non-negative operands. */
function quotient(a: number, b: number): number {
  return (a - (a % b)) / b;
}

export type Index = ReadonlyMap<string, readonly string[]>;

export function activeProblemRound(ctx: Ctx): ProblemRound | null {
  const round = ctx.state.round;
  return round !== null && round.type === 'problems' && round.status === 'active' ? round : null;
}

export function skillById(data: Data, id: string): DeepReadonly<Skill> | undefined {
  return data.skills.find((skill) => skill.id === id);
}

/** Skills this build can generate problems for (and that can produce an item). */
export function playableSkills(data: Data, skills: readonly string[], index: Index): string[] {
  return skills.filter((id) => {
    const skill = skillById(data, id);
    return skill !== undefined && canGenerate(skill) && (index.get(id)?.length ?? 0) > 0;
  });
}

/**
 * A playable skill that can practise `item`: the round's own first, else any in the pack. When
 * several of the round's skills own the item (a division fact is also a missing-factor item),
 * `random` picks one of them, so every skill of the activity is served.
 */
export function skillFor(
  data: Data,
  skills: readonly string[],
  item: string,
  index: Index,
  random?: RandomStream,
): DeepReadonly<Skill> | undefined {
  const owns = (id: string) => index.get(id)?.includes(item) ?? false;
  const own = playableSkills(data, skills, index).filter(owns);
  if (own.length > 0) {
    return skillById(data, own.length > 1 && random ? random.pick(own) : own[0]!);
  }
  return data.skills.find((skill) => canGenerate(skill) && owns(skill.id));
}

export function startProblemRound(
  ctx: Ctx,
  index: Index,
  options: {
    activity: ProblemActivityKind;
    source: RoundSource;
    skills: string[];
    input: InputMode;
    target: number | null;
    meter: { value: number; target: number } | null;
    placement?: PlacementProgress;
  },
): void {
  ctx.state.roundCounter += 1;
  const id = `r${ctx.state.roundCounter}`;
  ctx.enterPhase('round', ROUND_ALLOWANCE, 'cancel');
  ctx.state.round = {
    id,
    type: 'problems',
    activity: options.activity,
    source: options.source,
    skills: options.skills,
    input: options.input,
    target: options.target,
    meter: options.meter,
    asked: 0,
    answered: 0,
    correct: 0,
    fast: 0,
    streak: 0,
    bestStreak: 0,
    reasks: 0,
    queue: [],
    recent: [],
    current: null,
    feedback: null,
    coins: 0,
    placement: options.placement ?? null,
    status: 'active',
    endReason: null,
  };
  ctx.emit(EVENTS.roundStarted, { round: id, activity: options.activity });
  serveNext(ctx, index);
}

/** The round has nothing more to ask: target reached, meter full or ladder over. */
export function roundDone(data: Data, round: DeepReadonly<ProblemRound>): boolean {
  if (round.placement !== null) return ladderDone(round.placement, data.placement, round.answered);
  if (round.meter !== null && round.meter.value >= round.meter.target) return true;
  return round.target !== null && round.answered >= round.target;
}

/** Known items outside the round's own items, for the boss's spaced review. */
function reviewItems(
  state: ReadState,
  data: Data,
  pool: ReadonlySet<string>,
  index: Index,
): string[] {
  return Object.keys(state.items)
    .filter((item) => !pool.has(item) && state.items[item]!.correct > 0)
    .filter((item) => skillFor(data, [], item, index) !== undefined)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The round's own skill records. */
function skillsOf(data: Data, ids: readonly string[]): DeepReadonly<Skill>[] {
  return data.skills.filter((skill) => ids.includes(skill.id));
}

/** The level activity a round plays, if it comes from a level. */
function roundActivity(data: Data, round: DeepReadonly<ProblemRound>) {
  const source = round.source;
  return source.kind === 'level'
    ? data.levels.find((l) => l.id === source.level)?.activities[source.activity]
    : undefined;
}

/** The round's next item from its activity's draw, or `null` when it has nothing left to serve. */
function chooseItem(
  ctx: Ctx,
  round: ProblemRound,
  index: Index,
  random: RandomStream,
): string | null {
  const state = ctx.state;
  const data = ctx.content.data;
  const blocked = blockedRecent(round.recent, data.balance.mix.noRepeatWithin);
  if (round.placement !== null) {
    const step = data.placement.steps[round.placement.step]!;
    const pool = index.get(step.skill) ?? [];
    // Every other problem of a step prefers the chosen egg's facts (a table the step practises).
    const focus =
      round.placement.stepAsked % 2 === 0
        ? roundFocus(state, data, index, pool, skillsOf(data, [step.skill]))
        : null;
    return pickPlacement({ state, pool, blocked: round.recent, random, focus });
  }
  const skills = skillsOf(data, round.skills);
  const tables = roundTables(skills);
  let pool = itemsOf(playableSkills(data, round.skills, index), index);
  const served = round.recent;
  // Below the success band, snacks and reviews serve the likeliest successes first.
  const protect = lowSuccess(state, data);
  if (round.activity === 'snack') {
    const snack = round.source.kind === 'snack' ? round.source.dragon : null;
    if (round.source.kind === 'snack' && snack === null) {
      // Feeding every dragon empties the valley's basket too: due facts no hatched dragon eats.
      const basket = basketItems(state, data, index).filter((item) => !pool.includes(item));
      pool = [...pool, ...basket];
    }
    // Only facts the child has met or was taught (no division before the division levels), and
    // those it was taught but never answered as first tastes, at every other problem.
    const taught = taughtItems(state, data, index);
    pool = pool.filter((item) => state.items[item] !== undefined || taught.has(item));
    const tastes = firstTastes(state, data, index, snack, taught);
    pool = [...pool, ...tastes.filter((item) => !pool.includes(item))];
    return pickSnack({
      state,
      pool,
      blocked,
      served,
      random,
      likelyFirst: protect,
      tastes,
      tastesPerSnack: TASTES_PER_SNACK,
    });
  }
  if (round.activity === 'arena') return pickArena({ state, pool, blocked, served, random });
  if (!tables.has(0) && !tables.has(1) && served.some(isRuleFact)) {
    // At most one rule fact (× 0, × 1, 0 : n, n : 1) in a round that is not about them.
    const rest = pool.filter((item) => !isRuleFact(item));
    if (rest.length > 0) pool = rest;
  }
  const source = round.source;
  const activity = roundActivity(data, round);
  if (round.activity === 'feeding' && activity?.options['draw'] === 'weakest') {
    return pickSnack({ state, pool, blocked, served, random, likelyFirst: protect });
  }
  if (round.activity === 'boss' && source.kind === 'level') {
    const level = data.levels.find((l) => l.id === source.level);
    const boss = data.bosses.find((b) => b.id === level?.boss);
    const heads = boss?.heads ?? 1;
    if (heads > 1 && round.meter !== null && activity !== undefined) {
      // One head after another: head k is won over with the activity's k-th skill.
      const head = Math.min(heads - 1, quotient(round.meter.value * heads, round.meter.target));
      const own = playableSkills(data, [activity.skills[head] ?? ''], index);
      const headPool = own.length > 0 ? itemsOf(own, index) : pool;
      return pickMixed({ state, data, pool: headPool, blocked, served, focus: null, random });
    }
    const share = boss?.reviewShare ?? 0;
    if (random.int(0, 100) < share) {
      const review = reviewItems(state, data, new Set(pool), index).filter(
        (item) => !blocked.includes(item),
      );
      const day = state.day ?? 0;
      const due = review.filter((item) => {
        const record = state.items[item]!;
        return record.due <= day && record.lastDay < day;
      });
      const picked =
        pickReview(state, due, random, protect) ?? (review.length > 0 ? random.pick(review) : null);
      if (picked !== null) return picked;
    }
  }
  return pickMixed({
    state,
    data,
    pool,
    blocked,
    served,
    focus: roundFocus(state, data, index, pool, skills),
    random,
  });
}

/** The operation step of a story always offers the four operations, in this order: + − · :. */
const OPERATION_CHOICES: readonly AnswerValue[] = OPERATORS.map((operation): AnswerValue => ({
  kind: 'operation',
  operation,
}));

/** Choices for a problem's step: the operations, else answer options for choice input. */
function choicesAt(
  ctx: Ctx,
  problem: Problem,
  step: ProblemStep,
  input: ResolvedInputMode,
): AnswerValue[] | null {
  if (step === 'operation') return [...OPERATION_CHOICES];
  return input === 'choice'
    ? choicesFor(problem, ctx.content.data.balance.input.choices, ctx.random('distractors'))
    : null;
}

/**
 * The input a problem is asked with: the round's mode (`auto`: choice while the item is below
 * `keypadFromBox`, else keypad), by choice when the answer cannot be typed (comparisons, terms)
 * or when retrieval is made `easier` (a review or re-ask while recent success is low).
 */
export function inputFor(options: {
  round: InputMode;
  box: number;
  keypadFromBox: number;
  easier: boolean;
  typeable: boolean;
}): ResolvedInputMode {
  const resolved =
    options.round === 'auto'
      ? options.box < options.keypadFromBox
        ? 'choice'
        : 'keypad'
      : options.round;
  return resolved === 'keypad' && (options.easier || !options.typeable) ? 'choice' : resolved;
}

/** What a serving decision knows about the problem: its round and whether it is a re-ask. */
interface Serving {
  activity: ProblemActivityKind;
  /** The placement check (a measurement): served as is. */
  placement: boolean;
  reask: boolean;
}

/**
 * Whether retrieval is made easier (the problem is asked by choice): a re-ask or a review (a
 * snack, a due fact) while recent success is `low`; never in the Arena (a race) or the
 * placement check.
 */
export function easierRetrieval(serving: Serving & { due: boolean; low: boolean }): boolean {
  const { activity, placement, reask, due, low } = serving;
  return low && !placement && activity !== 'arena' && (reask || due || activity === 'snack');
}

/**
 * Whether the item is taught before it is asked (the shell shows its picture model first): a
 * strategy item (`isStrategyItem`) the child meets for the first time, never answered nor
 * credited by a board ("I do, we do, you do"), or any item whose last two answers were misses.
 * Not in the Arena (a race) or the placement check (a measurement).
 */
export function teachFirst(
  serving: Serving & { item: string; record: DeepReadonly<ItemState> | undefined },
): boolean {
  if (serving.placement || serving.activity === 'arena') return false;
  const first = serving.record === undefined && isStrategyItem(serving.item);
  return first || missedTwice(serving.record);
}

/**
 * Serve the next problem: a fired re-ask first, else a fresh draw. When the round has nothing
 * left to serve (a snack of the valley's basket empties it as it goes), nothing is put on screen
 * and the round finishes (`settleRound` in the adapter).
 */
export function serveNext(ctx: Ctx, index: Index): void {
  const round = activeProblemRound(ctx);
  if (!round) return;
  const data = ctx.content.data;
  const problems = ctx.random('problems');
  const queued = round.queue.shift();
  const item = queued ?? chooseItem(ctx, round, index, problems);
  if (item === null) return;
  const skillIds =
    round.placement !== null ? [data.placement.steps[round.placement.step]!.skill] : round.skills;
  const skill = skillFor(data, skillIds, item, index, problems)!;
  let problem = problemFor(skill, item, { problems, words: ctx.random('words'), data });
  if (
    problem.kind === 'word' &&
    round.activity === 'riddle-scrolls' &&
    roundActivity(data, round)?.options['pickOperation'] === false
  ) {
    // Riddle Scrolls without the operation step: the story is answered directly.
    problem = { ...problem, operation: null };
  }
  const record = ctx.state.items[item];
  const serving = {
    activity: round.activity,
    placement: round.placement !== null,
    reask: queued !== undefined,
  };
  const input = inputFor({
    round: round.input,
    box: record?.box ?? 0,
    keypadFromBox: data.balance.input.keypadFromBox,
    easier: easierRetrieval({
      ...serving,
      due: isDue(record, ctx.state.day ?? 0),
      low: lowSuccess(ctx.state, data),
    }),
    typeable: keypadPossible(problem),
  });
  const step = firstStep(problem);
  round.asked += 1;
  round.recent = [...round.recent, item].slice(-RECENT_LIMIT);
  round.current = {
    index: round.asked,
    item,
    problem,
    input,
    choices: choicesAt(ctx, problem, step, input),
    step,
    reask: queued !== undefined,
    hinted: false,
    ...(teachFirst({ ...serving, item, record }) ? { teach: true } : {}),
  };
}

/**
 * The reading time a problem's answer is allowed: a word problem's (`readingAllowanceMs`, from
 * its template's `words`), answered after its operation step when it has one; else none.
 */
export function storyAllowance(data: Data, problem: Problem): number {
  if (problem.kind !== 'word') return 0;
  const template = data.wordTemplates.find((t) => t.textKey === problem.template);
  return readingAllowanceMs(
    template?.words,
    data.balance.response.word,
    problem.operation !== null,
  );
}

/** Grade the answer to the current problem (the `answer`/`placementAnswer` command's start). */
export function gradeAnswer(ctx: Ctx, value: AnswerValue, elapsedMs: number): void {
  const round = activeProblemRound(ctx)!;
  const current = round.current!;
  const data = ctx.content.data;
  const expected = requireValue(expectedAnswer(current.problem, current.step));
  const correct = sameAnswer(value, expected);
  if (current.step === 'operation' && correct) {
    // The right operation: on to the number, with its own choices.
    round.current = {
      ...current,
      step: 'answer',
      choices: choicesAt(ctx, current.problem, 'answer', current.input),
    };
    round.feedback = {
      index: current.index,
      item: current.item,
      step: 'operation',
      correct: true,
      bucket: 'ok',
      given: value,
      expected,
      coins: 0,
    };
    return;
  }
  const answerDigits = expected.kind === 'number' ? digits(expected.value) : 1;
  const bucket = responseBucket(
    correct,
    elapsedMs,
    current.input,
    answerDigits,
    data.balance,
    storyAllowance(data, current.problem),
  );
  creditItem(ctx, current.item, bucket);
  round.answered += 1;
  let coins = 0;
  if (correct) {
    round.correct += 1;
    if (bucket === 'fast') round.fast += 1;
    round.streak += 1;
    round.bestStreak = Math.max(round.bestStreak, round.streak);
    ctx.state.bestStreak = Math.max(ctx.state.bestStreak, round.streak);
    if (round.meter) round.meter.value = Math.min(round.meter.target, round.meter.value + 1);
    coins = data.balance.coins.correct;
    earnCoins(ctx, data.balance.coins.correct, 'answer');
    if (round.streak % data.balance.coins.streakEvery === 0) {
      coins += data.balance.coins.streakBonus;
      earnCoins(ctx, data.balance.coins.streakBonus, 'streak');
    }
    round.coins += coins;
    ctx.emit(EVENTS.answerCorrect, {
      item: current.item,
      bucket: bucket as 'fast' | 'ok' | 'slow',
      streak: round.streak,
    });
  } else {
    round.streak = 0;
    ctx.emit(EVENTS.answerIncorrect, { item: current.item });
    const reaskable = round.placement === null && round.activity !== 'arena' && !current.reask;
    if (reaskable && round.reasks < data.balance.reask.maxPerRound) {
      round.reasks += 1;
      const phase = ctx.phase!;
      const offset = ctx.turn - phase.enteredTurn + data.balance.reask.delay;
      ctx.schedule({
        id: `reask:${round.id}:${round.reasks}`,
        rule: 'reask',
        payload: { round: round.id, item: current.item },
        anchor: { kind: 'phase-entry', instance: phase.instance, offset },
        phase: 'reask',
        priority: 0,
      });
      ctx.emit(EVENTS.reaskScheduled, { item: current.item, dueTurn: phase.enteredTurn + offset });
    }
  }
  if (round.placement !== null) advanceLadder(round.placement, data.placement, correct);
  recordAnswer(ctx, {
    correct,
    fast: bucket === 'fast',
    snack: round.activity === 'snack',
    streak: round.streak,
  });
  round.feedback = {
    index: current.index,
    item: current.item,
    step: current.step,
    correct,
    bucket,
    given: value,
    expected,
    coins,
  };
  round.current = null;
}
