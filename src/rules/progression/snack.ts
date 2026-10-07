/**
 * Snack time (docs/design.md §5.12): feed hungry dragons, one or all of them. A dragon is hungry
 * when at least `balance.hungry.minDue` of its facts are due. Feeding every dragon (`dragon:
 * null`) also empties the valley's basket: due facts no hatched dragon eats (`basketItems`).
 * The snack serves due facts first (`pickReview`: starving facts, then the most overdue or, while
 * recent success is low, the likeliest successes), with a first taste (`firstTastes`: a taught fact
 * never answered) at every other problem, up to `TASTES_PER_SNACK`, then the dragons' weakest known
 * facts. It has 6 to 10 problems with auto input; 4 to 6 while recent success is low, so a session
 * is not dominated by reviews the child cannot do yet. Feeding hungry dragons is the spaced review.
 * A snack of the basket alone (no dragon is hungry) is never longer than the basket and its first
 * tastes: each answer takes its fact out, and a right answer its twin too (`7 · 8` reviews
 * `8 · 7`).
 */
import { commutedId } from '../contract';
import { clamp, lowSuccess } from '../learning/selection';
import { basketItems, dueItems, firstTastes, hungryDragons, itemsOf } from './dragons';
import { TASTES_PER_SNACK, playableSkills, startProblemRound } from './problems';
import type { Index } from './problems';
import type { Ctx, Data, ReadState } from '../types';

export const SNACK_MIN = 6;
export const SNACK_MAX = 10;
/** Snack size while recent success is below `LOW_SUCCESS`. */
export const SNACK_MIN_LOW = 4;
export const SNACK_MAX_LOW = 6;

/**
 * Problems in a snack: one per due fact or first taste, within `SNACK_MIN`…`SNACK_MAX` (or the
 * `low` sizes).
 */
export function snackTarget(due: number, low = false): number {
  return low ? clamp(due, SNACK_MIN_LOW, SNACK_MAX_LOW) : clamp(due, SNACK_MIN, SNACK_MAX);
}

/** Facts among `items`, a fact and its commuted twin counted once (a right answer reviews both). */
export function distinctFacts(items: readonly string[]): number {
  const counted = new Set<string>();
  for (const item of items) {
    const twin = commutedId(item);
    if (twin === null || !counted.has(twin)) counted.add(item);
  }
  return counted.size;
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
  const basket = dragon === null ? basketItems(state, data, index).length : 0;
  if (basket === 0 && (dragons.length === 0 || snackSkills(data, dragons, index).length === 0)) {
    return { code: 'not-hungry', message: 'No dragon is hungry right now.' };
  }
  return null;
}

export function startSnack(ctx: Ctx, index: Index, dragon: string | null): void {
  const data = ctx.content.data;
  const dragons = fed(ctx.state, data, index, dragon);
  const skills = snackSkills(data, dragons, index);
  const basket = dragon === null ? basketItems(ctx.state, data, index) : [];
  const due = dueItems(ctx.state, itemsOf(skills, index)) + basket.length;
  // Room for the first tastes as well, so that they do not crowd out the due facts.
  const tastes = Math.min(TASTES_PER_SNACK, firstTastes(ctx.state, data, index, dragon).length);
  const target = snackTarget(due + tastes, lowSuccess(ctx.state, data));
  startProblemRound(ctx, index, {
    activity: 'snack',
    source: { kind: 'snack', dragon },
    skills,
    input: 'auto',
    // The dragons' facts can always be served again; the basket and the tastes run out (a round
    // asks 1+).
    target:
      skills.length > 0 ? target : Math.max(1, Math.min(target, distinctFacts(basket) + tastes)),
    meter: null,
  });
}
