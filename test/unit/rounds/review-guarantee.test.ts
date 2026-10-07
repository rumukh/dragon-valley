/**
 * The review guarantee (docs/design.md §6.3): a known fact (box 2+) that has waited
 * `STARVING_DAYS` past its review day is starving, and wherever reviews are served it comes
 * first, whatever the child's success: before the likeliest success while success is protected,
 * and before facts still being learned that waited longer. States are built by hand; the
 * expectations are worked out here.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import {
  KNOWN_BOX,
  STARVING_DAYS,
  pickMixed,
  pickReview,
  pickSnack,
  starving,
} from '../../../src/rules/learning/selection';
import { initialProfileState } from '../../../src/rules/contract';
import type { ItemState, ProfileState } from '../../../src/rules/contract';
import { loadPack } from '../../traces/support';

const data = loadPack().data;
const DAY = 20_000;

const record = (box: number, overdue: number, recent: ItemState['recent'] = ['ok']): ItemState => ({
  box,
  due: DAY - overdue,
  seen: recent.length,
  correct: recent.filter((b) => b !== 'miss').length || 1,
  recent,
  lastDay: DAY - overdue - 1,
});

const ITEMS: Record<string, ItemState> = {
  // Right last time and practised yesterday: the likeliest success.
  'mul:2x3': { ...record(2, 0), lastDay: DAY - 1 },
  // Silver, four days past its review: starving.
  'mul:6x7': record(3, 4),
  // Missed last time, nine days overdue: still being learned (box 1), so not starving.
  'mul:2x4': record(1, 9, ['ok', 'miss']),
};

function state(correct: number): ProfileState {
  return {
    ...initialProfileState({ dailyGoal: 30, arena: true }),
    day: DAY,
    items: structuredClone(ITEMS),
    history: [{ day: DAY, answers: 20, correct, fast: 0 }],
  };
}

describe('the review guarantee', () => {
  it('calls a known fact starving from four days past its review day', () => {
    expect([KNOWN_BOX, STARVING_DAYS]).toEqual([2, 4]);
    expect(starving(record(2, 4), DAY)).toBe(true);
    expect(starving(record(5, 20), DAY)).toBe(true);
    expect(starving(record(2, 3), DAY), 'three days').toBe(false);
    expect(starving(record(1, 9), DAY), 'box 1: being learned').toBe(false);
    expect(starving({ ...record(3, 4), lastDay: DAY }, DAY), 'practised today').toBe(false);
    expect(starving(undefined, DAY)).toBe(false);
  });

  it('reviews a starving fact first, whether or not success is protected', () => {
    const due = Object.keys(ITEMS);
    const random = createPrng('review');
    expect(pickReview(state(8), due, random, true), 'before the likeliest success').toBe('mul:6x7');
    expect(pickReview(state(18), due, random, false), 'before an older box-1 fact').toBe('mul:6x7');
    const rest = due.filter((item) => item !== 'mul:6x7');
    expect(pickReview(state(8), rest, random, true), 'then likely first').toBe('mul:2x3');
    expect(pickReview(state(18), rest, random, false), 'or most overdue').toBe('mul:2x4');
  });

  it('reviews the most overdue starving fact first', () => {
    const s = state(8);
    s.items['mul:6x8'] = record(2, 6);
    for (let i = 0; i < 5; i++) {
      expect(pickReview(s, Object.keys(s.items), createPrng(`${i}`), true)).toBe('mul:6x8');
    }
  });

  it('feeds a starving fact first at snack time', () => {
    const pool = Object.keys(ITEMS);
    for (const likelyFirst of [true, false]) {
      const random = createPrng(`snack:${likelyFirst}`);
      expect(pickSnack({ state: state(8), pool, blocked: [], random, likelyFirst })).toBe(
        'mul:6x7',
      );
    }
  });

  it('serves a starving fact on the mix review draws, never the likelier success', () => {
    const pool = Object.keys(ITEMS);
    const picks = (correct: number) =>
      new Set(
        Array.from({ length: 40 }, (_, i) =>
          pickMixed({
            state: state(correct),
            data,
            pool,
            blocked: [],
            focus: null,
            random: createPrng(`${i}`),
          }),
        ),
      );
    // Inside the band all three are due reviews, so the starving fact is always first.
    expect(picks(18), '90 %').toEqual(new Set(['mul:6x7']));
    // Protected, the missed fact is a learning item: learning draws take it, reviews the starving one.
    expect(picks(8), '40 %').toEqual(new Set(['mul:6x7', 'mul:2x4']));
  });
});
