/**
 * Problem rounds and level runs (walking skeleton).
 *
 * A level run plays the level's activities in order. Each problem activity is a round: problems
 * are served one at a time; each answer is graded, moves the item's Leitner box, pays coins and
 * may schedule a re-ask job about `balance.reask.delay` turns later (at most
 * `balance.reask.maxPerRound` per round). Re-ask jobs are anchored to the round's runtime phase,
 * so closing the round cancels any that have not fired.
 *
 * Not implemented yet (S2): the adaptive mix (rounds draw uniformly from their skills, avoiding
 * recent items), minigame activities and generators other than mul.fact/div.fact/mul.missing
 * (a run skips activities it cannot play), arena, snack time and placement.
 */
import { requireValue } from '@aegis/runtime';
import type { DeepReadonly } from '@aegis/runtime';
import {
  EVENTS,
  PROBLEM_ACTIVITY_KINDS,
  expectedAnswer,
  firstStep,
  isoDay,
  parseItemId,
  sameAnswer,
} from '../contract';
import type {
  AnswerValue,
  InputMode,
  Level,
  ProblemActivityKind,
  ProblemRound,
  RoundEndReason,
  RoundSource,
  Skill,
} from '../contract';
import { canGenerate, choicesFor, problemFor } from '../learning/generate';
import { digits, masteryLevel, responseBucket, updateItem } from '../learning/items';
import { applyGrowth } from './dragons';
import { openRegions, starsFor } from './levels';
import { awardStickers, earnCoins, grantEgg, grantItem } from '../economy/rewards';
import { triggerBeats } from '../story/beats';
import type { Ctx, Data } from '../types';

/** A phase allowance large enough that rounds are never limited by it. */
const ROUND_ALLOWANCE = 1_000_000;
const RECENT_LIMIT = 10;

export function activeProblemRound(ctx: Ctx): ProblemRound | null {
  const round = ctx.state.round;
  return round !== null && round.type === 'problems' && round.status === 'active' ? round : null;
}

function skillById(data: Data, id: string): DeepReadonly<Skill> | undefined {
  return data.skills.find((skill) => skill.id === id);
}

/** Round skills this build can generate problems for. */
export function playableSkills(
  data: Data,
  skills: readonly string[],
  index: ReadonlyMap<string, readonly string[]>,
): string[] {
  return skills.filter((id) => {
    const skill = skillById(data, id);
    return skill !== undefined && canGenerate(skill) && (index.get(id)?.length ?? 0) > 0;
  });
}

export function startProblemRound(
  ctx: Ctx,
  index: ReadonlyMap<string, readonly string[]>,
  options: {
    activity: ProblemActivityKind;
    source: RoundSource;
    skills: string[];
    input: InputMode;
    target: number | null;
    meter: { value: number; target: number } | null;
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
    placement: null,
    status: 'active',
    endReason: null,
  };
  ctx.emit(EVENTS.roundStarted, { round: id, activity: options.activity });
  serveNext(ctx, index);
}

/** The recently served items that may not be served again yet (none when `window` is 0). */
export function blockedRecent(recent: readonly string[], window: number): string[] {
  return window <= 0 ? [] : recent.slice(-window);
}

function roundDone(round: ProblemRound): boolean {
  if (round.meter !== null && round.meter.value >= round.meter.target) return true;
  return round.target !== null && round.answered >= round.target;
}

/** Serve the next problem: a fired re-ask first, else a fresh draw from the round's skills. */
export function serveNext(ctx: Ctx, index: ReadonlyMap<string, readonly string[]>): void {
  const round = activeProblemRound(ctx);
  if (!round) return;
  if (roundDone(round)) {
    completeRound(ctx, index, 'finished');
    return;
  }
  const data = ctx.content.data;
  const problems = ctx.random('problems');
  const skills = playableSkills(data, round.skills, index);
  let item: string;
  let skill: DeepReadonly<Skill>;
  const reask = round.queue.shift();
  if (reask !== undefined) {
    item = reask;
    skill = skillById(data, skills.find((id) => index.get(id)?.includes(reask)) ?? skills[0]!)!;
  } else {
    skill = skillById(data, problems.pick(skills))!;
    const universe = index.get(skill.id) ?? [];
    const recent = blockedRecent(round.recent, data.balance.mix.noRepeatWithin);
    const fresh = universe.filter((candidate) => !recent.includes(candidate));
    // Skeleton mix: new facts first, so a first round meets as many facts as it can.
    const unseen = fresh.filter((candidate) => ctx.state.items[candidate] === undefined);
    item = problems.pick(unseen.length > 0 ? unseen : fresh.length > 0 ? fresh : universe);
  }
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
    reask: reask !== undefined,
    hinted: false,
  };
}

function isWindowItem(item: string): boolean {
  const kind = parseItemId(item)?.kind;
  return kind === 'mul' || kind === 'div';
}

/**
 * Unlock the daily gift once today's correct answers reach the goal. Checked after answers and
 * after the parent changes the goal, so lowering the goal below today's count still unlocks it.
 */
export function checkDailyGoal(ctx: Ctx): void {
  const daily = ctx.state.daily;
  if (daily && daily.gift === 'locked' && daily.correct >= daily.goal) {
    daily.gift = 'ready';
    ctx.emit(EVENTS.dailyGoalReached, { day: isoDay(daily.day) });
  }
}

function recordDay(ctx: Ctx, correct: boolean, fast: boolean): void {
  const state = ctx.state;
  const day = state.day ?? 0;
  if (state.daily && state.daily.day === day) {
    state.daily.answers += 1;
    if (correct) state.daily.correct += 1;
    if (fast) state.daily.fast += 1;
    checkDailyGoal(ctx);
  }
  const record = state.history[state.history.length - 1];
  if (record && record.day === day) {
    record.answers += 1;
    if (correct) record.correct += 1;
    if (fast) record.fast += 1;
  }
}

/** Grade the answer to the current problem (the `answer` command's start). */
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
  const day = ctx.state.day ?? 0;
  const before = ctx.state.items[current.item];
  const after = updateItem(before, bucket, day, data.balance);
  ctx.state.items[current.item] = after;
  if (correct && after.box > (before?.box ?? 0)) {
    ctx.emit(EVENTS.itemPromoted, { item: current.item, box: after.box });
  }
  const levelBefore = masteryLevel(before, data.balance);
  const levelAfter = masteryLevel(after, data.balance);
  if (
    isWindowItem(current.item) &&
    levelAfter !== levelBefore &&
    levelAfter !== 'dim' &&
    levelBefore !== 'gold'
  ) {
    const rank = ['dim', 'bronze', 'silver', 'gold'];
    if (rank.indexOf(levelAfter) > rank.indexOf(levelBefore)) {
      ctx.emit(EVENTS.paneLit, { item: current.item, level: levelAfter });
    }
  }
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
    if (round.reasks < data.balance.reask.maxPerRound && !current.reask) {
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
  recordDay(ctx, correct, bucket === 'fast');
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

function levelOf(data: Data, id: string): DeepReadonly<Level> | undefined {
  return data.levels.find((level) => level.id === id);
}

/** Finish the active round, record its result and, at the end of a level, complete the level. */
export function completeRound(
  ctx: Ctx,
  index: ReadonlyMap<string, readonly string[]>,
  reason: RoundEndReason,
): void {
  const round = ctx.state.round;
  if (!round || round.status !== 'active') return;
  round.status = 'complete';
  round.endReason = reason;
  if (round.type === 'problems') round.current = null;
  ctx.enterPhase('hub', 0, 'cancel');
  const answered = round.type === 'problems' ? round.answered : 0;
  const correct = round.type === 'problems' ? round.correct : 0;
  const fast = round.type === 'problems' ? round.fast : 0;
  ctx.emit(EVENTS.roundCompleted, { round: round.id, answered, correct, fast });
  const run = ctx.state.run;
  if (round.source.kind === 'level' && run && run.level === round.source.level) {
    const activity = round.source.activity;
    // Only a round played to its end completes the activity; quitting or the parent's time
    // limit keeps the answers' progress but leaves the activity to finish another time.
    const completed = reason === 'finished' || reason === 'time-up';
    run.results = [
      ...run.results.filter((r) => r.activity !== activity),
      { activity, answered, correct, fast, completed },
    ].sort((a, b) => a.activity - b.activity);
    if (completed) {
      const before = run.next;
      run.next = Math.max(run.next, activity + 1);
      advanceRun(ctx, index, before);
    }
  }
  applyGrowth(ctx, index);
  awardStickers(ctx);
}

/**
 * Skip activities this build cannot play, then complete the level when the run first reaches its
 * end. `before` is the run's next activity before this step: replaying an activity of a finished
 * run does not complete the level again (start the level again for a new run instead).
 */
function advanceRun(ctx: Ctx, index: ReadonlyMap<string, readonly string[]>, before: number): void {
  const run = ctx.state.run!;
  const level = levelOf(ctx.content.data, run.level)!;
  while (run.next < level.activities.length && !canPlay(ctx.content.data, level, run.next, index)) {
    const skipped = run.next;
    run.results = [
      ...run.results.filter((r) => r.activity !== skipped),
      { activity: skipped, answered: 0, correct: 0, fast: 0, completed: false },
    ].sort((a, b) => a.activity - b.activity);
    run.next += 1;
  }
  if (before < level.activities.length && run.next >= level.activities.length) {
    completeLevel(ctx, index);
  }
}

export function canPlay(
  data: Data,
  level: DeepReadonly<Level>,
  activityIndex: number,
  index: ReadonlyMap<string, readonly string[]>,
): boolean {
  const activity = level.activities[activityIndex];
  return (
    activity !== undefined &&
    (PROBLEM_ACTIVITY_KINDS as readonly string[]).includes(activity.kind) &&
    playableSkills(data, activity.skills, index).length > 0
  );
}

/** Start activity `activityIndex` of the active run as a problem round. */
export function startRunActivity(
  ctx: Ctx,
  index: ReadonlyMap<string, readonly string[]>,
  activityIndex: number,
): void {
  const run = ctx.state.run!;
  const data = ctx.content.data;
  const level = levelOf(data, run.level)!;
  if (!canPlay(data, level, activityIndex, index)) {
    const before = run.next;
    run.next = Math.max(run.next, activityIndex);
    advanceRun(ctx, index, before);
    if (run.next < level.activities.length && ctx.state.run) startRunActivity(ctx, index, run.next);
    return;
  }
  const activity = level.activities[activityIndex]!;
  const boss = activity.kind === 'boss' ? data.bosses.find((b) => b.id === level.boss) : undefined;
  startProblemRound(ctx, index, {
    activity: activity.kind as ProblemActivityKind,
    source: { kind: 'level', level: level.id, activity: activityIndex },
    skills: playableSkills(data, activity.skills, index),
    input: activity.input,
    target: activity.count,
    meter: boss ? { value: 0, target: boss.meter } : null,
  });
}

/** Complete the run's level: stars, coins for new stars, first-time rewards, boss, unlocks. */
export function completeLevel(ctx: Ctx, index: ReadonlyMap<string, readonly string[]>): void {
  const run = ctx.state.run!;
  const data = ctx.content.data;
  const level = levelOf(data, run.level)!;
  const regionsBefore = openRegions(ctx.state, data);
  const answered = run.results.reduce((sum, r) => sum + r.answered, 0);
  const correct = run.results.reduce((sum, r) => sum + r.correct, 0);
  const fast = run.results.reduce((sum, r) => sum + r.fast, 0);
  // A run with no answers earns stars by completion only when every activity was really played
  // (minigame-only levels); a run whose activities were all skipped counts as completed (1 star).
  const played = run.results.every((r) => r.completed);
  const stars =
    answered === 0 && !played
      ? 1
      : starsFor(answered, correct, fast, level.stars ?? data.balance.stars);
  const progress = ctx.state.levels[level.id] ?? {
    stars: 0,
    bestAccuracy: 0,
    plays: 0,
    placed: false,
    paidStars: 0,
  };
  const firstTime = progress.stars === 0;
  const accuracy = answered === 0 ? 100 : (correct * 100 - ((correct * 100) % answered)) / answered;
  ctx.state.levels[level.id] = {
    stars: Math.max(progress.stars, stars),
    bestAccuracy: Math.max(progress.bestAccuracy, accuracy),
    plays: progress.plays + 1,
    placed: progress.placed,
    paidStars: Math.max(progress.paidStars, stars),
  };
  for (let star = progress.paidStars + 1; star <= stars; star++) {
    earnCoins(ctx, level.rewards.coins[star - 1] ?? 0, 'stars');
  }
  if (firstTime) {
    for (const dragon of level.rewards.eggs) grantEgg(ctx, dragon);
    for (const item of level.rewards.cosmetics) grantItem(ctx, item, `level:${level.id}:${item}`);
  }
  ctx.emit(EVENTS.levelCompleted, { level: level.id, stars, firstTime });
  if (level.boss && !ctx.state.bosses[level.boss]) {
    ctx.state.bosses[level.boss] = { defeatedDay: ctx.state.day ?? 0 };
    earnCoins(ctx, data.balance.coins.bossDefeated, 'boss');
    ctx.emit(EVENTS.bossDefeated, { boss: level.boss });
    triggerBeats(ctx, (t) => t.kind === 'boss-defeated' && t.boss === level.boss);
  }
  for (const region of openRegions(ctx.state, data)) {
    if (!regionsBefore.includes(region)) ctx.emit(EVENTS.regionUnlocked, { region });
  }
  triggerBeats(ctx, (t) => t.kind === 'level-complete' && t.level === level.id);
  applyGrowth(ctx, index);
  awardStickers(ctx);
}

/** Close a finished round (and a finished run) to return to the map. */
export function closeRound(ctx: Ctx): void {
  const run = ctx.state.run;
  ctx.state.round = null;
  if (run) {
    const level = levelOf(ctx.content.data, run.level);
    if (!level || run.next >= level.activities.length) ctx.state.run = null;
  }
}
