/**
 * The Lightning Arena (docs/design.md §5.11): an optional race of known facts against the child's
 * own best. It opens once `balance.arena.unlockAfter` is complete, if the parent left it on. The
 * shell keeps the time (60 seconds) and ends the round with `endRound{ reason: 'time-up' }`; the
 * rules cap it at `balance.arena.maxProblems`. Facts answered right before come first; misses are
 * never re-asked and never cost anything. The score is the number of right answers; a finished
 * race updates the personal best (`state.arena`).
 */
import { EVENTS } from '../contract';
import type { ProblemRound } from '../contract';
import { isComplete } from './levels';
import { playableSkills, startProblemRound } from './problems';
import type { Index } from './problems';
import type { Ctx, Data, ReadState } from '../types';

/** Problem skills of every completed level: what the Arena may ask. */
export function arenaSkills(state: ReadState, data: Data, index: Index): string[] {
  const skills = data.levels
    .filter((level) => isComplete(state, level.id))
    .flatMap((level) =>
      level.activities
        .filter((activity) => activity.kind === 'feeding' || activity.kind === 'boss')
        .flatMap((activity) => activity.skills),
    );
  return playableSkills(data, [...new Set(skills)], index);
}

/** Why the Arena cannot start, or `null`. */
export function arenaProblem(state: ReadState, data: Data, index: Index): string | null {
  if (!state.settings.arena) return 'The Lightning Arena is switched off.';
  if (!isComplete(state, data.balance.arena.unlockAfter)) return 'The Arena is not open yet.';
  return arenaSkills(state, data, index).length === 0 ? 'Nothing to race with yet.' : null;
}

export function startArena(ctx: Ctx, index: Index): void {
  startProblemRound(ctx, index, {
    activity: 'arena',
    source: { kind: 'arena' },
    skills: arenaSkills(ctx.state, ctx.content.data, index),
    input: 'auto',
    target: ctx.content.data.balance.arena.maxProblems,
    meter: null,
  });
}

/** A race that ran to its end (time up or the problem cap) counts for the personal best. */
export function finishArena(ctx: Ctx, round: ProblemRound): void {
  const arena = ctx.state.arena;
  const previous = arena.best;
  arena.plays += 1;
  arena.best = Math.max(previous, round.correct);
  ctx.emit(EVENTS.arenaFinished, {
    score: round.correct,
    best: arena.best,
    record: round.correct > previous,
  });
}
