/**
 * Commuted facts share partial credit (docs/design.md §6.1): a right answer to one order is a
 * review of the other for scheduling only. Days and boxes are the test's own numbers; intervals
 * come from the balance (box 3: four days).
 */
import { describe, expect, it } from 'vitest';
import { creditItem } from '../../../src/rules/learning/credit';
import { isDue } from '../../../src/rules/learning/items';
import { initialProfileState } from '../../../src/rules/contract';
import type { ItemState, ProfileState } from '../../../src/rules/contract';
import type { Ctx } from '../../../src/rules/types';
import { loadPack } from '../../traces/support';

const balance = loadPack().data.balance;
const DAY = 10;

function context(items: Record<string, ItemState>): { ctx: Ctx; state: ProfileState } {
  const state = initialProfileState({ dailyGoal: 30, arena: true });
  state.day = DAY;
  state.items = structuredClone(items);
  const ctx = { state, content: { data: { balance } }, emit: () => {} } as unknown as Ctx;
  return { ctx, state };
}

const known: ItemState = {
  box: 3,
  due: 9,
  seen: 4,
  correct: 4,
  recent: ['ok', 'ok', 'fast'],
  lastDay: 7,
};

describe('commuted facts', () => {
  it('a right answer to 7 · 8 reschedules a known 8 · 7 without promoting it', () => {
    const { ctx, state } = context({ 'mul:8x7': known });
    expect(isDue(state.items['mul:8x7'], DAY), 'due before').toBe(true);
    creditItem(ctx, 'mul:7x8', 'fast');
    expect(state.items['mul:8x7']).toEqual({ ...known, due: DAY + 4, lastDay: DAY });
    expect(isDue(state.items['mul:8x7'], DAY), 'not due after').toBe(false);
    expect(state.items['mul:7x8']).toMatchObject({ box: 1, seen: 1, correct: 1 });
  });

  it('never pulls a later review earlier, and a slow answer still counts', () => {
    const later = { ...known, due: DAY + 5 };
    const { ctx, state } = context({ 'mul:8x7': later });
    creditItem(ctx, 'mul:7x8', 'slow');
    expect(state.items['mul:8x7']).toEqual({ ...later, lastDay: DAY });
  });

  it('leaves the twin alone after a miss, when it was never answered right, or for squares', () => {
    const miss = context({ 'mul:8x7': known });
    creditItem(miss.ctx, 'mul:7x8', 'miss');
    expect(miss.state.items['mul:8x7']).toEqual(known);

    const unknown = { ...known, box: 1, correct: 0 };
    const fresh = context({ 'mul:8x7': unknown });
    creditItem(fresh.ctx, 'mul:7x8', 'ok');
    expect(fresh.state.items['mul:8x7']).toEqual(unknown);
    creditItem(fresh.ctx, 'mul:3x4', 'ok');
    expect(fresh.state.items['mul:4x3'], 'no record is created').toBeUndefined();

    const square = context({ 'mul:6x6': known });
    creditItem(square.ctx, 'mul:6x6', 'ok');
    expect(square.state.items['mul:6x6']).toMatchObject({ box: 4, seen: 5, correct: 5 });
  });
});
