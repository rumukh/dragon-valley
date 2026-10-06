/**
 * Coins, eggs, cosmetics, stickers and the daily gift.
 *
 * Cosmetic ownership uses `@aegis/narrative` idempotent grants: every grant has a stable claim
 * identity (`buy:<item>`, `level:<level>:<item>`, `gift:<day>`, `story:<reward>`), so replaying a
 * grant never duplicates an item or its coins. Outfits are per dragon in `DragonState.outfit`.
 */
import { grantCosmetic } from '@aegis/narrative';
import type { CosmeticItem } from '@aegis/narrative';
import { COSMETIC_SLOTS, DRAGON_STAGES, EVENTS, weekday } from '../contract';
import type { CoinReason, Grant, StickerCriteria } from '../contract';
import { atLeast } from '../learning/items';
import { isComplete } from '../progression/levels';
import type { Ctx, Data, ReadState } from '../types';
import type { DeepReadonly } from '@aegis/runtime';

export function earnCoins(ctx: Ctx, amount: number, reason: CoinReason): void {
  if (amount <= 0) return;
  ctx.state.coins += amount;
  ctx.state.coinsEarned += amount;
  ctx.emit(EVENTS.coinsEarned, { amount, reason });
}

export function grantEgg(ctx: Ctx, dragon: string): void {
  if (ctx.state.dragons[dragon]) return;
  const day = ctx.state.day ?? 0;
  ctx.state.dragons[dragon] = {
    stage: 'egg',
    obtainedDay: day,
    stageDay: day,
    outfit: { head: null, neck: null, eyes: null, wings: null, nest: null },
  };
  ctx.emit(EVENTS.eggReceived, { dragon });
}

export function cosmeticCatalog(data: Data): CosmeticItem[] {
  return data.cosmetics.map((c) => ({ id: c.id, slot: c.slot, assetId: c.assetId }));
}

/** Grant a cosmetic once per claim identity. Returns false if the claim was already used. */
export function grantItem(ctx: Ctx, item: string, claim: string): boolean {
  if (ctx.state.cosmetics.claims.some((c) => c.id === claim)) return false;
  ctx.state.cosmetics = grantCosmetic(
    cosmeticCatalog(ctx.content.data),
    ctx.state.cosmetics,
    claim,
    item,
  );
  return true;
}

export function applyGrant(
  ctx: Ctx,
  grant: DeepReadonly<Grant>,
  claim: string,
  reason: CoinReason,
): void {
  if (grant.kind === 'egg') grantEgg(ctx, grant.dragon);
  else if (grant.kind === 'coins') earnCoins(ctx, grant.amount, reason);
  else grantItem(ctx, grant.item, claim);
}

function criterionMet(
  state: ReadState,
  data: Data,
  criteria: DeepReadonly<StickerCriteria>,
): boolean {
  switch (criteria.kind) {
    case 'level-complete':
      return (
        isComplete(state, criteria.level) &&
        (state.levels[criteria.level]?.stars ?? 0) >= criteria.stars
      );
    case 'boss-defeated':
      return state.bosses[criteria.boss] !== undefined;
    case 'dragon-stage': {
      const wanted = DRAGON_STAGES.indexOf(criteria.stage);
      return Object.entries(state.dragons).some(
        ([id, dragon]) =>
          (criteria.dragon === null || criteria.dragon === id) &&
          DRAGON_STAGES.indexOf(dragon.stage) >= wanted,
      );
    }
    case 'facts-mastered':
      return (
        Object.entries(state.items).filter(
          ([id, item]) =>
            id.startsWith(`${criteria.family}:`) && atLeast(item, criteria.level, data.balance),
        ).length >= criteria.count
      );
    case 'streak':
      return state.bestStreak >= criteria.count;
    case 'days-practiced':
      return state.daysPracticed >= criteria.count;
    case 'week-days': {
      const today = state.day ?? 0;
      const monday = today - weekday(today);
      return (
        state.history.filter((d) => d.day >= monday && d.day <= today).length >= criteria.count
      );
    }
    case 'coins-earned':
      return state.coinsEarned >= criteria.count;
    case 'cosmetics-owned':
      return state.cosmetics.owned.length >= criteria.count;
    case 'dragons-dressed':
      return (
        Object.values(state.dragons).filter((dragon) =>
          Object.values(dragon.outfit).some((item) => item !== null),
        ).length >= criteria.count
      );
    case 'arena-best':
      return state.arena.best >= criteria.count;
    case 'quests-claimed':
      return state.questsClaimed >= criteria.count;
    case 'placement-done':
      return state.onboarding.placement === 'done';
    case 'finale':
      return state.finale.day !== null;
  }
}

/** Award every sticker whose criteria are now met. */
export function awardStickers(ctx: Ctx): void {
  const day = ctx.state.day ?? 0;
  for (const sticker of ctx.content.data.stickers) {
    if (ctx.state.stickers[sticker.id]) continue;
    if (criterionMet(ctx.state, ctx.content.data, sticker.criteria)) {
      ctx.state.stickers[sticker.id] = { day };
      ctx.emit(EVENTS.stickerEarned, { sticker: sticker.id });
    }
  }
}

/** Cosmetics the market shows: unlocked by progress. */
export function availableCosmetics(state: ReadState, data: Data): string[] {
  return data.cosmetics
    .filter((c) => c.unlock === null || isComplete(state, c.unlock))
    .map((c) => c.id);
}

/**
 * Open the daily gift: a weighted draw from the `rewards` stream between an available cosmetic
 * the child does not own yet and coins. Always rewards something.
 */
export function openGift(ctx: Ctx): void {
  const data = ctx.content.data;
  const random = ctx.random('rewards');
  const unowned = availableCosmetics(ctx.state, data).filter(
    (id) => !ctx.state.cosmetics.owned.includes(id),
  );
  const { cosmeticWeight, coinsWeight, coinsMin, coinsMax } = data.balance.gift;
  const total = (unowned.length > 0 ? cosmeticWeight : 0) + coinsWeight;
  const roll = total > 0 ? random.int(0, total) : 0;
  const day = ctx.state.day ?? 0;
  let grant: Grant;
  if (unowned.length > 0 && roll < cosmeticWeight) {
    const item = random.pick(unowned);
    grantItem(ctx, item, `gift:${day}`);
    grant = { kind: 'cosmetic', item };
  } else {
    grant = { kind: 'coins', amount: Math.max(1, random.int(coinsMin, coinsMax + 1)) };
    earnCoins(ctx, grant.amount, 'gift');
  }
  if (ctx.state.daily) ctx.state.daily.gift = 'opened';
  ctx.emit(EVENTS.giftOpened, { grant });
}

export const EMPTY_OUTFIT = Object.freeze(
  Object.fromEntries(COSMETIC_SLOTS.map((slot) => [slot, null])),
);
