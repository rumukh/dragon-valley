/**
 * Dragon growth and hunger as pure functions of state (src/rules/progression/dragons.ts).
 * Thresholds are read from content.balance.growth by hand: hatchling at 30 % of the mastery set
 * answered right once, youngling at 60 % bronze plus 60 % of the division facts. From bronze up a
 * dragon not of the 0 or 1 table does not count rule facts (n · 0, n · 1, 0 : n, n : 1).
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { earnedStage, growthItems, hungryDragons } from '../../../src/rules/progression/dragons';
import { isRuleFact, pickSnack } from '../../../src/rules/learning/selection';
import { projectView } from '../../../src/rules/view';
import { initialProfileState, skillItemIndex } from '../../../src/rules/contract';
import type { ItemState, ProfileState } from '../../../src/rules/contract';
import type { Read } from '../../../src/rules/types';
import { loadPack } from '../../traces/support';

const data = loadPack().data;
const index = skillItemIndex(data);
const bubbles = data.dragons.find((d) => d.id === 'bubbles')!;
const mirror = data.dragons.find((d) => d.id === 'mirror')!;
const DAY = 20_000;

function state(
  items: Record<string, ItemState>,
  stage: 'egg' | 'hatchling' = 'hatchling',
  dragon = 'bubbles',
) {
  const s: ProfileState = { ...initialProfileState({ dailyGoal: 30, arena: true }), day: DAY };
  s.items = items;
  s.dragons = {
    [dragon]: {
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
const bronze = (ids: readonly string[]) => Object.fromEntries(ids.map((id) => [id, seen(2)]));

describe('dragon growth', () => {
  it('hatches at 30 % of the mastery set answered right once (7 of the 21 ×2 facts)', () => {
    const six = Object.fromEntries(twos.slice(0, 6).map((id) => [id, seen()]));
    const seven = Object.fromEntries(twos.slice(0, 7).map((id) => [id, seen()]));
    expect(earnedStage(state(six, 'egg'), data, bubbles, index)).toBe('egg');
    expect(earnedStage(state(seven, 'egg'), data, bubbles, index)).toBe('hatchling');
  });

  it('counts the rule facts toward hatching: 2 · 0, 2 · 1, 0 · 2 and 1 · 2 make four of seven', () => {
    const rules = twos.filter(isRuleFact);
    expect(rules).toEqual(['mul:0x2', 'mul:1x2', 'mul:2x0', 'mul:2x1']);
    const seven = [...rules, ...twos.filter((id) => !isRuleFact(id)).slice(0, 3)];
    const hatch = Object.fromEntries(seven.map((id) => [id, seen()]));
    expect(earnedStage(state(hatch, 'egg'), data, bubbles, index)).toBe('hatchling');
  });

  it('grows from bronze up on its 17 ×2 and 10 ÷2 facts that are not rule facts', () => {
    expect(growthItems(bubbles, bubbles.skills, index, 'seen')).toHaveLength(21);
    expect(growthItems(bubbles, bubbles.skills, index, 'bronze')).toHaveLength(17);
    expect(growthItems(bubbles, bubbles.divisionSkills, index, 'silver')).toHaveLength(10);
    const plain = twos.filter((id) => !isRuleFact(id));
    const division = bronze(halves.filter((id) => !isRuleFact(id)).slice(0, 6));
    // 60 % of 17 is 11 facts: 10 and every rule fact are not enough.
    const ten = { ...bronze(twos.filter(isRuleFact)), ...bronze(plain.slice(0, 10)), ...division };
    expect(earnedStage(state(ten), data, bubbles, index)).toBe('hatchling');
    const eleven = { ...bronze(plain.slice(0, 11)), ...division };
    expect(earnedStage(state(eleven), data, bubbles, index)).toBe('youngling');
  });

  it('needs the division facts too before it becomes a youngling', () => {
    const facts = bronze(twos.filter((id) => !isRuleFact(id)).slice(0, 11));
    expect(earnedStage(state(facts), data, bubbles, index)).toBe('hatchling');
    // 60 % of the 10 halves that are not 0 : 2.
    const five = { ...facts, ...bronze(halves.filter((id) => !isRuleFact(id)).slice(0, 5)) };
    expect(earnedStage(state(five), data, bubbles, index)).toBe('hatchling');
    const six = { ...facts, ...bronze(halves.filter((id) => !isRuleFact(id)).slice(0, 6)) };
    expect(earnedStage(state(six), data, bubbles, index)).toBe('youngling');
  });

  it('counts every fact for Mirror, whose facts are all rule facts', () => {
    const ones = index.get('mul-1')!;
    expect(ones.every(isRuleFact)).toBe(true);
    expect(growthItems(mirror, mirror.skills, index, 'bronze')).toEqual([...ones].sort());
    // 60 % of the 21 ×1 facts and of the 11 ÷1 facts.
    const facts = { ...bronze(ones.slice(0, 13)), ...bronze(index.get('div-1')!.slice(0, 7)) };
    expect(earnedStage(state(facts, 'hatchling', 'mirror'), data, mirror, index)).toBe('youngling');
    const fewer = { ...bronze(ones.slice(0, 12)), ...bronze(index.get('div-1')!.slice(0, 7)) };
    expect(earnedStage(state(fewer, 'hatchling', 'mirror'), data, mirror, index)).toBe('hatchling');
  });
});

describe('the dragon view', () => {
  it('shows growth from bronze up without the rule facts, as growth counts it', () => {
    const plain = twos.filter((id) => !isRuleFact(id));
    const s = state({ ...bronze(twos.filter(isRuleFact)), ...bronze(plain.slice(0, 5)) });
    const read = { state: s, content: { data }, revision: 0, turn: 0 } as unknown as Read;
    const view = projectView(read, index).dragons.find((d) => d.id === 'bubbles')!;
    // 5 of the 17 facts growth counts at bronze; 60 % of 17 rounds up to 11.
    expect(view.next).toEqual({
      stage: 'youngling',
      share: 60,
      mastery: 'bronze',
      have: 5,
      need: 11,
    });
    // Seen: 9 of all 21 facts (42 %); bronze: 5 of 17 (29 %).
    expect(view.mastery).toMatchObject({ seen: 42, bronze: 29, silver: 0, items: 21 });
  });
});

describe("Puff's and Mirror's facts", () => {
  it('come to snack time after the due facts: rule facts never answered right first', () => {
    // Other rounds serve at most one rule fact, so snack time is where Puff meets its facts.
    const s = state(
      { 'mul:0x3': seen(5, DAY + 5), 'mul:0x4': seen(2, DAY - 1) },
      'hatchling',
      'puff',
    );
    const pool = index.get('mul-0')!;
    const random = createPrng('puff');
    expect(pickSnack({ state: s, pool, blocked: [], random }), 'the due fact').toBe('mul:0x4');
    const served = ['mul:0x4'];
    for (let i = 0; i < 5; i++) {
      const next = pickSnack({ state: s, pool, blocked: served, served, random })!;
      expect(s.items[next], `a new fact, not the known 0 · 3 (${next})`).toBeUndefined();
    }
    // With one new fact left, it comes before the known 0 · 3 every time.
    const three = ['mul:0x3', 'mul:0x4', 'mul:0x5'];
    for (let i = 0; i < 10; i++) {
      const next = pickSnack({
        state: s,
        pool: three,
        blocked: served,
        served,
        random: createPrng(`${i}`),
      });
      expect(next).toBe('mul:0x5');
    }
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
