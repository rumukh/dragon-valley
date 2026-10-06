/**
 * Crediting an item: one retrieval of a fact or bucket, from a graded answer or a minigame move.
 * Moves the Leitner box, and reports promotions and newly lit Magic Window panes as events.
 */
import { EVENTS, parseItemId } from '../contract';
import type { ResponseBucket } from '../contract';
import { masteryLevel, updateItem } from './items';
import type { Ctx } from '../types';

const RANK = ['dim', 'bronze', 'silver', 'gold'] as const;

function isWindowItem(item: string): boolean {
  const kind = parseItemId(item)?.kind;
  return kind === 'mul' || kind === 'div';
}

/** Record one response to `item` on the current day. */
export function creditItem(ctx: Ctx, item: string, bucket: ResponseBucket): void {
  const balance = ctx.content.data.balance;
  const before = ctx.state.items[item];
  const after = updateItem(before, bucket, ctx.state.day ?? 0, balance);
  ctx.state.items[item] = after;
  if (bucket !== 'miss' && after.box > (before?.box ?? 0)) {
    ctx.emit(EVENTS.itemPromoted, { item, box: after.box });
  }
  if (!isWindowItem(item)) return;
  const from = RANK.indexOf(masteryLevel(before, balance));
  const to = RANK.indexOf(masteryLevel(after, balance));
  if (to > from) ctx.emit(EVENTS.paneLit, { item, level: RANK[to]! });
}
