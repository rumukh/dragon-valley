/**
 * Item selection (src/rules/learning/selection.ts): tiers, the learning share, the focus egg and
 * each activity's draw. States are built by hand; expectations come from docs/design.md §6.3.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import {
  eggsByAge,
  focusItems,
  itemTier,
  learningShare,
  pickLearning,
  pickMixed,
  pickSnack,
  withoutRecent,
} from '../../../src/rules/learning/selection';
import { initialProfileState, skillItemIndex } from '../../../src/rules/contract';
import type { DragonState, ItemState, ProfileState } from '../../../src/rules/contract';
import { loadPack } from '../../traces/support';

const data = loadPack().data;
const index = skillItemIndex(data);
const DAY = 20_000;

function item(box: number, due: number, lastDay = DAY - 1, correct = 1): ItemState {
  return { box, due, seen: correct + 1, correct, recent: ['ok'], lastDay };
}

function egg(obtainedDay: number, stage: DragonState['stage'] = 'egg'): DragonState {
  return {
    stage,
    obtainedDay,
    stageDay: obtainedDay,
    outfit: { head: null, neck: null, eyes: null, wings: null, nest: null },
  };
}

function state(patch: Partial<ProfileState> = {}): ProfileState {
  return { ...initialProfileState({ dailyGoal: 30, arena: true }), day: DAY, ...patch };
}

function daily(answers: number, correct: number): ProfileState['daily'] {
  return { day: DAY, answers, correct, fast: 0, goal: 30, quests: [], gift: 'locked' };
}

describe('item tiers', () => {
  it('sorts items into due, known and learning on the current day', () => {
    const s = state({
      items: {
        'mul:2x3': item(3, DAY - 1),
        'mul:2x4': item(3, DAY + 2),
        'mul:2x5': item(1, DAY + 0, DAY - 1),
        'mul:2x6': item(1, DAY + 0, DAY),
        'mul:2x7': item(0, DAY, DAY - 1, 0),
      },
    });
    expect(itemTier(s, 'mul:2x3', DAY)).toBe('due');
    expect(itemTier(s, 'mul:2x4', DAY)).toBe('known');
    expect(itemTier(s, 'mul:2x5', DAY), 'seen yesterday, due today').toBe('due');
    expect(itemTier(s, 'mul:2x6', DAY), 'practised today: not due again today').toBe('learning');
    expect(itemTier(s, 'mul:2x7', DAY), 'never right yet').toBe('learning');
    expect(itemTier(s, 'mul:2x8', DAY), 'new').toBe('learning');
  });
});

describe('the learning share', () => {
  const { knownShare, minLearningShare, maxLearningShare } = data.balance.mix;

  it('starts at 100 - knownShare before five answers today', () => {
    expect(learningShare(state(), data)).toBe(100 - knownShare);
    expect(learningShare(state({ daily: daily(4, 0) }), data)).toBe(100 - knownShare);
  });

  it('grows when the child succeeds more than the target and shrinks when less, within bounds', () => {
    const full = learningShare(state({ daily: daily(40, 40) }), data);
    const poor = learningShare(state({ daily: daily(40, 20) }), data);
    expect(full).toBe(Math.min(maxLearningShare, 30 + (100 - 82)));
    expect(poor).toBe(minLearningShare);
    expect(learningShare(state({ daily: daily(40, 33) }), data), '82 % is on target').toBe(30);
  });

  it('applies only part of the shift until a full window of answers', () => {
    // 10 of 20 window answers, all right: shift (100 - 82) * 10 / 20 = 9.
    expect(learningShare(state({ daily: daily(10, 10) }), data)).toBe(39);
  });
});

describe('the focus egg', () => {
  it('is the oldest owned egg with facts in the round that were never answered right', () => {
    const s = state({
      dragons: { sunny: egg(DAY - 5), goldie: egg(DAY - 2), bubbles: egg(DAY - 9, 'hatchling') },
    });
    expect(eggsByAge(s, data).map((d) => d.id)).toEqual(['sunny', 'goldie']);
    const pool = index.get('mul-2-5')!;
    const focus = focusItems(s, data, index, pool)!;
    expect(focus.every((id) => /^mul:(5x\d+|\d+x5)$/.test(id))).toBe(true);
    expect(focus).toHaveLength(21);
    expect(
      focusItems(s, data, index, index.get('div-2-5-10')!),
      'eggs warm with their multiplication facts',
    ).toBeNull();
  });

  it('moves on to the next egg once every fact of the first was answered right', () => {
    const fives = index.get('mul-5')!;
    const s = state({
      dragons: { sunny: egg(DAY - 5), goldie: egg(DAY - 2) },
      items: Object.fromEntries(fives.map((id) => [id, item(1, DAY, DAY)])),
    });
    expect(focusItems(s, data, index, index.get('mul-2-5')!)).toEqual(['mul:10x2', 'mul:2x10']);
  });

  it('is served first by a learning draw', () => {
    const s = state();
    const random = createPrng('focus');
    for (let i = 0; i < 20; i++) {
      expect(
        pickLearning(s, ['mul:2x1', 'mul:5x1', 'mul:5x2'], ['mul:5x1', 'mul:5x2'], random),
      ).toMatch(/^mul:5x/);
    }
  });
});

describe('mixed draws', () => {
  it('serve the most overdue review when the draw is not a learning one', () => {
    const s = state({
      daily: daily(40, 20),
      items: {
        'mul:2x3': item(3, DAY - 3),
        'mul:2x4': item(3, DAY - 1),
        'mul:2x5': item(4, DAY + 3),
      },
    });
    // The share is at its minimum (poor day): most draws are reviews, oldest due first.
    const picks = new Set<string>();
    const random = createPrng('mixed');
    for (let i = 0; i < 30; i++) {
      picks.add(
        pickMixed({
          state: s,
          data,
          pool: ['mul:2x3', 'mul:2x4', 'mul:2x5', 'mul:2x6'],
          blocked: [],
          focus: null,
          random,
        }),
      );
    }
    expect(picks.has('mul:2x3')).toBe(true);
    expect(picks.has('mul:2x4'), 'a less overdue item waits while an older one is due').toBe(false);
  });

  it('never serve a recent item while another is available', () => {
    expect(withoutRecent(['a', 'b', 'c'], ['a', 'b'])).toEqual(['c']);
    expect(withoutRecent(['a', 'b'], ['a', 'b'])).toEqual(['a', 'b']);
    const random = createPrng('recent');
    for (let i = 0; i < 20; i++) {
      expect(
        pickMixed({
          state: state(),
          data,
          pool: ['mul:2x3', 'mul:2x4'],
          blocked: ['mul:2x3'],
          focus: null,
          random,
        }),
      ).toBe('mul:2x4');
    }
  });
});

describe('snack draws', () => {
  it('serve due facts first, then the weakest known ones', () => {
    const s = state({
      items: {
        'mul:2x3': item(4, DAY + 5),
        'mul:2x4': item(2, DAY + 1),
        'mul:2x5': item(3, DAY - 2),
      },
    });
    const random = createPrng('snack');
    const pool = ['mul:2x3', 'mul:2x4', 'mul:2x5', 'mul:2x6'];
    expect(pickSnack({ state: s, pool, blocked: [], random })).toBe('mul:2x5');
    expect(pickSnack({ state: s, pool, blocked: ['mul:2x5'], random })).toBe('mul:2x4');
  });
});
