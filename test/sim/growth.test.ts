/**
 * Growth variants (growth.ts): other rules for youngling, adult and crowned, evaluated alongside
 * the shipped ones. The shipped rules as a variant must give exactly the rules' own stage, on
 * any state; each extension (a division share of its own, gates for particular dragons, the
 * effort path and its spacing) is checked on states built here; the stages a run records never
 * go down.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import type { DeepReadonly } from '@aegis/runtime';
import type { Dragon, ItemState, ProfileState } from '../../src/rules/contract';
import { itemIndex } from '../../src/rules/learning/index-cache';
import { earnedStage, growthItems } from '../../src/rules/progression/dragons';
import { loadPack } from '../traces/support';
import { GrowthProbes, variantStage } from './growth';
import type { GrowthGate, GrowthState, GrowthVariant } from './growth';

const data = loadPack().data;
const index = itemIndex(data);
const SHIPPED: GrowthVariant = { id: 'shipped', gates: data.balance.growth as GrowthGate[] };
const DAY = 20_000;

const dragon = (id: string): DeepReadonly<Dragon> => data.dragons.find((d) => d.id === id)!;
const record = (box: number, correct = 1, recent: ItemState['recent'] = ['ok']): ItemState => ({
  box,
  due: DAY,
  seen: correct,
  correct,
  recent,
  lastDay: DAY - 1,
});
const state = (
  items: Record<string, ItemState>,
  bosses: string[] = [],
  owned: string[] = [],
): GrowthState => ({
  items,
  bosses: Object.fromEntries(bosses.map((b) => [b, { defeatedDay: DAY }])),
  dragons: Object.fromEntries(owned.map((d) => [d, { stage: 'hatchling' as const }])),
});

/** Bubbles' facts the gates count (rule facts only count toward hatching). */
const bubbles = dragon('bubbles');
const seenFacts = growthItems(bubbles, bubbles.skills, index, 'seen');
const mul = growthItems(bubbles, bubbles.skills, index, 'silver');
const div = growthItems(bubbles, bubbles.divisionSkills, index, 'silver');

/** Every seen fact answered right, then `mulShare` / `divShare` percent of the counted facts at `box`. */
function bubblesState(box: number, mulShare: number, divShare: number, bosses: string[] = []) {
  const items: Record<string, ItemState> = {};
  for (const item of seenFacts) items[item] = record(1);
  for (const item of growthItems(bubbles, bubbles.divisionSkills, index, 'seen'))
    items[item] = record(1);
  const take = (list: string[], share: number) =>
    list.slice(0, Math.ceil((list.length * share) / 100));
  for (const item of take(mul, mulShare)) items[item] = record(box);
  for (const item of take(div, divShare)) items[item] = record(box);
  return state(items, bosses);
}

describe('the shipped rules as a variant', () => {
  it('give the rules’ own stage on hand-made states', () => {
    const at = (s: GrowthState) => variantStage(SHIPPED, bubbles, s, data, index);
    expect(at(state({})), 'nothing answered').toBe('egg');
    expect(at(bubblesState(1, 0, 0)), 'every fact answered right once').toBe('hatchling');
    expect(at(bubblesState(2, 60, 60)), '60 % bronze, division too').toBe('youngling');
    expect(at(bubblesState(2, 60, 50)), 'division below 60 %').toBe('hatchling');
    expect(at(bubblesState(3, 90, 90)), '90 % silver, but the troll still waits').toBe('youngling');
    expect(at(bubblesState(3, 90, 90, ['bridge-troll'])), 'and the troll won over').toBe('adult');
  });

  it('give the rules’ own stage on random states of every dragon (property)', () => {
    const random = createPrng('growth-variants');
    const buckets = ['fast', 'ok', 'slow', 'miss'] as const;
    let compared = 0;
    const seen = new Set<string>();
    for (let n = 0; n < 400; n++) {
      const d = data.dragons[random.int(0, data.dragons.length)]!;
      const facts = [
        ...growthItems(d, d.skills, index, 'seen'),
        ...growthItems(d, d.divisionSkills, index, 'seen'),
      ];
      // Sparse states (eggs), graded ones, and states all gold (crowned), so every stage comes up.
      const richness = random.int(0, 5);
      const items: Record<string, ItemState> = {};
      for (const item of facts) {
        if (richness === 4) {
          items[item] = record(5, 3, ['fast', 'fast', 'fast']);
          continue;
        }
        if (random.int(0, 10) < (richness === 0 ? 8 : 2)) continue;
        const box = Math.min(5, random.int(0, 3) + richness);
        const recent = Array.from({ length: random.int(1, 4) }, () => buckets[random.int(0, 4)]!);
        items[item] = record(box, random.int(0, 3) + (box > 0 ? 1 : 0), recent);
      }
      const bosses = d.boss !== null && random.bool() ? [d.boss] : [];
      const s = state(items, bosses);
      const expected = earnedStage(s as unknown as DeepReadonly<ProfileState>, data, d, index);
      expect(variantStage(SHIPPED, d, s, data, index), `${d.id} #${n}`).toBe(expected);
      seen.add(expected);
      compared += 1;
    }
    expect(compared).toBe(400);
    expect([...seen].sort(), 'every stage came up').toEqual(
      ['adult', 'crowned', 'egg', 'hatchling', 'youngling'].sort(),
    );
  });
});

describe('a variant', () => {
  const gates = (adult: number, division?: number): GrowthGate[] =>
    data.balance.growth.map((g) =>
      g.stage === 'youngling' && division !== undefined
        ? { ...g, divisionShare: division }
        : g.stage === 'adult'
          ? { ...g, share: adult }
          : { ...g },
    );

  it('may count the division facts at a share of their own', () => {
    const relaxed: GrowthVariant = { id: 'div30', gates: gates(90, 30) };
    expect(variantStage(relaxed, bubbles, bubblesState(2, 60, 30), data, index)).toBe('youngling');
    expect(variantStage(relaxed, bubbles, bubblesState(2, 60, 20), data, index)).toBe('hatchling');
    expect(variantStage(SHIPPED, bubbles, bubblesState(2, 60, 30), data, index)).toBe('hatchling');
  });

  it('may give some dragons gates of their own', () => {
    const easy: GrowthVariant = { id: 'easy', gates: gates(90), dragons: { bubbles: gates(80) } };
    const s = bubblesState(3, 80, 80, ['bridge-troll']);
    expect(variantStage(easy, bubbles, s, data, index), 'Bubbles at 80 %').toBe('adult');
    expect(variantStage(SHIPPED, bubbles, s, data, index), 'shipped: 90 %').toBe('youngling');
    const sunny = dragon('sunny');
    const sunnyItems: Record<string, ItemState> = {};
    for (const item of [
      ...growthItems(sunny, sunny.skills, index, 'seen'),
      ...growthItems(sunny, sunny.divisionSkills, index, 'seen'),
    ])
      sunnyItems[item] = record(3);
    expect(
      variantStage(easy, sunny, state(sunnyItems, ['bridge-troll']), data, index),
      'other dragons keep the variant’s gates',
    ).toBe('adult');
  });

  it('may count enough days of right answers as bronze or silver (the effort path)', () => {
    const effort: GrowthVariant = {
      id: 'effort',
      gates: gates(90),
      effort: { bronze: 3, silver: 5 },
    };
    // Every counted fact dim (box 1), answered right on 4 days: bronze by effort, not silver.
    const s = bubblesState(1, 0, 0, ['bridge-troll']);
    const four = new Map([...mul, ...div].map((item) => [item, 4]));
    expect(variantStage(effort, bubbles, s, data, index, four)).toBe('youngling');
    const five = new Map([...mul, ...div].map((item) => [item, 5]));
    expect(variantStage(effort, bubbles, s, data, index, five), 'five days: silver').toBe('adult');
    expect(variantStage(SHIPPED, bubbles, s, data, index, five), 'no effort path').toBe(
      'hatchling',
    );
    expect(
      variantStage(effort, bubbles, s, data, index, new Map()),
      'no right days, no effort',
    ).toBe('hatchling');
  });
});

describe('following a run', () => {
  const ladder: GrowthVariant = {
    id: 'ladder',
    gates: [
      { stage: 'hatchling', share: 30, mastery: 'seen', division: false, boss: false },
      { stage: 'youngling', share: 50, mastery: 'seen', division: false, boss: false },
    ],
  };

  it('records the first day of each stage, every stage passed on the way, and never goes down', () => {
    const probes = new GrowthProbes(data, index, [ladder]);
    const answered = (share: number) => {
      const items: Record<string, ItemState> = {};
      for (const item of seenFacts.slice(0, Math.ceil((seenFacts.length * share) / 100)))
        items[item] = record(1);
      return state(items, [], ['bubbles']);
    };
    probes.update(answered(10), 0);
    expect(probes.days['ladder'], 'below every gate').toEqual({});
    probes.update(answered(60), 2);
    expect(probes.days['ladder']!['bubbles'], 'both gates on day 2').toEqual({
      hatchling: 2,
      youngling: 2,
    });
    probes.update(answered(10), 3);
    expect(probes.days['ladder']!['bubbles'], 'the facts slipped back: no change').toEqual({
      hatchling: 2,
      youngling: 2,
    });
    probes.update(answered(60), 4);
    expect(probes.days['ladder']!['bubbles'], 'and came back: still the first days').toEqual({
      hatchling: 2,
      youngling: 2,
    });
  });

  it('counts days of right answers per fact, `gap` days apart, once a day', () => {
    const silver: GrowthVariant = {
      id: 'gap2',
      gates: [{ stage: 'hatchling', share: 100, mastery: 'silver', division: false, boss: false }],
      effort: { silver: 3, gap: 2 },
    };
    const probes = new GrowthProbes(data, index, [silver]);
    const item = mul[0]!;
    // Right answers on days 0 (twice), 1, 2, 5 and 6: counted on 0, 2 and 5.
    const answers: [number, number][] = [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 4],
      [5, 5],
      [6, 6],
    ];
    const counted: number[] = [];
    for (const [day, correct] of answers) {
      const items = Object.fromEntries(mul.map((i) => [i, record(1, 0)]));
      items[item] = { ...record(1, correct), lastDay: DAY + day };
      probes.update(state(items, [], ['bubbles']), day);
      // Every other counted fact is never answered right, so only this one can count.
      counted.push(probes.rightDays(2).get(item) ?? 0);
    }
    expect(counted).toEqual([1, 1, 1, 2, 3, 3]);
  });
});
