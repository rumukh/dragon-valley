/**
 * Crediting an item: one retrieval of a fact or bucket, from a graded answer or a minigame move.
 * Moves the Leitner box, and reports promotions and newly lit Magic Window panes as events.
 */
import { EVENTS, commutedId, parseItemId } from '../contract';
import type { Balance, ResponseBucket } from '../contract';
import type { DeepReadonly } from '@aegis/runtime';
import { masteryLevel, updateItem } from './items';
import type { Ctx } from '../types';

const RANK = ['dim', 'bronze', 'silver', 'gold'] as const;

function isWindowItem(item: string): boolean {
  const kind = parseItemId(item)?.kind;
  return kind === 'mul' || kind === 'div';
}

/**
 * Commuted facts share partial credit (docs/design.md §6.1): a right answer to `mul:7x8` counts
 * as a review of a known `mul:8x7` for scheduling only. The twin is not due again before its own
 * interval from today, and counts as practised today; its box, counts and mastery stay its own.
 */
function reviewTwin(ctx: Ctx, item: string, day: number, balance: DeepReadonly<Balance>): void {
  const twin = commutedId(item);
  const record = twin === null || twin === item ? undefined : ctx.state.items[twin];
  if (twin === null || record === undefined || record.correct === 0) return;
  ctx.state.items[twin] = {
    ...record,
    due: Math.max(record.due, day + (balance.leitner.intervals[record.box] ?? 0)),
    lastDay: Math.max(record.lastDay, day),
  };
}

/** Record one response to `item` on the current day. */
export function creditItem(ctx: Ctx, item: string, bucket: ResponseBucket): void {
  const balance = ctx.content.data.balance;
  const day = ctx.state.day ?? 0;
  const before = ctx.state.items[item];
  const after = updateItem(before, bucket, day, balance);
  ctx.state.items[item] = after;
  if (bucket !== 'miss') reviewTwin(ctx, item, day, balance);
  if (bucket !== 'miss' && after.box > (before?.box ?? 0)) {
    ctx.emit(EVENTS.itemPromoted, { item, box: after.box });
  }
  if (!isWindowItem(item)) return;
  const from = RANK.indexOf(masteryLevel(before, balance));
  const to = RANK.indexOf(masteryLevel(after, balance));
  if (to > from) ctx.emit(EVENTS.paneLit, { item, level: RANK[to]! });
}
