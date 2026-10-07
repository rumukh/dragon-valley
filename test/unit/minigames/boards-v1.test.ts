/**
 * The v1 boards (src/rules/minigames/boards.ts): Memory Match's family, term and remainder
 * boards, Number Trails of tens, Sharing Feasts from division facts, remainders and 2-digit
 * division, and Golem Orders credits. Every expectation is worked out with the test's own
 * arithmetic from the card faces and configs.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { createMinigame, reduceMinigame } from '@aegis/narrative';
import type { MinigameDefinition } from '@aegis/narrative';
import {
  MINIGAMES,
  boardCredits,
  boardView,
  canMakeBoard,
  makeBoard,
} from '../../../src/rules/minigames/boards';
import type { BoardRequest } from '../../../src/rules/minigames/boards';
import { group, initialProfileState, num, op, parseCardLabel } from '../../../src/rules/contract';
import type { CardFace, Expr, MinigameMove, Skill } from '../../../src/rules/contract';

const threes = Array.from({ length: 11 }, (_, k) => `mul:3x${k}`);
const byThree = Array.from({ length: 11 }, (_, q) => `div:${3 * q}:3`);
const mulThree: Skill = {
  id: 'mul-3',
  titleKey: 'skill.mul-3',
  generator: 'mul.fact',
  params: { tables: [3], factors: [0, 10], order: 'table-first' },
};
const terms: Skill = {
  id: 'terms-all',
  titleKey: 'skill.terms-all',
  generator: 'terms',
  params: {
    terms: ['factor', 'product', 'dividend', 'divisor', 'quotient', 'remainder'],
    tables: [2, 3, 4, 5, 6, 7, 8, 9],
  },
};
const leftovers: Skill = {
  id: 'rem-3-4',
  titleKey: 'skill.rem-3-4',
  generator: 'div.remainder',
  params: { divisors: [3, 4], quotients: [1, 9], dividendMax: 40, remainder: 'required' },
};
const tens: Skill = {
  id: 'tens-1d',
  titleKey: 'skill.tens-1d',
  generator: 'mul.tens',
  params: { tens: [2, 9], digits: [2, 3, 4, 5, 6, 7, 8, 9], resultMax: 1000 },
};
const bigShare: Skill = {
  id: 'div2d1d',
  titleKey: 'skill.div2d1d',
  generator: 'div.2d1d',
  params: {
    divisors: [3],
    quotients: [10, 33],
    dividendMax: 99,
    regroup: 'required',
    remainder: 'forbidden',
  },
};

function request(overrides: Partial<BoardRequest>): BoardRequest {
  return {
    activity: 'memory-match',
    id: 'r1.b1',
    pool: threes,
    focus: null,
    skills: [mulThree],
    options: {},
    previous: null,
    state: initialProfileState({ dailyGoal: 30, arena: true }),
    random: createPrng('boards-v1'),
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

type Card = { id: string; pair: string; labelKey: string };
const cardsOf = (def: MinigameDefinition) => (def.config as { cards: Card[] }).cards;
/** The two faces of each pair on a Memory Match board. */
function pairs(def: MinigameDefinition): [string, CardFace, CardFace][] {
  const cards = cardsOf(def);
  return [...new Set(cards.map((c) => c.pair))].map((pair) => {
    const [a, b] = cards.filter((c) => c.pair === pair).map((c) => parseCardLabel(c.labelKey)!);
    return [pair, a!, b!];
  });
}
const sentence = (face: CardFace) => {
  if (face.kind !== 'sentence') throw new Error('expected a sentence card');
  return face;
};

describe('Memory Match: family boards (× ↔ ÷)', () => {
  const family = request({
    pool: [...threes, ...byThree],
    options: { pairs: 4, match: 'family' },
  });

  it('pairs a multiplication sentence with a division sentence of the same family', () => {
    const def = makeBoard(family);
    expect(cardsOf(def)).toHaveLength(8);
    const products = new Set<number>();
    for (const [pair, a, b] of pairs(def)) {
      const mul = [a, b].map(sentence).find((s) => s.sentence.op === 'mul')!;
      const div = [a, b].map(sentence).find((s) => s.sentence.op === 'div')!;
      const m = mul.sentence;
      const d = div.sentence;
      expect(m.left * m.right, pair).toBe(m.result);
      expect([d.left, d.right, d.result], pair).toEqual([m.result, m.right, m.left]);
      expect([mul.highlight, div.highlight]).toEqual([null, null]);
      expect(pair).toBe(`fam:mul:${m.left}x${m.right}`);
      products.add(m.result);
    }
    expect(products.size, 'every family has a different product').toBe(4);
  });

  it('credits both facts of a matched family, fast before any mismatch', () => {
    const def = makeBoard(family);
    const [pair] = pairs(def)[0]!;
    const ids = cardsOf(def)
      .filter((c) => c.pair === pair)
      .map((c) => c.id);
    const states = run(
      def,
      ids.map((card) => ({ type: 'select', card })),
    );
    const [a, b] = pair.slice('fam:mul:'.length).split('x').map(Number) as [number, number];
    const credit = boardCredits(def, states[1]!, states[2]!, new Set([...threes, ...byThree]));
    expect(credit).toEqual({
      items: [
        { item: `mul:${a}x${b}`, bucket: 'fast' },
        { item: `div:${a * b}:${b}`, bucket: 'fast' },
      ],
      coins: 1,
    });
  });

  it('needs multiplication facts to build families', () => {
    expect(canMakeBoard('memory-match', byThree, [], { match: 'family' })).toBe(false);
    expect(canMakeBoard('memory-match', threes, [mulThree], { match: 'family' })).toBe(true);
  });
});

describe('Memory Match: term boards', () => {
  const pool = terms.params.terms.map((term) => `terms:${term}`);
  const board = request({ pool, skills: [terms], options: { pairs: 6, match: 'term' } });

  it('pairs each term with a sentence that highlights that term', () => {
    const def = makeBoard(board);
    const found = new Set<string>();
    for (const [pair, a, b] of pairs(def)) {
      const word = [a, b].find((f) => f.kind === 'answer')!;
      const example = sentence([a, b].find((f) => f.kind === 'sentence')!);
      if (word.kind !== 'answer' || word.answer.kind !== 'term') throw new Error('a term card');
      const term = word.answer.term;
      const s = example.sentence;
      const named =
        example.highlight === 'remainder'
          ? 'remainder'
          : s.op === 'mul'
            ? example.highlight === 'result'
              ? 'product'
              : 'factor'
            : { left: 'dividend', right: 'divisor', result: 'quotient' }[example.highlight!];
      expect(named, pair).toBe(term);
      if (s.op === 'mul') expect(s.left * s.right).toBe(s.result);
      else expect(s.result * s.right + (s.remainder ?? 0)).toBe(s.left);
      expect(pair).toBe(`terms:${term}`);
      found.add(term);
    }
    expect([...found].sort()).toEqual([...terms.params.terms].sort());
  });

  it('credits the term of a matched pair', () => {
    const def = makeBoard(board);
    const [pair] = pairs(def)[0]!;
    const ids = cardsOf(def)
      .filter((c) => c.pair === pair)
      .map((c) => c.id);
    const states = run(
      def,
      ids.map((card) => ({ type: 'select', card })),
    );
    expect(boardCredits(def, states[1]!, states[2]!, new Set(pool))).toEqual({
      items: [{ item: pair, bucket: 'fast' }],
      coins: 1,
    });
  });
});

describe('Memory Match: remainder boards', () => {
  const board = request({ pool: ['rem:d3', 'rem:d4'], skills: [leftovers], options: { pairs: 6 } });

  it('pairs a division with leftovers with its quotient and remainder', () => {
    const def = makeBoard(board);
    expect(cardsOf(def)).toHaveLength(12);
    const answers = new Set<string>();
    for (const [pair, a, b] of pairs(def)) {
      const division = [a, b].find((f) => f.kind === 'expr')!;
      const answer = [a, b].find((f) => f.kind === 'answer')!;
      if (division.kind !== 'expr' || division.expr.kind !== 'op') throw new Error('a division');
      if (answer.kind !== 'answer' || answer.answer.kind !== 'remainder') throw new Error('q r r');
      const [total, baskets] = [division.expr.left, division.expr.right].map(
        (e) => (e as { value: number }).value,
      ) as [number, number];
      const { quotient, remainder } = answer.answer;
      expect(division.expr.op).toBe('div');
      expect(quotient * baskets + remainder, pair).toBe(total);
      expect(remainder > 0 && remainder < baskets, pair).toBe(true);
      expect(total).toBeLessThanOrEqual(40);
      expect(pair.startsWith(`rem:d${baskets}/`), pair).toBe(true);
      answers.add(`${quotient}r${remainder}`);
    }
    expect(answers.size, 'every answer on the board is different').toBe(6);
  });

  it('credits the remainder bucket of the divisor', () => {
    const def = makeBoard(board);
    const [pair] = pairs(def)[0]!;
    const ids = cardsOf(def)
      .filter((c) => c.pair === pair)
      .map((c) => c.id);
    const states = run(
      def,
      ids.map((card) => ({ type: 'select', card })),
    );
    const credit = boardCredits(def, states[1]!, states[2]!, new Set(['rem:d3', 'rem:d4']));
    expect(credit).toEqual({ items: [{ item: pair.split('/')[0], bucket: 'fast' }], coins: 1 });
  });
});

describe('Number Trails of tens', () => {
  const pool = tens.params.digits.map((d) => `tens:d${d}`);
  const trail = request({
    activity: 'number-trail',
    pool,
    skills: [tens],
    options: { length: 9, gaps: 3 },
  });

  it('count in whole tens from 20 to 90', () => {
    const steps = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      const def = makeBoard({ ...trail, random: createPrng(`tens-${seed}`) });
      const board = boardView(def, createMinigame(def, def.id, MINIGAMES), null as never);
      if (board.kind !== 'number-trail') throw new Error('a trail');
      expect(board.step % 10).toBe(0);
      expect(board.step).toBeGreaterThanOrEqual(20);
      board.path.forEach((p, i) => {
        if (p.value !== null) expect(p.value).toBe(board.step * (i + 1));
      });
      steps.add(board.step);
    }
    expect([...steps].sort((a, b) => a - b)).toEqual([20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it('credit "tens times a digit" for each stone placed from 2 to 9 groups', () => {
    const def = makeBoard(trail);
    const solution = (def.config as { solution: string[] }).solution;
    const states = run(def, [
      ...solution.map((item, index) => ({ type: 'place' as const, item, index })),
      { type: 'submit' },
    ]);
    const credit = boardCredits(
      def,
      states[states.length - 2]!,
      states[states.length - 1]!,
      new Set(pool),
    );
    const groups = solution.map((id) => Number(id.slice(1)) + 1);
    expect(credit.items).toEqual(
      groups.filter((g) => g >= 2 && g <= 9).map((g) => ({ item: `tens:d${g}`, bucket: 'ok' })),
    );
    expect(credit.coins).toBe(3);
  });
});

describe('Sharing Feast boards', () => {
  const feast = (overrides: Partial<BoardRequest>) =>
    makeBoard(request({ activity: 'sharing-feast', ...overrides }));
  const share = (def: MinigameDefinition, retry = false) => {
    const { total, baskets } = def.config as { total: number; baskets: number };
    const left = total % baskets;
    const each = (total - left) / baskets;
    return run(def, [
      ...(retry ? [{ type: 'submit' as const, each: each + 1, left }] : []),
      ...Array.from({ length: baskets }, (_, basket) => ({
        type: 'put' as const,
        basket,
        count: each,
      })),
      { type: 'submit', each, left },
    ]);
  };
  const credit = (def: MinigameDefinition, pool: string[], retry = false) => {
    const states = share(def, retry);
    expect(states[states.length - 1]!.status).toBe('completed');
    return boardCredits(def, states[states.length - 2]!, states[states.length - 1]!, new Set(pool));
  };

  it('shares a division fact fairly with nothing left, and credits it', () => {
    const def = feast({ pool: ['div:12:3'], skills: [] });
    expect(def.config).toEqual({ total: 12, baskets: 3, remainder: false });
    expect(credit(def, ['div:12:3'])).toEqual({
      items: [{ item: 'div:12:3', bucket: 'ok' }],
      coins: 3,
    });
    expect(credit(def, ['div:12:3'], true).items).toEqual([{ item: 'div:12:3', bucket: 'slow' }]);
  });

  it('credits a right answer given before any fruit was dealt as ok, at the first attempt', () => {
    const def = feast({ pool: ['rem:d4'], skills: [leftovers] });
    const { total } = def.config as { total: number };
    const left = total % 4;
    const states = run(def, [{ type: 'submit', each: (total - left) / 4, left }]);
    expect(states[1]!.status, `${total} : 4 answered at once`).toBe('completed');
    expect(boardCredits(def, states[0]!, states[1]!, new Set(['rem:d4']))).toEqual({
      items: [{ item: 'rem:d4', bucket: 'ok' }],
      coins: 4,
    });
  });

  it('leaves leftovers in the bowl for a remainder skill, fewer than the baskets', () => {
    for (let seed = 0; seed < 20; seed++) {
      const def = feast({
        pool: ['rem:d4'],
        skills: [leftovers],
        random: createPrng(`rem-${seed}`),
      });
      const { total, baskets, remainder } = def.config as {
        total: number;
        baskets: number;
        remainder: boolean;
      };
      expect([baskets, remainder]).toEqual([4, true]);
      expect(total % 4, `seed ${seed}: ${total}`).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(40);
    }
    const def = feast({ pool: ['rem:d4'], skills: [leftovers] });
    expect(credit(def, ['rem:d4'])).toMatchObject({
      items: [{ item: 'rem:d4', bucket: 'ok' }],
      coins: 4,
    });
  });

  it('shares big numbers for 2-digit division, regrouping when the tens do not share evenly', () => {
    for (let seed = 0; seed < 20; seed++) {
      const def = feast({
        pool: ['div2d1d:regroup'],
        skills: [bigShare],
        random: createPrng(`big-${seed}`),
      });
      const { total, baskets, remainder } = def.config as {
        total: number;
        baskets: number;
        remainder: boolean;
      };
      const tensDigit = (total - (total % 10)) / 10;
      expect([baskets, remainder, total % 3]).toEqual([3, false, 0]);
      expect(total / 3).toBeGreaterThanOrEqual(10);
      expect(tensDigit % 3, `seed ${seed}: ${total}`).not.toBe(0);
    }
    const def = feast({ pool: ['div2d1d:regroup'], skills: [bigShare] });
    expect(credit(def, ['div2d1d:regroup']).items).toEqual([
      { item: 'div2d1d:regroup', bucket: 'ok' },
    ]);
  });

  it('needs a division, a remainder or a 2-digit division item to share', () => {
    expect(canMakeBoard('sharing-feast', threes, [mulThree])).toBe(false);
    expect(canMakeBoard('sharing-feast', ['div:0:3', 'div:3:1'], [])).toBe(false);
    expect(canMakeBoard('sharing-feast', ['rem:d4'], [leftovers])).toBe(true);
    expect(canMakeBoard('sharing-feast', ['rem:d4'], [])).toBe(false);
  });
});

describe('Golem Orders credits', () => {
  const golem = (expr: Expr): MinigameDefinition => ({
    schema: 1,
    id: 'r1.b1',
    revision: '1',
    kind: 'dv.golem-orders',
    adapterSchema: 1,
    config: { expr } as never,
    outputs: [],
  });
  const plain = op('add', num(2), op('mul', num(3), num(4)));
  const bracketed = op('mul', group(op('add', num(2), num(3))), num(4));
  const pool = new Set(['order:brackets', 'order:no-brackets']);

  it('credits "no brackets" for a precedence expression solved without a mistake, a coin a step', () => {
    const def = golem(plain);
    const states = run(def, [
      { type: 'pick', path: ['right'] },
      { type: 'answer', value: 12 },
      { type: 'pick', path: [] },
      { type: 'answer', value: 14 },
    ]);
    expect(states[4]!.status).toBe('completed');
    expect(boardCredits(def, states[3]!, states[4]!, pool)).toEqual({
      items: [{ item: 'order:no-brackets', bucket: 'ok' }],
      coins: 2,
    });
  });

  it('credits "brackets" for an expression with brackets, as slow after a mistake', () => {
    const def = golem(bracketed);
    const states = run(def, [
      { type: 'pick', path: [] },
      { type: 'pick', path: ['left', 'inner'] },
      { type: 'answer', value: 5 },
      { type: 'pick', path: [] },
      { type: 'answer', value: 20 },
    ]);
    expect(states[5]!.status).toBe('completed');
    expect(boardCredits(def, states[4]!, states[5]!, pool)).toEqual({
      items: [{ item: 'order:brackets', bucket: 'slow' }],
      coins: 2,
    });
    expect(boardCredits(def, states[0]!, states[1]!, pool), 'nothing before it is done').toEqual({
      items: [],
      coins: 0,
    });
  });
});
