/**
 * First tastes (docs/design.md §5.12): facts the child was taught (they are in a finished level's
 * skills) but never answered come to snack time, so every fact of a dragon is met soon after it
 * hatches, even once its levels are done. They are served at every other problem of a snack, up
 * to `TASTES_PER_SNACK`: eggs' facts first (they warm them), then the oldest dragons'. States are
 * built by hand; the expectations are worked out here.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { initialProfileState } from '../../../src/rules/contract';
import type { ItemState, ProfileState } from '../../../src/rules/contract';
import { itemIndex } from '../../../src/rules/learning/index-cache';
import { pickSnack } from '../../../src/rules/learning/selection';
import { firstTastes } from '../../../src/rules/progression/dragons';
import { serveNext, TASTES_PER_SNACK } from '../../../src/rules/progression/problems';
import { startSnack } from '../../../src/rules/progression/snack';
import type { Ctx } from '../../../src/rules/types';
import { loadPack } from '../../traces/support';

const data = loadPack().data;
const index = itemIndex(data);
const DAY = 20_000;
const outfit = { head: null, neck: null, eyes: null, wings: null, nest: null };
const done = { stars: 3, bestAccuracy: 100, plays: 1, placed: false, paidStars: 3 };

const known = (overdue = -1): ItemState => ({
  box: 3,
  due: DAY - overdue,
  seen: 3,
  correct: 3,
  recent: ['ok', 'ok', 'ok'],
  lastDay: DAY - 5,
});

function state(options: {
  dragons: Record<string, { stage: 'egg' | 'hatchling'; obtainedDay: number }>;
  levels: string[];
  items?: Record<string, ItemState>;
}): ProfileState {
  const s: ProfileState = { ...initialProfileState({ dailyGoal: 30, arena: true }), day: DAY };
  s.dragons = Object.fromEntries(
    Object.entries(options.dragons).map(([id, d]) => [
      id,
      { stage: d.stage, obtainedDay: d.obtainedDay, stageDay: d.obtainedDay, outfit },
    ]),
  );
  s.levels = Object.fromEntries(options.levels.map((id) => [id, done]));
  s.items = options.items ?? {};
  return s;
}

/** Every ×2 fact and ÷2 fact. */
const twos = index.get('mul-2')!;
const halves = index.get('div-2')!;

describe('first tastes', () => {
  it("are a dragon's facts the child was taught but never answered, multiplication first", () => {
    // Sunny Meadow 1 and 2 teach ×2, ×5 and ×10; division comes in Sunny Meadow 4.
    const s = state({
      dragons: { bubbles: { stage: 'hatchling', obtainedDay: DAY - 2 } },
      levels: ['sunny-meadow.1', 'sunny-meadow.2'],
      items: { 'mul:2x3': known(), 'mul:2x4': known() },
    });
    const tastes = firstTastes(s, data, index, null);
    expect(tastes.length, 'some ×2 facts were taught').toBeGreaterThan(0);
    expect(
      tastes.every((item) => twos.includes(item)),
      'only ×2 facts so far',
    ).toBe(true);
    expect(tastes).not.toContain('mul:2x3');
    expect(tastes).not.toContain('mul:2x4');
    s.levels['sunny-meadow.4'] = done;
    const later = firstTastes(s, data, index, null);
    const firstDivision = later.findIndex((item) => halves.includes(item));
    expect(firstDivision, 'division once Sunny Meadow 4 is done').toBeGreaterThan(0);
    expect(
      later.slice(firstDivision).every((item) => halves.includes(item)),
      'after the multiplication facts',
    ).toBe(true);
  });

  it("warm eggs first, all their facts; then the oldest dragon's", () => {
    // Mirror (×1), Sunny (×5) and Bubbles (×2) have answered all their facts but these. A dragon's
    // facts come in the order of their ids.
    const unmet = [
      'mul:1x7',
      'mul:7x1',
      'mul:5x0',
      'mul:5x3',
      'mul:3x5',
      'mul:5x8',
      'mul:2x6',
      'mul:6x2',
    ];
    const answered = [...index.get('mul-1')!, ...index.get('mul-5')!, ...twos].filter(
      (item) => !unmet.includes(item),
    );
    const s = state({
      dragons: {
        sunny: { stage: 'hatchling', obtainedDay: DAY - 9 },
        bubbles: { stage: 'hatchling', obtainedDay: DAY - 3 },
        mirror: { stage: 'egg', obtainedDay: DAY - 1 },
        'seven-headed': { stage: 'egg', obtainedDay: DAY - 1 },
      },
      levels: ['sunny-meadow.1', 'sunny-meadow.2', 'sunny-meadow.3'],
      items: Object.fromEntries(answered.map((item) => [item, known()])),
    });
    expect(
      firstTastes(s, data, index, null),
      "Mirror's (an egg) first, then Sunny's (older), then Bubbles'; not the finale egg's",
    ).toEqual([
      'mul:1x7',
      'mul:7x1',
      'mul:3x5',
      'mul:5x0',
      'mul:5x3',
      'mul:5x8',
      'mul:2x6',
      'mul:6x2',
    ]);
    expect(firstTastes(s, data, index, 'bubbles'), "Bubbles' snack: its own").toEqual([
      'mul:2x6',
      'mul:6x2',
    ]);
  });

  it('are none before any level is done', () => {
    const s = state({ dragons: { bubbles: { stage: 'hatchling', obtainedDay: DAY } }, levels: [] });
    expect(firstTastes(s, data, index, null)).toEqual([]);
  });
});

describe('a snack with first tastes', () => {
  const tastes = ['mul:2x7', 'mul:2x8', 'mul:2x9', 'mul:2x10'];
  const due = ['mul:2x3', 'mul:2x4', 'mul:2x5', 'mul:2x6'];
  const items = Object.fromEntries(due.map((item, i) => [item, known(i)]));
  const s = state({
    dragons: { bubbles: { stage: 'hatchling', obtainedDay: DAY - 9 } },
    levels: [],
    items,
  });

  /** The items a snack serves at each position, nothing answered in between. */
  function serve(count: number, options: { starving?: boolean; protect?: boolean } = {}): string[] {
    const snack = options.starving ? { ...s, items: { ...s.items, 'mul:2x6': known(6) } } : s;
    const served: string[] = [];
    for (let n = 0; n < count; n++) {
      served.push(
        pickSnack({
          state: snack,
          pool: [...due, ...tastes],
          blocked: [],
          served,
          random: createPrng(`snack-${n}`),
          tastes,
          tastesPerSnack: TASTES_PER_SNACK,
          likelyFirst: options.protect ?? false,
        })!,
      );
    }
    return served;
  }

  it('serves a first taste at every other problem, in order, up to three', () => {
    expect(TASTES_PER_SNACK).toBe(3);
    const served = serve(8);
    expect([served[1], served[3], served[5]]).toEqual(['mul:2x7', 'mul:2x8', 'mul:2x9']);
    expect(
      served.filter((item) => tastes.includes(item)),
      'no fourth taste',
    ).toHaveLength(3);
    expect([served[0]!, served[2]!, served[4]!].every((item) => due.includes(item))).toBe(true);
  });

  it('serves its first taste before a starving fact, the others after it', () => {
    // 2 · 6 is four days past its review: the review guarantee.
    const busy = serve(4, { starving: true });
    expect(busy[1], 'the first taste, however busy the day').toBe('mul:2x7');
    expect(busy[3], 'then the starving fact before any other taste').toBe('mul:2x6');
    expect(
      serve(2, { starving: true, protect: true })[1],
      'success protected: starving first',
    ).toBe('mul:2x6');
  });

  it('skips a first taste served too recently', () => {
    const item = pickSnack({
      state: s,
      pool: [...due, ...tastes],
      blocked: ['mul:2x7'],
      served: ['mul:2x3'],
      random: createPrng('blocked'),
      tastes,
      tastesPerSnack: TASTES_PER_SNACK,
    });
    expect(item).toBe('mul:2x8');
  });

  it('serves no first tastes without any', () => {
    const served: string[] = [];
    for (let n = 0; n < 4; n++) {
      served.push(
        pickSnack({ state: s, pool: due, blocked: [], served, random: createPrng(`${n}`) })!,
      );
    }
    expect(served.every((item) => due.includes(item))).toBe(true);
  });
});

describe('snack time with first tastes', () => {
  /** After Sunny Meadow 1: Bubbles (×2) is hungry for 2 · 3, Sunny (×5) is not; 5 · 7 is new. */
  function valley(): ProfileState {
    const answered = [...twos, ...index.get('mul-5')!].filter((item) => item !== 'mul:5x7');
    const s = state({
      dragons: {
        bubbles: { stage: 'hatchling', obtainedDay: DAY - 9 },
        sunny: { stage: 'hatchling', obtainedDay: DAY - 5 },
      },
      levels: ['sunny-meadow.1'],
      items: {
        ...Object.fromEntries(answered.map((item) => [item, known()])),
        'mul:2x3': known(1),
      },
    });
    s.onboarding = { ...s.onboarding, firstEgg: 'bubbles', placement: 'skipped' };
    return s;
  }

  /** A snack for `dragon`: its size and first two problems, nothing answered in between. */
  function snack(s: ProfileState, dragon: string | null): { target: number; items: string[] } {
    const streams = new Map<string, ReturnType<typeof createPrng>>();
    const ctx = {
      state: s,
      content: { data },
      emit: () => {},
      enterPhase: () => {},
      random: (name: string) => {
        if (!streams.has(name)) streams.set(name, createPrng(`tastes:${name}`));
        return streams.get(name)!;
      },
    } as unknown as Ctx;
    const items: string[] = [];
    startSnack(ctx, index, dragon);
    const target = s.round?.type === 'problems' ? (s.round.target ?? 0) : 0;
    items.push(s.round?.type === 'problems' ? s.round.current!.item : '');
    serveNext(ctx, index);
    items.push(s.round?.type === 'problems' ? s.round.current!.item : '');
    return { target, items };
  }

  it("brings a fed dragon's first taste to snack time for every dragon", () => {
    expect(snack(valley(), null).items, "Bubbles' due fact, then Sunny's first taste").toEqual([
      'mul:2x3',
      'mul:5x7',
    ]);
  });

  it("keeps a dragon's own snack to its own facts, and to those taught", () => {
    const [, second] = snack(valley(), 'bubbles').items;
    expect(second).not.toBe('mul:5x7');
    // 0 : 2 is one of Bubbles' rule facts, never answered, but division is not taught yet.
    expect(twos, "one of Bubbles' ×2 facts").toContain(second);
  });

  it('makes room for its first tastes, three at most', () => {
    // Four of Bubbles' facts are due and five were never answered.
    const due = ['mul:2x3', 'mul:2x4', 'mul:2x6', 'mul:2x7'];
    const untasted = ['mul:2x8', 'mul:8x2', 'mul:2x9', 'mul:9x2', 'mul:2x10'];
    const s = state({
      dragons: { bubbles: { stage: 'hatchling', obtainedDay: DAY - 9 } },
      levels: ['sunny-meadow.1'],
      items: Object.fromEntries(
        twos
          .filter((item) => !untasted.includes(item))
          .map((item) => [item, known(due.includes(item) ? 1 : -1)]),
      ),
    });
    expect(snack(s, 'bubbles').target, 'four due facts and three first tastes').toBe(7);
  });
});
