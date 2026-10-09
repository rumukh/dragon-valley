/**
 * The placement ladder ("Show the dragons what you know!", docs/design.md §5.12): a few problems
 * per step of `content.placement.steps`. Passing a step (`passAccuracy`) places its levels and
 * moves up the ladder; failing a step, `stopAfterMisses` misses in a row or `maxProblems`
 * answers end it gently. Pure functions over the round's `PlacementProgress`.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { DEFAULT_GRADE } from '../contract';
import type { Grade, Placement, PlacementProgress } from '../contract';
import { percentOf } from './levels';

/**
 * The placement ladder of `grade`: the steps whose `grades` name it (a step without `grades` is a
 * grade-3 rung). Grade 1 normally has none, so it has no placement check.
 */
export function placementFor(
  placement: DeepReadonly<Placement>,
  grade: Grade,
): DeepReadonly<Placement> {
  const steps = placement.steps.filter((step) => (step.grades ?? [DEFAULT_GRADE]).includes(grade));
  return steps.length === placement.steps.length ? placement : { ...placement, steps };
}

/** The ladder is over: every step asked, a step failed, or stopped early. */
export function ladderDone(
  progress: DeepReadonly<PlacementProgress>,
  placement: DeepReadonly<Placement>,
  answered: number,
): boolean {
  return progress.step >= placement.steps.length || answered >= placement.maxProblems;
}

/** Record one placement answer and climb, stop or continue the ladder. */
export function advanceLadder(
  progress: PlacementProgress,
  placement: DeepReadonly<Placement>,
  correct: boolean,
): void {
  const step = placement.steps[progress.step];
  if (!step) return;
  progress.stepAsked += 1;
  if (correct) {
    progress.stepCorrect += 1;
    progress.missesInRow = 0;
  } else {
    progress.missesInRow += 1;
  }
  const stop = () => {
    progress.step = placement.steps.length;
  };
  if (progress.missesInRow >= placement.stopAfterMisses) {
    stop();
    return;
  }
  if (progress.stepAsked < step.problems) return;
  if (percentOf(progress.stepCorrect, progress.stepAsked) < step.passAccuracy) {
    stop();
    return;
  }
  progress.placed = [...new Set([...progress.placed, ...step.levels])];
  progress.step += 1;
  progress.stepAsked = 0;
  progress.stepCorrect = 0;
}
