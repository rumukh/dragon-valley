/**
 * Dragon growth and hunger as pure functions of state (src/rules/progression/dragons.ts).
 * Thresholds are read from content.balance.growth by hand: hatchling at 30 % of the mastery set
 * answered right once, youngling at 60 % bronze plus 60 % of the division facts.
 */
import { describe, expect, it } from 'vitest';
import { earnedStage, hungryDragons } from '../../../src/rules/progression/dragons';
import { initialProfileState, skillItemIndex } from '../../../src/rules/contract';
import type { ItemState, ProfileState } from '../../../src/rules/contract';
import { loadPack } from '../../traces/support';

const data = loadPack().data;
const index = skillItemIndex(data);
const bubbles = data.dragons.find((d) => d.id === 'bubbles')!;
const DAY = 20_000;

function state(items: Record<string, ItemState>, stage: 'egg' | 'hatchling' = 'hatchling') {
  const s: ProfileState = { ...initialProfileState({ dailyGoal: 30, arena: true }), day: DAY };
  s.items = items;
  s.dragons = {
    bubbles: {
      stage,
      obtainedDay: DAY - 3,
      stageDay: DAY - 3,
      outfit: { head: null, neck: null, eyes: null, wings: null, nest: null },
    },
  };
  return s;
}

const seen = (box = 1, due = DAY + 1, lastDay = DAY - 1): ItemState => ({
  box,
  due,
  seen: 1,
  correct: 1,
  recent: ['ok'],
  lastDay,
});

const twos = index.get('mul-2')!;
const halves = index.get('div-2')!;

describe('dragon growth', () => {
  it('hatches at 30 % of the mastery set answered right once (7 of the 21 ×2 facts)', () => {
    const six = Object.fromEntries(twos.slice(0, 6).map((id) => [id, seen()]));
    const seven = Object.fromEntries(twos.slice(0, 7).map((id) => [id, seen()]));
    expect(earnedStage(state(six, 'egg'), data, bubbles, index)).toBe('egg');
    expect(earnedStage(state(seven, 'egg'), data, bubbles, index)).toBe('hatchling');
  });

  it('needs the division facts too before it becomes a youngling', () => {
    const bronze = Object.fromEntries(twos.slice(0, 13).map((id) => [id, seen(2)]));
    expect(earnedStage(state(bronze), data, bubbles, index)).toBe('hatchling');
    const withDivision = {
      ...bronze,
      ...Object.fromEntries(halves.slice(0, 7).map((id) => [id, seen(2)])),
    };
    expect(earnedStage(state(withDivision), data, bubbles, index)).toBe('youngling');
  });
});

describe('hunger', () => {
  it('a hatched dragon with a due division fact is hungry', () => {
    const s = state({ [halves[3]!]: seen(2, DAY - 1) });
    expect(hungryDragons(s, data, index)).toEqual(['bubbles']);
  });

  it('a fact practised today is not due, and an egg is never hungry', () => {
    expect(hungryDragons(state({ [twos[3]!]: seen(1, DAY, DAY) }), data, index)).toEqual([]);
    expect(hungryDragons(state({ [twos[3]!]: seen(2, DAY - 1) }, 'egg'), data, index)).toEqual([]);
  });
});
