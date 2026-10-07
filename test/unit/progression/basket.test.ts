/**
 * The valley's basket (docs/design.md §5.12): due facts that no hatched dragon eats. Snack time
 * for every dragon (`dragon: null`) serves them with the hungry dragons' facts, and the Daily
 * Adventure offers snack time when only the basket has something due. States are built by hand;
 * the expectations are worked out here.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { initialProfileState } from '../../../src/rules/contract';
import type { ItemState, ProfileState } from '../../../src/rules/contract';
import { itemIndex } from '../../../src/rules/learning/index-cache';
import { basketItems, hungryDragons } from '../../../src/rules/progression/dragons';
import { snackProblem, startSnack } from '../../../src/rules/progression/snack';
import { projectView } from '../../../src/rules/view';
import type { Ctx, Read } from '../../../src/rules/types';
import { loadPack } from '../../traces/support';

const data = loadPack().data;
const index = itemIndex(data);
const DAY = 20_000;

/** A fact answered right twice, due `overdue` days ago. */
const due = (overdue = 1): ItemState => ({
  box: 2,
  due: DAY - overdue,
  seen: 2,
  correct: 2,
  recent: ['ok', 'ok'],
  lastDay: DAY - overdue - 1,
});

/** Bubbles (×2) hatched and Ember (×6) still an egg, on a fresh day. */
function state(items: Record<string, ItemState>): ProfileState {
  const s: ProfileState = { ...initialProfileState({ dailyGoal: 30, arena: true }), day: DAY };
  const outfit = { head: null, neck: null, eyes: null, wings: null, nest: null };
  s.items = items;
  s.onboarding = { ...s.onboarding, firstEgg: 'bubbles', placement: 'skipped' };
  s.dragons = {
    bubbles: { stage: 'hatchling', obtainedDay: DAY - 9, stageDay: DAY - 9, outfit },
    ember: { stage: 'egg', obtainedDay: DAY - 2, stageDay: DAY - 2, outfit },
  };
  s.daily = {
    day: DAY,
    answers: 0,
    correct: 0,
    fast: 0,
    levels: 0,
    minigames: 0,
    goal: 30,
    quests: [],
    gift: 'locked',
  };
  return s;
}

const BASKET = {
  'compare:fact-number': due(12),
  'mul:6x8': due(),
  'mul:7x9': due(3),
};

describe("the valley's basket", () => {
  it("holds the due facts no hatched dragon eats, an egg's facts among them", () => {
    const s = state({
      ...BASKET,
      'mul:2x3': due(5),
      'mul:6x7': { ...due(), due: DAY + 1 },
      // No skill serves 12 · 12 (a fact from an older pack, say): it stays out of the basket.
      'mul:12x12': due(),
    });
    expect(basketItems(s, data, index), 'Bubbles eats 2 · 3; 6 · 7 is not due').toEqual([
      'compare:fact-number',
      'mul:6x8',
      'mul:7x9',
    ]);
    s.dragons['ember']!.stage = 'hatchling';
    expect(basketItems(s, data, index), 'Ember hatched: 6 · 8 is hers').toEqual([
      'compare:fact-number',
      'mul:7x9',
    ]);
  });

  it('lets snack time for every dragon start when only the basket has something due', () => {
    const s = state(BASKET);
    expect(hungryDragons(s, data, index)).toEqual([]);
    expect(snackProblem(s, data, index, null)).toBeNull();
    expect(snackProblem(s, data, index, 'bubbles')?.code, 'one dragon: its own facts').toBe(
      'not-hungry',
    );
    expect(snackProblem(state({}), data, index, null)?.code).toBe('not-hungry');
  });

  /** The first problem and the size of a snack for `dragon` on `s`. */
  function snack(s: ProfileState, dragon: string | null) {
    const streams = new Map<string, ReturnType<typeof createPrng>>();
    const ctx = {
      state: s,
      content: { data },
      emit: () => {},
      enterPhase: () => {},
      random: (name: string) => {
        if (!streams.has(name)) streams.set(name, createPrng(`basket:${name}`));
        return streams.get(name)!;
      },
    } as unknown as Ctx;
    startSnack(ctx, index, dragon);
    const round = s.round?.type === 'problems' ? s.round : null;
    return { target: round?.target, item: round?.current?.item };
  }

  it('serves the basket in snack time for every dragon, most overdue first', () => {
    const more = { 'mul:7x6': due(), 'mul:7x7': due(), 'mul:8x8': due(), 'mul:9x9': due() };
    expect(snack(state({ ...BASKET, ...more, 'mul:2x3': due() }), null)).toEqual({
      target: 8,
      item: 'compare:fact-number',
    });
    expect(snack(state({ ...BASKET, 'mul:2x3': due() }), null).target, 'at least 6').toBe(6);
  });

  it("keeps a single dragon's snack to its own facts", () => {
    expect(snack(state({ ...BASKET, 'mul:2x3': due() }), 'bubbles')).toEqual({
      target: 6,
      item: 'mul:2x3',
    });
  });

  it('opens the day with snack time when only the basket has something due', () => {
    expect(read(state(BASKET)).hub.next).toEqual({ kind: 'snack', dragon: null });
    expect(read(state({})).hub.next.kind, 'nothing due: the next level').toBe('level');
  });
});

describe('the review guarantee in the Daily Adventure', () => {
  /** Later in the day: Sunny Meadow 1 and a minigame done, 18 of 20 answers right. */
  function later(items: Record<string, ItemState>): ProfileState {
    const s = state(items);
    s.daily = { ...s.daily!, answers: 20, correct: 18, levels: 1, minigames: 1 };
    s.history = [{ day: DAY, answers: 20, correct: 18, fast: 0 }];
    s.levels = {
      'sunny-meadow.1': { stars: 3, bestAccuracy: 90, plays: 1, placed: false, paidStars: 3 },
    };
    return s;
  }

  it('puts snack time before a new level while a known fact is starving', () => {
    const next = { kind: 'level', level: 'sunny-meadow.2' };
    expect(read(later({ 'mul:2x3': due(3) })).hub.next, 'three days: not yet').toEqual(next);
    expect(read(later({ 'mul:2x3': due(4) })).hub.next).toEqual({ kind: 'snack', dragon: null });
    expect(read(later({ 'compare:fact-number': due(5) })).hub.next, 'the basket too').toEqual({
      kind: 'snack',
      dragon: null,
    });
    const underway = later({ 'mul:2x3': due(4) });
    underway.run = { level: 'sunny-meadow.2', next: 1, results: [] };
    expect(read(underway).hub.next, 'a level under way goes on').toEqual(next);
    // A fact no skill serves any more (from an older pack, say) cannot be fed: no snack for it.
    expect(read(later({ 'mul:12x12': due(9) })).hub.next).toEqual(next);
  });
});

function read(s: ProfileState) {
  return projectView(
    { state: s, content: { data }, revision: 0, turn: 0 } as unknown as Read,
    index,
  );
}
