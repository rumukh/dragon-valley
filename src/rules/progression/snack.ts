/**
 * Snack time (docs/design.md §5.12): feed hungry dragons, one or all of them. A dragon is hungry
 * when at least `balance.hungry.minDue` of its facts are due; the snack serves those due facts
 * first (most overdue first), then the dragon's weakest known facts, 6 to 10 problems with auto
 * input. Feeding hungry dragons is the spaced review.
 */
import { clamp } from '../learning/selection';
import { dueItems, hungryDragons, itemsOf } from './dragons';
import { playableSkills, startProblemRound } from './problems';
import type { Index } from './problems';
import type { Ctx, Data, ReadState } from '../types';

export const SNACK_MIN = 6;
export const SNACK_MAX = 10;

/** Problems in a snack: one per due fact, at least `SNACK_MIN` and at most `SNACK_MAX`. */
export function snackTarget(due: number): number {
  return clamp(due, SNACK_MIN, SNACK_MAX);
}

/** The dragons a snack feeds: the named hungry dragon, or every hungry dragon. */
function fed(state: ReadState, data: Data, index: Index, dragon: string | null): string[] {
  const hungry = hungryDragons(state, data, index);
  return dragon === null ? hungry : hungry.filter((id) => id === dragon);
}

function snackSkills(data: Data, dragons: readonly string[], index: Index): string[] {
  const skills = data.dragons
    .filter((d) => dragons.includes(d.id))
    .flatMap((d) => [...d.skills, ...d.divisionSkills]);
  return playableSkills(data, [...new Set(skills)], index);
}

/** Why snack time cannot start, or `null`. */
export function snackProblem(
  state: ReadState,
  data: Data,
  index: Index,
  dragon: string | null,
): { code: string; message: string } | null {
  if (dragon !== null && state.dragons[dragon] === undefined) {
    return { code: 'unknown-dragon', message: 'No such dragon.' };
  }
  const dragons = fed(state, data, index, dragon);
  if (dragons.length === 0 || snackSkills(data, dragons, index).length === 0) {
    return { code: 'not-hungry', message: 'No dragon is hungry right now.' };
  }
  return null;
}

export function startSnack(ctx: Ctx, index: Index, dragon: string | null): void {
  const data = ctx.content.data;
  const dragons = fed(ctx.state, data, index, dragon);
  const skills = snackSkills(data, dragons, index);
  const due = dueItems(ctx.state, itemsOf(skills, index));
  startProblemRound(ctx, index, {
    activity: 'snack',
    source: { kind: 'snack', dragon },
    skills,
    input: 'auto',
    target: snackTarget(due),
    meter: null,
  });
}
