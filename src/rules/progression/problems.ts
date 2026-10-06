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
 * current ladder step for placement).
 */
import { requireValue } from '@aegis/runtime';
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { EVENTS, expectedAnswer, firstStep, sameAnswer } from '../contract';
import type {
  AnswerValue,
  InputMode,
  PlacementProgress,
  ProblemActivityKind,
  ProblemRound,
  RoundSource,
  Skill,
} from '../contract';
import { canGenerate, choicesFor, problemFor } from '../learning/generate';
import { creditItem } from '../learning/credit';
import { digits, responseBucket } from '../learning/items';
import {
  blockedRecent,
  focusItems,
  pickArena,
  pickDue,
  pickMixed,
  pickPlacement,
  pickSnack,
} from '../learning/selection';
import { recordAnswer } from '../economy/daily';
import { earnCoins } from '../economy/rewards';
import { itemsOf } from './dragons';
import { advanceLadder, ladderDone } from './ladder';
import type { Ctx, Data, ReadState } from '../types';

/** A phase allowance large enough that rounds are never limited by it. */
export const ROUND_ALLOWANCE = 1_000_000;
/** Items remembered per round (the state schema's cap), for no-repeat and served-first draws. */
const RECENT_LIMIT = 20;

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

/** A playable skill that can practise `item`: the round's own first, else any in the pack. */
export function skillFor(
  data: Data,
  skills: readonly string[],
  item: string,
  index: Index,
): DeepReadonly<Skill> | undefined {
  const owns = (id: string) => index.get(id)?.includes(item) ?? false;
  const own = playableSkills(data, skills, index).find(owns);
  if (own !== undefined) return skillById(data, own);
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

function chooseItem(ctx: Ctx, round: ProblemRound, index: Index, random: RandomStream): string {
  const state = ctx.state;
  const data = ctx.content.data;
  const blocked = blockedRecent(round.recent, data.balance.mix.noRepeatWithin);
  if (round.placement !== null) {
    const step = data.placement.steps[round.placement.step]!;
    return pickPlacement({
      state,
      pool: index.get(step.skill) ?? [],
      blocked: round.recent,
      random,
    });
  }
  const pool = itemsOf(playableSkills(data, round.skills, index), index);
  const served = round.recent;
  if (round.activity === 'snack') return pickSnack({ state, pool, blocked, served, random });
  if (round.activity === 'arena') return pickArena({ state, pool, blocked, served, random });
  if (round.activity === 'boss' && round.source.kind === 'level') {
    const source = round.source;
    const level = data.levels.find((l) => l.id === source.level);
    const share = data.bosses.find((b) => b.id === level?.boss)?.reviewShare ?? 0;
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
        pickDue(state, due, random) ?? (review.length > 0 ? random.pick(review) : null);
      if (picked !== null) return picked;
    }
  }
  return pickMixed({
    state,
    data,
    pool,
    blocked,
    served,
    focus: focusItems(state, data, index, pool),
    random,
  });
}

/** Serve the next problem: a fired re-ask first, else a fresh draw. */
export function serveNext(ctx: Ctx, index: Index): void {
  const round = activeProblemRound(ctx);
  if (!round) return;
  const data = ctx.content.data;
  const problems = ctx.random('problems');
  const queued = round.queue.shift();
  const item = queued ?? chooseItem(ctx, round, index, problems);
  const skillIds =
    round.placement !== null ? [data.placement.steps[round.placement.step]!.skill] : round.skills;
  const skill = skillFor(data, skillIds, item, index)!;
  const problem = problemFor(skill, item, problems);
  const box = ctx.state.items[item]?.box ?? 0;
  const input =
    round.input === 'auto'
      ? box < data.balance.input.keypadFromBox
        ? 'choice'
        : 'keypad'
      : round.input;
  round.asked += 1;
  round.recent = [...round.recent, item].slice(-RECENT_LIMIT);
  round.current = {
    index: round.asked,
    item,
    problem,
    input,
    choices:
      input === 'choice'
        ? choicesFor(problem, data.balance.input.choices, ctx.random('distractors'))
        : null,
    step: firstStep(problem),
    reask: queued !== undefined,
    hinted: false,
  };
}

/** Grade the answer to the current problem (the `answer`/`placementAnswer` command's start). */
export function gradeAnswer(ctx: Ctx, value: AnswerValue, elapsedMs: number): void {
  const round = activeProblemRound(ctx)!;
  const current = round.current!;
  const data = ctx.content.data;
  const expected = requireValue(expectedAnswer(current.problem, current.step));
  const correct = sameAnswer(value, expected);
  if (current.step === 'operation' && correct) {
    round.current = { ...current, step: 'answer' };
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
  const bucket = responseBucket(correct, elapsedMs, current.input, answerDigits, data.balance);
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
