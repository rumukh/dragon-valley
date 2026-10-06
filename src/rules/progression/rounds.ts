/**
 * Rounds and level runs: the shared lifecycle of problem and minigame rounds.
 *
 * A level run plays the level's activities in order; each activity is one round (problem round
 * or minigame round). A round ends when it is finished (`finished`, or `time-up` in the Arena),
 * quit, or stopped by the parent's time limit; only a finished round completes its activity.
 * Activities this build cannot play (a minigame board not implemented yet) are skipped, and the level
 * completes when the run first reaches its end: stars, star coins, first-time eggs and cosmetics,
 * the boss, region unlocks, story beats, quests, growth and stickers.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { EVENTS, isMinigameKind } from '../contract';
import type { Level, MinigameActivityKind, ProblemActivityKind, RoundEndReason } from '../contract';
import { questProgress } from '../economy/daily';
import { awardStickers, earnCoins, grantEgg, grantItem } from '../economy/rewards';
import { canMakeBoard } from '../minigames/boards';
import { triggerBeats } from '../story/beats';
import { applyGrowth, itemsOf } from './dragons';
import { finishArena } from './arena';
import { openRegions, starsFor } from './levels';
import { startMinigameRound } from './minigame-rounds';
import { finishPlacement } from './placement';
import { playableSkills, startProblemRound } from './problems';
import type { Index } from './problems';
import type { Ctx, Data } from '../types';

function levelOf(data: Data, id: string): DeepReadonly<Level> | undefined {
  return data.levels.find((level) => level.id === id);
}

/** Whether this build can play activity `activityIndex` of `level`. */
export function canPlay(
  data: Data,
  level: DeepReadonly<Level>,
  activityIndex: number,
  index: Index,
): boolean {
  const activity = level.activities[activityIndex];
  if (activity === undefined) return false;
  if (isMinigameKind(activity.kind)) {
    const skills = data.skills.filter((skill) => activity.skills.includes(skill.id));
    return canMakeBoard(activity.kind, itemsOf(activity.skills, index), skills);
  }
  return playableSkills(data, activity.skills, index).length > 0;
}

/** Start activity `activityIndex` of the active run (skipping it if it cannot be played). */
export function startRunActivity(ctx: Ctx, index: Index, activityIndex: number): void {
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
  const source = { kind: 'level' as const, level: level.id, activity: activityIndex };
  if (isMinigameKind(activity.kind)) {
    startMinigameRound(ctx, index, {
      activity: activity.kind as MinigameActivityKind,
      source,
      skills: [...activity.skills],
      boards: activity.count,
    });
    return;
  }
  const boss = activity.kind === 'boss' ? data.bosses.find((b) => b.id === level.boss) : undefined;
  startProblemRound(ctx, index, {
    activity: activity.kind as ProblemActivityKind,
    source,
    skills: playableSkills(data, activity.skills, index),
    input: activity.input,
    target: activity.count,
    meter: boss ? { value: 0, target: boss.meter } : null,
  });
}

/** Finish the active round, record its result and, at the end of a level, complete the level. */
export function completeRound(ctx: Ctx, index: Index, reason: RoundEndReason): void {
  const round = ctx.state.round;
  if (!round || round.status !== 'active') return;
  round.status = 'complete';
  round.endReason = reason;
  const finished = reason === 'finished' || reason === 'time-up';
  if (round.type === 'problems') {
    round.current = null;
    // The boss's kindness cap: a finished boss round fills the meter with a final flourish.
    if (round.meter !== null && finished) round.meter.value = round.meter.target;
  }
  ctx.enterPhase('hub', 0, 'cancel');
  const answered = round.type === 'problems' ? round.answered : 0;
  const correct = round.type === 'problems' ? round.correct : 0;
  const fast = round.type === 'problems' ? round.fast : 0;
  ctx.emit(EVENTS.roundCompleted, { round: round.id, answered, correct, fast });
  if (round.type === 'problems' && round.placement !== null) {
    finishPlacement(ctx, round, finished);
  }
  if (round.type === 'problems' && round.activity === 'arena' && finished) {
    finishArena(ctx, round);
  }
  if (round.type === 'minigame' && finished) questProgress(ctx, 'play-minigame', 1);
  const run = ctx.state.run;
  if (round.source.kind === 'level' && run && run.level === round.source.level) {
    const activity = round.source.activity;
    run.results = [
      ...run.results.filter((r) => r.activity !== activity),
      { activity, answered, correct, fast, completed: finished },
    ].sort((a, b) => a.activity - b.activity);
    if (finished) {
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
function advanceRun(ctx: Ctx, index: Index, before: number): void {
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

/** Complete the run's level: stars, coins for new stars, first-time rewards, boss, unlocks. */
export function completeLevel(ctx: Ctx, index: Index): void {
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
  questProgress(ctx, 'finish-level', 1);
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
