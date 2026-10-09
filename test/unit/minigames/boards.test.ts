/**
 * Board generation, typed board views and credits (src/rules/minigames/boards.ts), plus the card
 * face encoding. Values are checked against the test's own arithmetic.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { createMinigame, reduceMinigame } from '@aegis/narrative';
import type { MinigameDefinition, MinigameState } from '@aegis/narrative';
import {
  MINIGAMES,
  boardCredits,
  boardView,
  canMakeBoard,
  makeBoard,
} from '../../../src/rules/minigames/boards';
import type { BoardRequest } from '../../../src/rules/minigames/boards';
import {
  cardLabel,
  initialProfileState,
  num,
  op,
  parseCardLabel,
} from '../../../src/rules/contract';
import type { CardFace, MinigameMove, Skill } from '../../../src/rules/contract';

const fives = Array.from({ length: 11 }, (_, k) => `mul:5x${k}`);
const byTwo = Array.from({ length: 11 }, (_, q) => `div:${2 * q}:2`);
const mulSkill: Skill = {
  id: 'mul-5',
  titleKey: 'skill.mul-5',
  generator: 'mul.fact',
  params: { tables: [5], factors: [0, 10], order: 'table-first' },
};

function request(overrides: Partial<BoardRequest>): BoardRequest {
  return {
    activity: 'egg-grid',
    id: 'r1.b1',
    pool: fives,
    focus: null,
    skills: [mulSkill],
    options: {},
    previous: null,
    state: initialProfileState({ dailyGoal: 30, arena: true }),
    random: createPrng('boards'),
    ...overrides,
  };
}

function run(def: MinigameDefinition, moves: MinigameMove[]) {
  let state = createMinigame(def, def.id, MINIGAMES);
  const states = [state];
  for (const move of moves) {
    state = reduceMinigame(
      def,
      state,
      { type: 'move', revision: state.revision, value: move },
      MINIGAMES,
    );
    states.push(state);
  }
  return states;
}

const view = (def: MinigameDefinition, state: MinigameState) =>
  boardView(def, state, null as never);

describe('card faces', () => {
  it('encode and decode every face kind', () => {
    const faces: CardFace[] = [
      { kind: 'expr', expr: op('mul', num(7), num(8)) },
      { kind: 'expr', expr: op('div', num(56), num(7)) },
      { kind: 'expr', expr: op('add', num(3), num(5)) },
      { kind: 'expr', expr: op('sub', num(8), num(3)) },
      { kind: 'answer', answer: { kind: 'number', value: 56 } },
      { kind: 'answer', answer: { kind: 'remainder', quotient: 4, remainder: 3 } },
      { kind: 'answer', answer: { kind: 'term', term: 'product' } },
      {
        kind: 'sentence',
        sentence: { op: 'mul', left: 6, right: 7, result: 42, remainder: null },
        highlight: 'result',
      },
      {
        kind: 'sentence',
        sentence: { op: 'div', left: 23, right: 5, result: 4, remainder: 3 },
        highlight: null,
      },
    ];
    for (const face of faces) expect(parseCardLabel(cardLabel(face))).toEqual(face);
    // Every label is a valid narrative stable ID (no `+`).
    for (const label of faces.map(cardLabel))
      expect(label).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
    expect(faces.map(cardLabel)).toEqual([
      'fact:mul:7x8',
      'fact:div:56:7',
      'expr:add:3:5',
      'expr:sub:8:3',
      'num:56',
      'rem:4:3',
      'term:product',
      'example:mul:6:7:42:-:result',
      'example:div:23:5:4:3:none',
    ]);
  });

  it('decode card backs and malformed labels as no face', () => {
    for (const label of [
      'card:back',
      'fact:mul:7x11',
      'fact:div:7:2',
      'num:-1',
      'term:answer',
      'example:mul:6:7:42:-:middle',
      'x.7.8',
    ]) {
      expect(parseCardLabel(label), label).toBeNull();
    }
  });
});

describe('Memory Match boards', () => {
  it('pairs facts with their products, every value different', () => {
    const def = makeBoard(request({ activity: 'memory-match', options: { pairs: 6 } }));
    const board = view(def, createMinigame(def, def.id, MINIGAMES));
    expect(board.kind).toBe('memory-match');
    if (board.kind !== 'memory-match') return;
    expect(board.cards).toHaveLength(12);
    expect(board.cards.every((c) => !c.faceUp && c.face === null)).toBe(true);
    const cards = (
      def.config as { cards: { pair: string; labelKey: string; backLabelKey: string }[] }
    ).cards;
    expect(cards.every((c) => c.backLabelKey === 'card:back')).toBe(true);
    const values = new Set<number>();
    for (const pair of new Set(cards.map((c) => c.pair))) {
      const [a, b] = cards.filter((c) => c.pair === pair).map((c) => parseCardLabel(c.labelKey)!);
      const expr = a!.kind === 'expr' ? a! : b!;
      const answer = a!.kind === 'answer' ? a! : b!;
      if (expr.kind !== 'expr' || answer.kind !== 'answer' || expr.expr.kind !== 'op') {
        throw new Error('a pair is an expression and a number');
      }
      const [left, right] = [expr.expr.left, expr.expr.right] as { value: number }[];
      expect(answer.answer).toEqual({ kind: 'number', value: left!.value * right!.value });
      values.add(left!.value * right!.value);
    }
    expect(values.size).toBe(6);
  });

  it('pairs division facts with their quotients', () => {
    const def = makeBoard(
      request({ activity: 'memory-match', pool: byTwo, options: { pairs: 4 } }),
    );
    const cards = (def.config as { cards: { pair: string; labelKey: string }[] }).cards;
    expect(cards).toHaveLength(8);
    for (const card of cards.filter((c) => c.labelKey.startsWith('fact:div:'))) {
      const [, , dividend, divisor] = card.labelKey.split(':').map(Number);
      const partner = cards.find((c) => c.pair === card.pair && c !== card)!;
      expect(partner.labelKey).toBe(`num:${dividend! / divisor!}`);
    }
  });

  it('pairs additive facts with values and additive family partners', () => {
    const valueDef = makeBoard(
      request({ activity: 'memory-match', pool: ['add:3+5', 'sub:8-3'], options: { pairs: 2 } }),
    );
    const valueLabels = (valueDef.config as { cards: { labelKey: string }[] }).cards.map(
      (c) => c.labelKey,
    );
    expect(valueLabels).toContain('expr:add:3:5');
    expect(valueLabels).toContain('expr:sub:8:3');
    expect(valueLabels).toContain('num:8');
    expect(valueLabels).toContain('num:5');

    const familyDef = makeBoard(
      request({
        activity: 'memory-match',
        pool: ['add:3+5'],
        options: { pairs: 1, match: 'family' },
      }),
    );
    const pairs = (familyDef.config as { cards: { pair: string; labelKey: string }[] }).cards;
    const family = pairs.filter((c) => c.pair === 'fam:add:3_5').map((c) => c.labelKey);
    expect(family.sort()).toEqual(['expr:add:3:5', 'expr:sub:8:3']);
  });

  it('plays additive pairs (add:0+0 too) with stable IDs and credits the facts', () => {
    for (const match of ['value', 'family'] as const) {
      const pool = ['add:0+0', 'add:3+5', 'sub:8-3', 'sub:4-4'];
      const def = makeBoard(
        request({ activity: 'memory-match', pool, options: { pairs: 3, match } }),
      );
      const cards = (def.config as { cards: { id: string; pair: string }[] }).cards;
      expect(cards.every((c) => !c.pair.includes('+'))).toBe(true);
      const moves: MinigameMove[] = [];
      for (const pair of new Set(cards.map((c) => c.pair))) {
        for (const c of cards.filter((card) => card.pair === pair)) {
          moves.push({ type: 'select', card: c.id });
        }
      }
      const states = run(def, moves);
      const last = states.at(-1)!;
      expect(last.status, match).toBe('completed');
      const credit = boardCredits(def, states[0]!, last, new Set(pool));
      const items = credit.items.map((entry) => entry.item);
      expect(items.length, match).toBeGreaterThan(0);
      expect(
        items.every((item) => pool.includes(item)),
        items.join(),
      ).toBe(true);
    }
  });

  it('never puts two facts with the same value on one board (a match must be unambiguous)', () => {
    const twelves = ['mul:2x6', 'mul:6x2', 'mul:3x4', 'mul:4x3', 'mul:2x5', 'mul:5x2', 'mul:1x10'];
    const def = makeBoard(
      request({ activity: 'memory-match', pool: twelves, options: { pairs: 6 } }),
    );
    const numbers = (def.config as { cards: { labelKey: string }[] }).cards
      .map((c) => c.labelKey)
      .filter((label) => label.startsWith('num:'));
    expect([...numbers].sort()).toEqual(['num:10', 'num:12']);
  });

  it('credits a pair found before any mismatch as fast, later ones as ok, and pays per pair', () => {
    const def = makeBoard(request({ activity: 'memory-match', options: { pairs: 3 } }));
    const cards = (def.config as { cards: { id: string; pair: string }[] }).cards;
    const [p, q] = [...new Set(cards.map((c) => c.pair))];
    const of = (pair: string) => cards.filter((c) => c.pair === pair).map((c) => c.id);
    const [p1, p2] = of(p!);
    const [q1, q2] = of(q!);
    const pool = new Set(fives);
    const states = run(def, [
      { type: 'select', card: p1! },
      { type: 'select', card: p2! },
    ]);
    expect(boardCredits(def, states[1]!, states[2]!, pool)).toEqual({
      items: [{ item: p, bucket: 'fast' }],
      coins: 1,
    });
    const cleared = run(def, [
      { type: 'select', card: q1! },
      { type: 'select', card: p1! },
      { type: 'clear' },
      { type: 'select', card: q1! },
      { type: 'select', card: q2! },
    ]);
    expect(boardCredits(def, cleared[4]!, cleared[5]!, pool)).toEqual({
      items: [{ item: q, bucket: 'ok' }],
      coins: 1,
    });
  });
});

describe('Number Trail boards', () => {
  it('lays out a trail of multiples with gaps holding shuffled stones', () => {
    const def = makeBoard(request({ activity: 'number-trail', options: { length: 10, gaps: 3 } }));
    expect(def.kind).toBe('ordering');
    const board = view(def, createMinigame(def, def.id, MINIGAMES));
    if (board.kind !== 'number-trail') throw new Error('not a trail');
    expect(board.step).toBe(5);
    expect(board.path).toHaveLength(10);
    expect(board.path[0]).toEqual({ value: 5, gap: null });
    const gaps = board.path.filter((p) => p.gap !== null);
    expect(gaps).toHaveLength(3);
    board.path.forEach((p, i) => {
      if (p.value !== null) expect(p.value).toBe(5 * (i + 1));
    });
    const missing = board.path.flatMap((p, i) => (p.gap === null ? [] : [5 * (i + 1)]));
    expect(board.stones.map((s) => s.value).sort((a, b) => a - b)).toEqual(missing);
    expect(board.stones.map((s) => s.value)).not.toEqual(missing);
  });

  it('never deals the stones already in order, whatever the seed', () => {
    for (let seed = 0; seed < 40; seed++) {
      const def = makeBoard(
        request({
          activity: 'number-trail',
          options: { length: 6, gaps: 2 },
          random: createPrng(`trail-${seed}`),
        }),
      );
      const { items, solution } = def.config as { items: { id: string }[]; solution: string[] };
      expect(
        items.map((item) => item.id),
        `seed ${seed}`,
      ).not.toEqual(solution);
    }
  });

  it('credits the trail facts when it is right on the first check, as ok', () => {
    const def = makeBoard(request({ activity: 'number-trail', options: { length: 6, gaps: 2 } }));
    const solution = (def.config as { solution: string[] }).solution;
    const states = run(def, [
      ...solution.map((item, index) => ({ type: 'place' as const, item, index })),
      { type: 'submit' },
    ]);
    const last = states[states.length - 1]!;
    expect(last.status).toBe('completed');
    const pool = new Set([...fives, ...Array.from({ length: 11 }, (_, k) => `mul:${k}x5`)]);
    const credit = boardCredits(def, states[states.length - 2]!, last, pool);
    expect(credit.coins).toBe(2);
    const groups = solution.map((id) => Number(id.slice(1)) + 1);
    expect(credit.items).toEqual(groups.map((k) => ({ item: `mul:${k}x5`, bucket: 'ok' })));
  });

  it('can lay out grade 1-2 counting trails without changing old trail JSON', () => {
    const countSkill: Skill = {
      id: 'count-20',
      titleKey: 'skill.count-20',
      generator: 'num.count',
      params: { numbers: [0, 20] },
    };
    const def = makeBoard(
      request({
        activity: 'number-trail',
        pool: ['count:0-5', 'count:6-10', 'count:11-20'],
        skills: [countSkill],
        options: { length: 6, gaps: 2 },
      }),
    );
    const board = view(def, createMinigame(def, def.id, MINIGAMES));
    if (board.kind !== 'number-trail') throw new Error('not a trail');
    expect([1, 2, 10]).toContain(board.step);
    if (board.direction === 'down') {
      const fixed = board.path.filter((p) => p.value !== null).map((p) => p.value!);
      expect(fixed[0]).toBeGreaterThan(fixed[fixed.length - 1]!);
    } else {
      expect(board.direction).toBeUndefined();
    }
    expect(board.path).toHaveLength(6);
  });
});

describe('Egg Grid and Fact Family boards', () => {
  it('builds an egg grid for a product of the pool, preferring the focus egg', () => {
    const def = makeBoard(request({ focus: ['mul:5x3'] }));
    expect(def.config).toEqual({ product: 15, maxSide: 10, split: 'none', find: 2 });
    const split = makeBoard(request({ options: { split: 'five-plus' } }));
    expect((split.config as { split: string }).split).toBe('five-plus');
  });

  it('goes from easy to hard over a round, and never deals a line of eggs', () => {
    // The fives with both factors of at least 2: products 10, 15, …, 50, in three bands.
    const products = [1, 2, 3].map(() => new Set<number>());
    for (let seed = 0; seed < 30; seed++) {
      for (const board of [1, 2, 3]) {
        const def = makeBoard(request({ board, boards: 3, random: createPrng(`grid-${seed}`) }));
        products[board - 1]!.add((def.config as { product: number }).product);
      }
    }
    const sorted = products.map((set) => [...set].sort((a, b) => a - b));
    expect(sorted).toEqual([
      [10, 15, 20],
      [25, 30, 35],
      [40, 45, 50],
    ]);
    expect(canMakeBoard('egg-grid', ['mul:5x1', 'mul:1x5', 'mul:5x0'], []), '5 = 1 × 5').toBe(
      false,
    );
  });

  it('never repeats the previous product while another is possible', () => {
    const first = makeBoard(request({ pool: ['mul:5x2', 'mul:5x3'], focus: null }));
    const second = makeBoard(request({ pool: ['mul:5x2', 'mul:5x3'], previous: first }));
    expect((second.config as { product: number }).product).not.toBe(
      (first.config as { product: number }).product,
    );
  });

  it('credits a found rectangle only when its fact belongs to the round', () => {
    const def = makeBoard(request({ pool: ['mul:5x2'], focus: null }));
    const states = run(def, [
      { type: 'set', rows: 2, columns: 5 },
      { type: 'submit' },
      { type: 'set', rows: 5, columns: 2 },
      { type: 'submit' },
    ]);
    const pool = new Set(['mul:2x5']);
    expect(boardCredits(def, states[1]!, states[2]!, pool)).toEqual({
      items: [{ item: 'mul:2x5', bucket: 'ok' }],
      coins: 1,
    });
    expect(boardCredits(def, states[3]!, states[4]!, pool)).toEqual({ items: [], coins: 1 });
  });

  it('builds fact families with two different factors of at least 2', () => {
    const pool = ['mul:5x0', 'mul:5x1', 'mul:5x5', 'mul:5x8'];
    const def = makeBoard(request({ activity: 'fact-family', pool }));
    expect(def.config).toEqual({ a: 5, b: 8, product: 40 });
    expect(canMakeBoard('fact-family', ['mul:5x0', 'mul:5x1', 'mul:5x5'], [])).toBe(false);
  });

  it('builds additive fact families from add/sub items and credits all four facts', () => {
    const def = makeBoard(request({ activity: 'fact-family', pool: ['add:3+5'] }));
    expect(def.config).toEqual({ a: 3, b: 5, product: 8, operation: 'add' });
    const fill = (equation: number, values: number[]): MinigameMove[] =>
      values.map((value, slot) => ({ type: 'fill', equation, slot, value }));
    const right: MinigameMove[] = [
      ...fill(0, [3, 5, 8]),
      ...fill(1, [5, 3, 8]),
      ...fill(2, [8, 3, 5]),
      ...fill(3, [8, 5, 3]),
      { type: 'submit' },
    ];
    const states = run(def, right);
    const credit = boardCredits(
      def,
      states[states.length - 2]!,
      states[states.length - 1]!,
      new Set(['add:3+5', 'add:5+3', 'sub:8-3', 'sub:8-5']),
    );
    expect(credit.items.map((c) => `${c.item}/${c.bucket}`).sort()).toEqual([
      'add:3+5/ok',
      'add:5+3/ok',
      'sub:8-3/ok',
      'sub:8-5/ok',
    ]);
  });

  it('credits the four family facts, ok on the first check and slow after a retry', () => {
    const def = makeBoard(request({ activity: 'fact-family', pool: ['mul:5x8'] }));
    const fill = (equation: number, values: number[]): MinigameMove[] =>
      values.map((value, slot) => ({ type: 'fill', equation, slot, value }));
    const right: MinigameMove[] = [
      ...fill(0, [5, 8, 40]),
      ...fill(1, [8, 5, 40]),
      ...fill(2, [40, 5, 8]),
      ...fill(3, [40, 8, 5]),
    ];
    const pool = new Set(['mul:5x8', 'mul:8x5', 'div:40:5', 'div:40:8']);
    const first = run(def, [...right, { type: 'submit' }]);
    const credit = boardCredits(def, first[first.length - 2]!, first[first.length - 1]!, pool);
    expect(credit.coins).toBe(4);
    expect(credit.items.map((c) => `${c.item}/${c.bucket}`).sort()).toEqual([
      'div:40:5/ok',
      'div:40:8/ok',
      'mul:5x8/ok',
      'mul:8x5/ok',
    ]);
    const retried = run(def, [{ type: 'submit' }, ...right, { type: 'submit' }]);
    const late = boardCredits(
      def,
      retried[retried.length - 2]!,
      retried[retried.length - 1]!,
      pool,
    );
    expect(late.items.every((c) => c.bucket === 'slow')).toBe(true);
  });
});
