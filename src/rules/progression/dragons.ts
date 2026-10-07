/**
 * Dragons: mastery sets, growth and hunger.
 *
 * A dragon's mastery set is the union of its skills' items. It grows through the stages of
 * `balance.growth` (hatchling, youngling, adult, crowned) when the share of its set at the rule's
 * mastery level reaches the rule's share, plus division and boss requirements. From bronze up,
 * growth counts rule facts (n · 0, n · 1, 0 : n, n : 1) only for the dragons of the 0 and 1
 * tables (`growthItems`). Stages never go down. A dragon is hungry when at least
 * `balance.hungry.minDue` of its known items are due: feeding hungry dragons is the spaced review.
 * Due facts no hatched dragon eats wait in the valley's basket (`basketItems`), which snack time
 * serves too.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { DRAGON_STAGES, EVENTS } from '../contract';
import type { Dragon, DragonStage, GrowthRule } from '../contract';
import { canGenerate } from '../learning/generate';
import { atLeast, isDue } from '../learning/items';
import { growsWith, starving } from '../learning/selection';
import { isComplete, percentOf } from './levels';
import type { Ctx, Data, ReadState } from '../types';

export function itemsOf(
  skills: readonly string[],
  index: ReadonlyMap<string, readonly string[]>,
): string[] {
  return [...new Set(skills.flatMap((skill) => index.get(skill) ?? []))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
}

export function shareAt(
  state: ReadState,
  data: Data,
  items: readonly string[],
  level: GrowthRule['mastery'],
): number {
  if (items.length === 0) return 100;
  const count = items.filter((item) => atLeast(state.items[item], level, data.balance)).length;
  return percentOf(count, items.length);
}

/**
 * The items of `skills` that growth at `mastery` counts. Rule facts (n · 0, n · 1, 0 : n, n : 1)
 * count toward hatching (answered right once) for every dragon, but toward bronze and better only
 * for the dragons of the 0 and 1 tables (`growsWith`): a round serves at most one of them, so they
 * are reviewed too rarely to let any other dragon grow up.
 */
export function growthItems(
  dragon: DeepReadonly<Dragon>,
  skills: readonly string[],
  index: ReadonlyMap<string, readonly string[]>,
  mastery: GrowthRule['mastery'],
): string[] {
  const items = itemsOf(skills, index);
  return mastery === 'seen' ? items : items.filter((item) => growsWith(dragon, item));
}

function ruleMet(
  state: ReadState,
  data: Data,
  dragon: DeepReadonly<Dragon>,
  rule: DeepReadonly<GrowthRule>,
  index: ReadonlyMap<string, readonly string[]>,
): boolean {
  const items = growthItems(dragon, dragon.skills, index, rule.mastery);
  if (shareAt(state, data, items, rule.mastery) < rule.share) return false;
  if (rule.division) {
    const division = growthItems(dragon, dragon.divisionSkills, index, rule.mastery);
    if (shareAt(state, data, division, rule.mastery) < rule.share) return false;
  }
  return !rule.boss || dragon.boss === null || state.bosses[dragon.boss] !== undefined;
}

/** The highest stage whose rule and all earlier rules are met. */
export function earnedStage(
  state: ReadState,
  data: Data,
  dragon: DeepReadonly<Dragon>,
  index: ReadonlyMap<string, readonly string[]>,
): DragonStage {
  let stage: DragonStage = 'egg';
  for (const rule of data.balance.growth) {
    if (!ruleMet(state, data, dragon, rule, index)) break;
    stage = rule.stage;
  }
  return stage;
}

/** Grow every owned dragon whose earned stage is above its current one (never shrink). */
export function applyGrowth(ctx: Ctx, index: ReadonlyMap<string, readonly string[]>): void {
  const day = ctx.state.day ?? 0;
  for (const dragon of ctx.content.data.dragons) {
    const owned = ctx.state.dragons[dragon.id];
    if (!owned) continue;
    const earned = earnedStage(ctx.state, ctx.content.data, dragon, index);
    const from = DRAGON_STAGES.indexOf(owned.stage);
    const to = DRAGON_STAGES.indexOf(earned);
    if (to <= from) continue;
    owned.stage = earned;
    owned.stageDay = day;
    if (from === 0) ctx.emit(EVENTS.dragonHatched, { dragon: dragon.id });
    if (to > 1) ctx.emit(EVENTS.dragonGrew, { dragon: dragon.id, stage: earned });
    if (earned === 'crowned') ctx.emit(EVENTS.dragonCrowned, { dragon: dragon.id });
  }
}

export function dueItems(state: ReadState, items: readonly string[]): number {
  const day = state.day ?? 0;
  return items.filter((item) => isDue(state.items[item], day)).length;
}

/** Every fact a dragon eats: its mastery set and its division facts. */
export function dragonFacts(
  dragon: DeepReadonly<Dragon>,
  index: ReadonlyMap<string, readonly string[]>,
): string[] {
  return itemsOf([...dragon.skills, ...dragon.divisionSkills], index);
}

/** The items some playable skill can serve, per skill index (the index is cached per pack). */
const servableCache = new WeakMap<ReadonlyMap<string, readonly string[]>, ReadonlySet<string>>();

function servableItems(data: Data, index: ReadonlyMap<string, readonly string[]>) {
  let servable = servableCache.get(index);
  if (servable === undefined) {
    servable = new Set(
      data.skills
        .filter((skill) => canGenerate(skill))
        .flatMap((skill) => index.get(skill.id) ?? []),
    );
    servableCache.set(index, servable);
  }
  return servable;
}

/**
 * The valley's basket: due facts that no hatched dragon eats and that a skill can serve, sorted.
 * They are comparisons, terms and word problems before the Seven-Headed Dragon hatches, and the
 * facts of eggs not hatched yet. Snack time for every hungry dragon serves them too, so they are
 * reviewed like any other fact (docs/design.md §5.12).
 */
export function basketItems(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
): string[] {
  const day = state.day ?? 0;
  const eaten = new Set<string>();
  for (const dragon of data.dragons) {
    const owned = state.dragons[dragon.id];
    if (owned === undefined || owned.stage === 'egg') continue;
    for (const item of dragonFacts(dragon, index)) eaten.add(item);
  }
  const servable = servableItems(data, index);
  return Object.keys(state.items)
    .filter((item) => !eaten.has(item) && servable.has(item) && isDue(state.items[item], day))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Whether a known fact snack time can serve is starving (`starving`: `STARVING_DAYS` past its
 * review): the review guarantee then puts snack time before anything new (docs/design.md §6.3).
 */
export function anyStarving(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
): boolean {
  const day = state.day ?? 0;
  const servable = servableItems(data, index);
  return Object.keys(state.items).some(
    (item) => starving(state.items[item], day) && servable.has(item),
  );
}

/**
 * The facts the child was taught: the items of a finished level's skills (docs/design.md §5.12).
 * Snack time serves no fact the child has neither met nor been taught (no division before the
 * division levels).
 */
export function taughtItems(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  return new Set(
    data.levels
      .filter((level) => isComplete(state, level.id))
      .flatMap((level) => level.activities.flatMap((activity) => activity.skills))
      .flatMap((skill) => index.get(skill) ?? []),
  );
}

/**
 * First tastes (docs/design.md §5.12): the facts of the child's dragons that it was taught
 * (`taughtItems`) but never answered, in the order snack time introduces them. A level's round
 * draws new facts at random, so some can be missed and would never come up again: snack time
 * serves them. Eggs come first, the oldest first, all their facts (they warm them); then the
 * hatched dragons', the oldest first (in content order on the same day). A dragon's
 * multiplication facts come before its division facts. With `dragon`, only that dragon's. The
 * finale dragon's egg is left out, because the finale hatches it.
 */
export function firstTastes(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
  dragon: string | null,
  taught: ReadonlySet<string> = taughtItems(state, data, index),
): string[] {
  const owners = data.dragons
    .map((d, order) => ({ d, order, owned: state.dragons[d.id] }))
    .filter(
      ({ d, owned }) =>
        owned !== undefined &&
        (dragon === null || d.id === dragon) &&
        !(d.kind === 'finale' && owned.stage === 'egg'),
    )
    .sort(
      (a, b) =>
        Number(b.owned!.stage === 'egg') - Number(a.owned!.stage === 'egg') ||
        a.owned!.obtainedDay - b.owned!.obtainedDay ||
        a.order - b.order,
    );
  const tastes = owners
    .flatMap(({ d }) => [...itemsOf(d.skills, index), ...itemsOf(d.divisionSkills, index)])
    .filter((item) => state.items[item] === undefined && taught.has(item));
  return [...new Set(tastes)];
}
/** Owned, hatched dragons with enough due facts (multiplication or division). */
export function hungryDragons(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
): string[] {
  return data.dragons
    .filter((dragon) => {
      const owned = state.dragons[dragon.id];
      return (
        owned !== undefined &&
        owned.stage !== 'egg' &&
        dueItems(state, dragonFacts(dragon, index)) >= data.balance.hungry.minDue
      );
    })
    .map((dragon) => dragon.id);
}
