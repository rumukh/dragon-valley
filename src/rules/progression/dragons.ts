/**
 * Dragons: mastery sets, growth and hunger.
 *
 * A dragon's mastery set is the union of its skills' items. It grows through the stages of
 * `balance.growth` (hatchling, youngling, adult, crowned) when the share of its set at the rule's
 * mastery level reaches the rule's share, plus division and boss requirements. Stages never go
 * down. A dragon is hungry when at least `balance.hungry.minDue` of its known items are due:
 * feeding hungry dragons is the spaced review.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { DRAGON_STAGES, EVENTS } from '../contract';
import type { Dragon, DragonStage, GrowthRule } from '../contract';
import { atLeast, isDue } from '../learning/items';
import { percentOf } from './levels';
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

function ruleMet(
  state: ReadState,
  data: Data,
  dragon: DeepReadonly<Dragon>,
  rule: DeepReadonly<GrowthRule>,
  index: ReadonlyMap<string, readonly string[]>,
): boolean {
  if (shareAt(state, data, itemsOf(dragon.skills, index), rule.mastery) < rule.share) return false;
  if (
    rule.division &&
    shareAt(state, data, itemsOf(dragon.divisionSkills, index), rule.mastery) < rule.share
  ) {
    return false;
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

/** Owned, hatched dragons with enough due items. */
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
        dueItems(state, itemsOf(dragon.skills, index)) >= data.balance.hungry.minDue
      );
    })
    .map((dragon) => dragon.id);
}
