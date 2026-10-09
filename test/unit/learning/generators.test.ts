/**
 * Problem generators: every generator, every parameter range of the 3rd-grade program
 * (docs/curriculum.md §4), exhaustively where the space is small and property-style with many
 * seeds otherwise.
 *
 * Each generated problem must (1) have exactly one correct answer by the contract's reference
 * (`expectedAnswer`), and (2) break none of the rules `violations` restates independently from
 * the curriculum and the skill's parameters. Coverage checks prove the draws reach the whole item
 * space, not just part of it. Goldens are literal digests of generated sequences.
 */
import { describe, expect, it } from 'vitest';
import { createPrng, hashString } from '@aegis/core';
import {
  BLANK,
  NOTATIONS,
  expectedAnswer,
  formatExpr,
  formatProblem,
  group,
  num,
  op,
  skillItems,
  wordFamilyLookup,
} from '../../../src/rules/contract';
import type {
  Expr,
  Operator,
  Problem,
  Skill,
  WordProblem,
  WordTemplate,
} from '../../../src/rules/contract';
import {
  IMPLEMENTED_GENERATORS,
  canGenerate,
  choicesFor,
  problemFor,
} from '../../../src/rules/learning/generate';
import { readsAsWritten } from '../../../src/rules/learning/generators/order';
import { templateCombinations } from '../../../src/rules/learning/generators/word';
import {
  data,
  groups,
  operations,
  parseWritten,
  range,
  readWritten,
  readsAsItsTree,
  shapeOf,
  sources,
  value,
  violations,
} from './oracle';

const familyOf = wordFamilyLookup(data);
const itemsOf = (skill: Skill) => skillItems(skill, familyOf);

/** Generate `perItem` problems for every item of `skill` and collect any rule it breaks. */
function survey(skill: Skill, perItem: number, seed: string) {
  const streams = sources(seed);
  const problems: { item: string; problem: Problem }[] = [];
  const broken: string[] = [];
  for (const item of itemsOf(skill)) {
    for (let i = 0; i < perItem; i++) {
      const problem = problemFor(skill, item, streams);
      problems.push({ item, problem });
      if (!expectedAnswer(problem).ok) broken.push(`${item}: has exactly one answer`);
      for (const rule of violations(skill, item, problem)) broken.push(`${item}: ${rule}`);
    }
  }
  return { problems, broken: [...new Set(broken)] };
}

const skill = <S extends Skill>(s: Omit<S, 'id' | 'titleKey'>): S =>
  ({ id: 'test', titleKey: 'skill.test', ...s }) as S;

describe('the generator registry', () => {
  it('implements every generator of the contract', () => {
    expect([...IMPLEMENTED_GENERATORS].sort()).toEqual(
      [
        'compare',
        'div.2d1d',
        'div.fact',
        'div.remainder',
        'mul.2d1d',
        'mul.fact',
        'mul.missing',
        'mul.power10',
        'mul.tens',
        'order.ops',
        'terms',
        'word',
      ].sort(),
    );
    expect(canGenerate(data.skills.find((s) => s.generator === 'word')!)).toBe(true);
  });

  it('refuses an item the skill can never produce, by name', () => {
    const facts = skill({
      generator: 'mul.fact',
      params: { tables: [2], factors: [0, 10], order: 'both' },
    });
    expect(() => problemFor(facts, 'div:12:3', sources('refuse'))).toThrow(
      /mul.fact cannot practise div:12:3/,
    );
    const rem = skill({
      generator: 'div.remainder',
      params: { divisors: [5], quotients: [0, 9], dividendMax: 99, remainder: 'required' },
    });
    expect(() => problemFor(rem, 'rem:d7', sources('refuse'))).toThrow(/cannot practise rem:d7/);
  });
});

describe('small-table facts (exhaustive)', () => {
  it('asks every one of the 121 multiplication facts as presented', () => {
    const all = skill({
      generator: 'mul.fact',
      params: { tables: range(0, 10), factors: [0, 10], order: 'both' },
    });
    expect(itemsOf(all)).toHaveLength(121);
    expect(survey(all, 1, 'mul-fact').broken).toEqual([]);
  });

  it('asks every one of the 110 division facts', () => {
    const all = skill({
      generator: 'div.fact',
      params: { divisors: range(1, 10), quotients: [0, 10] },
    });
    expect(itemsOf(all)).toHaveLength(110);
    expect(survey(all, 1, 'div-fact').broken).toEqual([]);
  });

  it('asks every missing factor with the blank where the skill puts it, never ? · 0', () => {
    for (const position of ['first', 'second', 'both'] as const) {
      const missing = skill({
        generator: 'mul.missing',
        params: { tables: range(1, 10), factors: [0, 10], position },
      });
      const { problems, broken } = survey(missing, 4, `missing-${position}`);
      expect(broken, position).toEqual([]);
      const blanksFirst = problems.filter(
        ({ problem }) =>
          problem.kind === 'equation' &&
          problem.left.kind === 'op' &&
          problem.left.left.kind === 'blank',
      ).length;
      if (position === 'both')
        expect(blanksFirst, 'both positions occur').toBeGreaterThan(problems.length / 4);
    }
  });
});

describe('division with remainder', () => {
  const remainder = (
    divisors: number[],
    req: 'required' | 'allowed' | 'forbidden',
    quotients: [number, number] = [0, 9],
    dividendMax = 99,
  ) =>
    skill({
      generator: 'div.remainder',
      params: { divisors, quotients, dividendMax, remainder: req },
    });

  it('keeps the core bounds: dividend <= 99, quotient 0-9, remainder < divisor, for every divisor and requirement', () => {
    for (const req of ['required', 'allowed', 'forbidden'] as const) {
      expect(survey(remainder(range(2, 10), req), 60, `rem-${req}`).broken, req).toEqual([]);
    }
    expect(survey(remainder(range(2, 10), 'required', [1, 10]), 40, 'rem-10').broken).toEqual([]);
    expect(survey(remainder([7, 9], 'allowed', [0, 9], 50), 60, 'rem-50').broken).toEqual([]);
  });

  it('reaches every quotient and remainder the skill allows (exhaustive coverage)', () => {
    for (const d of range(2, 10)) {
      const seen = new Set(
        survey(remainder([d], 'required'), 1500, `rem-cover-${d}`).problems.map(({ problem }) =>
          problem.kind === 'divrem' ? `${problem.dividend}` : '?',
        ),
      );
      // Independent enumeration: every dividend up to 99 with quotient 0-9 and a remainder.
      const expected = range(1, 99).filter((n) => n % d !== 0 && (n - (n % d)) / d <= 9);
      expect([...seen].sort(), `divisor ${d}`).toEqual(expected.map(String).sort());
    }
  });
});

describe('beyond the small tables (results within 1000)', () => {
  it('multiplies by 10 and 100 with a single digit at most times 100', () => {
    const power = skill({
      generator: 'mul.power10',
      params: { powers: [10, 100], factors: [1, 99], resultMax: 1000 },
    });
    const { problems, broken } = survey(power, 1500, 'pow10');
    expect(broken).toEqual([]);
    const hundreds = problems
      .filter(({ item }) => item === 'pow10:x100')
      .map(({ problem }) => value(problem.kind === 'equation' ? problem.left : { kind: 'blank' })!);
    expect(new Set(hundreds), 'every multiple of 100 up to 1000').toEqual(
      new Set(range(1, 10).map((f) => f * 100)),
    );
    const tens = problems
      .filter(({ item }) => item === 'pow10:x10')
      .map(({ problem }) => value(problem.kind === 'equation' ? problem.left : { kind: 'blank' })!);
    expect(new Set(tens).size, 'every factor 1-99 times 10').toBe(99);
  });

  it('multiplies tens by a one-digit number, every pair reached', () => {
    const tens = skill({
      generator: 'mul.tens',
      params: { tens: [1, 9], digits: range(2, 9), resultMax: 1000 },
    });
    const { problems, broken } = survey(tens, 120, 'tens');
    expect(broken).toEqual([]);
    const pairs = new Set(
      problems.map(
        ({ item, problem }) => `${item}:${problem.kind === 'equation' ? value(problem.left) : '?'}`,
      ),
    );
    expect(pairs.size, '9 tens x 8 digits').toBe(72);
  });

  it('multiplies two-digit by one-digit numbers with and without a carry, never a round ten', () => {
    for (const carry of ['forbidden', 'required', 'allowed'] as const) {
      const mul = skill({
        generator: 'mul.2d1d',
        params: { twoDigit: [10, 99], oneDigit: [2, 9], carry, resultMax: 1000 },
      });
      const { problems, broken } = survey(mul, 8000, `2d1d-${carry}`);
      expect(broken, carry).toEqual([]);
      const firsts = problems.map(({ problem }) =>
        problem.kind === 'equation' &&
        problem.left.kind === 'op' &&
        problem.left.left.kind === 'num'
          ? problem.left.left.value
          : -1,
      );
      expect(
        firsts.filter((a) => a % 10 === 0),
        `${carry}: round tens belong to mul.tens`,
      ).toEqual([]);
      // Independent enumeration of the non-round pairs the skill allows.
      const allowed = range(10, 99)
        .filter((a) => a % 10 !== 0)
        .flatMap((a) =>
          range(2, 9)
            .filter(
              (b) =>
                a * b <= 1000 &&
                (carry === 'allowed' || (carry === 'required') === (a % 10) * b >= 10),
            )
            .map((b) => `${a}x${b}`),
        );
      const seen = new Set(
        problems.map(({ problem }) =>
          problem.kind === 'equation' && problem.left.kind === 'op'
            ? `${value(problem.left.left)}x${value(problem.left.right)}`
            : '?',
        ),
      );
      expect(
        allowed.filter((pair) => !seen.has(pair)),
        `${carry}: every pair reached`,
      ).toEqual([]);
    }
  });

  it('divides two-digit numbers by one-digit numbers without remainder, with and without regrouping', () => {
    for (const regroup of ['forbidden', 'required', 'allowed'] as const) {
      const div = skill({
        generator: 'div.2d1d',
        params: {
          divisors: range(2, 9),
          quotients: [10, 49],
          dividendMax: 99,
          regroup,
          remainder: 'forbidden',
        },
      });
      const { problems, broken } = survey(div, 2000, `div2d1d-${regroup}`);
      expect(broken, regroup).toEqual([]);
      const allowed = range(2, 9).flatMap((d) =>
        range(10, 49)
          .map((q) => q * d)
          .filter((n) => n <= 99)
          .filter((n) => {
            const tensRegroup = ((n - (n % 10)) / 10) % d !== 0;
            return regroup === 'allowed' || (regroup === 'required') === tensRegroup;
          })
          .map((n) => `${n}:${d}`),
      );
      const seen = new Set(
        problems.map(({ problem }) =>
          problem.kind === 'equation' && problem.left.kind === 'op'
            ? `${value(problem.left.left)}:${value(problem.left.right)}`
            : '?',
        ),
      );
      expect(
        allowed.filter((pair) => !seen.has(pair)),
        `${regroup}: every division reached`,
      ).toEqual([]);
    }
  });

  it('asks a remainder when a bonus skill allows one (75 : 4 = 18 r 3)', () => {
    const bonus = skill({
      generator: 'div.2d1d',
      params: {
        divisors: range(2, 9),
        quotients: [10, 49],
        dividendMax: 99,
        regroup: 'allowed',
        remainder: 'required',
      },
    });
    const { problems, broken } = survey(bonus, 100, 'div2d1d-bonus');
    expect(broken).toEqual([]);
    expect(problems.every(({ problem }) => problem.kind === 'divrem')).toBe(true);
  });
});

describe('order of operations', () => {
  const order = (
    operators: ('add' | 'sub' | 'mul' | 'div')[],
    brackets: 'required' | 'allowed' | 'forbidden',
    operationsRange: [number, number] = [2, 3],
    operands: [number, number] = [0, 100],
    resultMax = 1000,
  ) =>
    skill({
      generator: 'order.ops',
      params: { operators, brackets, operations: operationsRange, operands, resultMax },
    });

  it('keeps every step a whole number within 1000, brackets only where the item asks', () => {
    const cases = [
      order(['add', 'sub', 'mul', 'div'], 'allowed'),
      order(['add', 'sub', 'mul', 'div'], 'required', [2, 2]),
      order(['add', 'sub', 'mul', 'div'], 'forbidden', [3, 3]),
      order(['add', 'mul'], 'allowed', [2, 3], [0, 20], 100),
      order(['sub', 'div'], 'allowed'),
      order(['mul', 'div'], 'allowed'),
      order(['add', 'sub'], 'allowed', [3, 3]),
    ];
    for (const [index, s] of cases.entries()) {
      expect(survey(s, 250, `order-${index}`).broken, JSON.stringify(s.params)).toEqual([]);
    }
  });

  it('keeps · and : inside the small tables and mixes them with + and − when it can', () => {
    const s = order(['add', 'sub', 'mul', 'div'], 'allowed');
    const { problems } = survey(s, 400, 'order-tables');
    const ops = problems.flatMap(({ problem }) =>
      problem.kind === 'equation' ? operations(problem.left) : [],
    );
    const outside = ops.filter(
      (o) =>
        (o.op === 'mul' && (o.left < 2 || o.left > 10 || o.right < 2 || o.right > 10)) ||
        (o.op === 'div' &&
          (o.right < 2 || o.right > 10 || o.value === null || o.value < 2 || o.value > 10)),
    );
    expect(outside, 'products and quotients from the small tables').toEqual([]);
    const plain = problems.filter(({ item }) => item === 'order:no-brackets');
    const mixed = plain.filter(({ problem }) => {
      const kinds = new Set(
        problem.kind === 'equation'
          ? operations(problem.left).map((o) => o.op === 'mul' || o.op === 'div')
          : [],
      );
      return kinds.size === 2;
    });
    expect(mixed.length, 'every no-brackets problem mixes · or : with + or −').toBe(plain.length);
  });

  it('makes the brackets matter: read without them, the value changes', () => {
    const s = order(['add', 'sub', 'mul', 'div'], 'required');
    const { problems } = survey(s, 400, 'order-matter');
    const same = problems.filter(({ problem }) => {
      if (problem.kind !== 'equation') return true;
      const withoutBrackets = readWritten(formatExpr(problem.left).replace(/[()]/g, ''));
      return withoutBrackets === value(problem.left);
    });
    expect(same.map(({ problem }) => formatProblem(problem))).toEqual([]);
  });

  it('puts + or − inside brackets when the operators have them, never 24 : (6 : 2)', () => {
    const s = order(['add', 'sub', 'mul', 'div'], 'required');
    const inside = survey(s, 300, 'order-inside').problems.flatMap(({ problem }) =>
      problem.kind === 'equation'
        ? groups(problem.left).map((g) =>
            g.kind === 'group' && g.inner.kind === 'op' ? g.inner.op : '?',
          )
        : [],
    );
    expect(inside.filter((o) => o !== 'add' && o !== 'sub')).toEqual([]);
    const onlyHigh = order(['mul', 'div'], 'required', [2, 2]);
    expect(
      survey(onlyHigh, 50, 'order-high').broken,
      '· and : only: brackets still possible',
    ).toEqual([]);
  });

  it('reads a tree as written only when steps of the same strength go from the left', () => {
    const cases: [string, Expr, boolean][] = [
      [
        '60 + 6 + 45 : 5 built from the left',
        op('add', op('add', num(60), num(6)), op('div', num(45), num(5))),
        true,
      ],
      [
        '60 + (6 + 45 : 5) without its brackets',
        op('add', num(60), op('add', num(6), op('div', num(45), num(5)))),
        false,
      ],
      ['60 + (6 − 9) without its brackets', op('add', num(60), op('sub', num(6), num(9))), false],
      ['2 · (3 · 4) without its brackets', op('mul', num(2), op('mul', num(3), num(4))), false],
      ['8 − (3 − 1) with its brackets', op('sub', num(8), group(op('sub', num(3), num(1)))), true],
      ['(2 + 3) · 4 with its brackets', op('mul', group(op('add', num(2), num(3))), num(4)), true],
      ['(2 + 3) · 4 without its brackets', op('mul', op('add', num(2), num(3)), num(4)), false],
      [
        '(2 + 3 + 4) · 5 built from the right inside its brackets',
        op('mul', group(op('add', num(2), op('add', num(3), num(4)))), num(5)),
        false,
      ],
      ['2 + 3 · 4', op('add', num(2), op('mul', num(3), num(4))), true],
      ['2 · 3 + 4', op('add', op('mul', num(2), num(3)), num(4)), true],
    ];
    for (const [name, expr, expected] of cases) {
      expect(readsAsWritten(expr), name).toBe(expected);
      expect(readsAsItsTree(expr), `the oracle agrees: ${name}`).toBe(expected);
    }
  });

  it('builds every tree the way its text is read, in both notations, chains from the left', () => {
    const strong = (o: Operator) => o === 'mul' || o === 'div';
    /** `60 + 6 − 9`: an unbracketed operation of the same strength as the left operand. */
    const chained = (expr: Expr): boolean => {
      if (expr.kind === 'group') return chained(expr.inner);
      if (expr.kind !== 'op') return false;
      const left = expr.left;
      return (
        (left.kind === 'op' && strong(left.op) === strong(expr.op)) ||
        chained(left) ||
        chained(expr.right)
      );
    };
    const cases = [
      order(['add', 'sub'], 'forbidden'),
      order(['mul', 'div'], 'allowed'),
      order(['add', 'sub', 'mul', 'div'], 'forbidden', [3, 3]),
      order(['add', 'sub', 'mul', 'div'], 'required', [3, 3]),
      order(['add', 'sub', 'mul', 'div'], 'allowed'),
      order(['add', 'mul'], 'allowed', [2, 3], [0, 20], 100),
    ];
    const misread: string[] = [];
    let chains = 0;
    let total = 0;
    for (const [index, s] of cases.entries()) {
      for (const { problem } of survey(s, 150, `order-reading-${index}`).problems) {
        if (problem.kind !== 'equation') continue;
        total += 1;
        for (const notation of NOTATIONS) {
          const text = formatExpr(problem.left, notation);
          if (shapeOf(parseWritten(text)) !== shapeOf(problem.left)) misread.push(text);
        }
        if (chained(problem.left)) chains += 1;
      }
    }
    expect(misread, 'trees that are not the reading of their own text').toEqual([]);
    expect(
      chains,
      `chains like 60 + 6 + 9 are still asked (${chains} of ${total})`,
    ).toBeGreaterThan(total / 3);
  });
});

describe('comparison', () => {
  const compare = (
    sides: 'fact-number' | 'fact-fact' | 'expression',
    tables: number[],
    equalShare: number,
  ) => skill({ generator: 'compare', params: { sides, tables, equalShare } });

  it('builds every kind of comparison from the skill tables', () => {
    for (const sides of ['fact-number', 'fact-fact', 'expression'] as const) {
      for (const tables of [[6, 7], [2, 5, 10], range(0, 10), [1]]) {
        expect(
          survey(compare(sides, tables, 20), 150, `cmp-${sides}-${tables.join()}`).broken,
          `${sides} ${tables}`,
        ).toEqual([]);
      }
    }
  });

  it('makes about equalShare % of comparisons equal (0 %, 20 %, 100 %)', () => {
    const equalCount = (sides: 'fact-number' | 'fact-fact' | 'expression', share: number) =>
      survey(compare(sides, [6, 7, 8], share), 500, `cmp-share-${sides}-${share}`).problems.filter(
        ({ problem }) => problem.kind === 'compare' && value(problem.left) === value(problem.right),
      ).length;
    for (const sides of ['fact-number', 'fact-fact', 'expression'] as const) {
      expect(equalCount(sides, 0), `${sides} 0 %`).toBe(0);
      expect(equalCount(sides, 100), `${sides} 100 %`).toBe(500);
      const twenty = equalCount(sides, 20);
      expect(twenty, `${sides} 20 %: ${twenty}/500`).toBeGreaterThan(70);
      expect(twenty, `${sides} 20 %: ${twenty}/500`).toBeLessThan(130);
    }
  });

  it('multiplies by 0 only when the skill practises the 0 table', () => {
    const zeroes = (tables: number[]) =>
      survey(compare('fact-fact', tables, 20), 300, `cmp-zero-${tables.join()}`).problems.filter(
        ({ problem }) =>
          problem.kind === 'compare' &&
          [problem.left, problem.right].some((side) => side.kind === 'op' && value(side) === 0),
      ).length;
    expect(zeroes([6, 7]), 'the 6 and 7 tables').toBe(0);
    expect(zeroes([0, 6]), 'the 0 table').toBeGreaterThan(0);
  });
});

describe('terms', () => {
  it('highlights each term in a true sentence from the tables', () => {
    const all = ['factor', 'product', 'dividend', 'divisor', 'quotient', 'remainder'] as const;
    for (const tables of [range(2, 10), [7], [0, 1], [10]]) {
      const terms = skill({ generator: 'terms', params: { terms: [...all], tables } });
      expect(survey(terms, 60, `terms-${tables.join()}`).broken, `${tables}`).toEqual([]);
    }
  });
});

describe('word problems', () => {
  it('has a valid story for every combination it draws from, in every template', () => {
    for (const template of data.wordTemplates) {
      expect(templateCombinations(template).length, template.id).toBeGreaterThan(0);
    }
  });

  it('tells every template of every family with the right numbers, words and model', () => {
    for (const template of data.wordTemplates) {
      const words = skill({ generator: 'word', params: { templates: [template.id] } });
      expect(survey(words, 40, `word-${template.id}`).broken, template.id).toEqual([]);
    }
  });

  it('covers every word family, including the additive contrast', () => {
    expect(new Set(data.wordTemplates.map((t) => t.family))).toEqual(
      new Set([
        'equal-groups',
        'sharing',
        'grouping',
        'times-as-many',
        'times-fewer',
        'more-than',
        'fewer-than',
        'leftover',
        'two-step',
        'add-to',
        'take-from',
      ]),
    );
  });

  it('draws the template among the skill templates of the item family', () => {
    const meadow = data.skills.find((s) => s.id === 'word-meadow')!;
    const { problems, broken } = survey(meadow, 30, 'word-meadow');
    expect(broken).toEqual([]);
    expect(
      new Set(problems.map(({ problem }) => (problem.kind === 'word' ? problem.template : '?'))),
    ).toEqual(
      new Set(['word.equal-groups.nests', 'word.sharing.berries', 'word.more-than.flowers']),
    );
  });

  /** Draw 200 stories from one synthetic template and return their models' answers. */
  const synthetic = (template: WordTemplate) => {
    const content = { wordTemplates: [template], wordLists: data.wordLists };
    const s = skill({ generator: 'word', params: { templates: [template.id] } });
    const streams = sources(`synthetic-${template.id}`, content);
    return range(1, 200).map(() => {
      const problem = problemFor(s, `word:${template.family}`, streams);
      return problem.kind === 'word' ? problem.model : null;
    });
  };
  const v = (name: string) => ({ kind: 'var' as const, name });

  it('leaves something over in every leftover story, even when the numbers could divide', () => {
    const models = synthetic({
      id: 'test.leftover',
      family: 'leftover',
      textKey: 'test.leftover',
      vars: { total: { kind: 'int', min: 10, max: 30 }, size: { kind: 'int', min: 2, max: 5 } },
      model: { kind: 'divrem', dividend: v('total'), divisor: v('size') },
      operation: 'div',
    });
    const exact = models.filter((m) => m?.kind === 'divrem' && m.dividend % m.divisor === 0);
    expect(exact).toEqual([]);
  });

  it('keeps every step and the answer of a story within 1000', () => {
    const models = synthetic({
      id: 'test.big',
      family: 'two-step',
      textKey: 'test.big',
      vars: {
        a: { kind: 'int', min: 30, max: 39 },
        b: { kind: 'int', min: 25, max: 35 },
        c: { kind: 'int', min: 100, max: 250 },
      },
      model: {
        kind: 'value',
        expr: {
          kind: 'op',
          op: 'sub',
          left: { kind: 'op', op: 'mul', left: v('a'), right: v('b') },
          right: v('c'),
        },
      },
      operation: null,
    });
    const over = models.filter((m) => {
      if (m?.kind !== 'equation') return true;
      return operations(m.left).some((o) => o.value === null || o.value > 1000);
    });
    expect(over).toEqual([]);
  });
});

describe('every skill of the content pack', () => {
  it('generates every item of its universe without breaking a rule', () => {
    for (const s of data.skills.filter((s) => !G2_PENDING.has(s.generator))) {
      expect(survey(s, 3, `content-${s.id}`).broken, s.id).toEqual([]);
    }
  });
});

/**
 * Generators the contract declares but G2 has not implemented yet: content skills using them
 * (Pebble Brook, content 1.4.0) are surveyed once G2 lands. Delete this set with the G2 merge.
 */
const G2_PENDING: ReadonlySet<string> = new Set([
  'num.count',
  'num.compare',
  'num.place',
  'add.fact',
  'sub.fact',
  'add.missing',
  'addsub.2d',
]);

/** Random schema-valid parameters inside the curriculum bounds, for the property survey. */
function randomSkill(generator: Skill['generator'], r: ReturnType<typeof createPrng>): Skill {
  const lowHigh = (lo: number, hi: number): [number, number] => {
    const a = r.int(lo, hi + 1);
    const b = r.int(lo, hi + 1);
    return [Math.min(a, b), Math.max(a, b)];
  };
  const subset = (values: number[]) => {
    const picked = values.filter(() => r.bool());
    return picked.length > 0 ? picked : [r.pick(values)];
  };
  const req = () => r.pick(['required', 'allowed', 'forbidden'] as const);
  switch (generator) {
    case 'div.remainder':
      return skill({
        generator,
        params: {
          divisors: subset(range(2, 10)),
          quotients: lowHigh(0, 10),
          dividendMax: r.int(20, 100),
          remainder: req(),
        },
      });
    case 'mul.power10':
      return skill({
        generator,
        params: {
          powers: r.pick([[10], [100], [10, 100]] as (10 | 100)[][]),
          factors: lowHigh(0, 99),
          resultMax: 1000,
        },
      });
    case 'mul.tens':
      return skill({
        generator,
        params: { tens: lowHigh(1, 9), digits: subset(range(2, 9)), resultMax: 1000 },
      });
    case 'mul.2d1d':
      return skill({
        generator,
        params: {
          twoDigit: lowHigh(10, 99),
          oneDigit: lowHigh(2, 9),
          carry: req(),
          resultMax: r.pick([500, 1000]),
        },
      });
    case 'div.2d1d':
      return skill({
        generator,
        params: {
          divisors: subset(range(2, 9)),
          quotients: lowHigh(10, 49),
          dividendMax: r.pick([99, 99, 200]),
          regroup: req(),
          remainder: r.pick(['forbidden', 'forbidden', 'allowed'] as const),
        },
      });
    case 'order.ops': {
      const operators = (['add', 'sub', 'mul', 'div'] as const).filter(() => r.bool());
      return skill({
        generator,
        params: {
          operators: operators.length >= 2 ? [...operators] : ['add', 'mul'],
          brackets: req(),
          operations: lowHigh(2, 3),
          operands: [r.int(0, 6), r.int(20, 101)],
          resultMax: r.pick([100, 500, 1000]),
        },
      });
    }
    case 'compare':
      return skill({
        generator,
        params: {
          sides: r.pick(['fact-number', 'fact-fact', 'expression'] as const),
          tables: subset(range(0, 10)),
          equalShare: r.int(0, 101),
        },
      });
    case 'terms':
      return skill({
        generator,
        params: {
          terms: [
            ...new Set(
              subset(range(0, 5)).map(
                (i) =>
                  (['factor', 'product', 'dividend', 'divisor', 'quotient', 'remainder'] as const)[
                    i
                  ]!,
              ),
            ),
          ],
          tables: subset(range(0, 10)),
        },
      });
    default:
      throw new Error(generator);
  }
}

describe('property: random parameters inside the curriculum bounds', () => {
  const generators = [
    'div.remainder',
    'mul.power10',
    'mul.tens',
    'mul.2d1d',
    'div.2d1d',
    'order.ops',
    'compare',
    'terms',
  ] as const;
  for (const generator of generators) {
    it(`${generator}: every item of skillItems is generated and breaks no rule (60 parameter sets)`, () => {
      const r = createPrng(`params:${generator}`);
      for (let n = 0; n < 60; n++) {
        const s = randomSkill(generator, r);
        if (itemsOf(s).length === 0) continue;
        expect(survey(s, 4, `${generator}-${n}`).broken, JSON.stringify(s.params)).toEqual([]);
      }
    });
  }
});

/** A digest of `count` problems and their choices for a skill, cycling through its items. */
function digest(s: Skill, seed: string, count = 30): string {
  const streams = sources(seed);
  const distractors = createPrng(`${seed}:distractors`);
  const items = itemsOf(s);
  const out = [];
  for (let i = 0; i < count; i++) {
    const item = items[i % items.length]!;
    const problem = problemFor(s, item, streams);
    out.push({ item, problem, choices: choicesFor(problem, 4, distractors) });
  }
  return hashString(JSON.stringify(out));
}

const GOLDEN_SKILLS: Record<string, Skill> = {
  'mul.fact': skill({
    generator: 'mul.fact',
    params: { tables: [7, 8], factors: [0, 10], order: 'both' },
  }),
  'div.fact': skill({ generator: 'div.fact', params: { divisors: [6, 7], quotients: [0, 10] } }),
  'mul.missing': skill({
    generator: 'mul.missing',
    params: { tables: [6, 9], factors: [0, 10], position: 'both' },
  }),
  'div.remainder': skill({
    generator: 'div.remainder',
    params: { divisors: range(2, 9), quotients: [0, 9], dividendMax: 99, remainder: 'required' },
  }),
  'mul.power10': skill({
    generator: 'mul.power10',
    params: { powers: [10, 100], factors: [1, 99], resultMax: 1000 },
  }),
  'mul.tens': skill({
    generator: 'mul.tens',
    params: { tens: [1, 9], digits: range(2, 9), resultMax: 1000 },
  }),
  'mul.2d1d': skill({
    generator: 'mul.2d1d',
    params: { twoDigit: [10, 99], oneDigit: [2, 9], carry: 'allowed', resultMax: 1000 },
  }),
  'div.2d1d': skill({
    generator: 'div.2d1d',
    params: {
      divisors: range(2, 9),
      quotients: [10, 49],
      dividendMax: 99,
      regroup: 'allowed',
      remainder: 'forbidden',
    },
  }),
  'order.ops': skill({
    generator: 'order.ops',
    params: {
      operators: ['add', 'sub', 'mul', 'div'],
      brackets: 'allowed',
      operations: [2, 3],
      operands: [0, 100],
      resultMax: 1000,
    },
  }),
  compare: skill({
    generator: 'compare',
    params: { sides: 'expression', tables: [6, 7], equalShare: 20 },
  }),
  terms: skill({
    generator: 'terms',
    params: {
      terms: ['factor', 'product', 'dividend', 'divisor', 'quotient', 'remainder'],
      tables: range(2, 10),
    },
  }),
  word: skill({ generator: 'word', params: { templates: data.wordTemplates.map((t) => t.id) } }),
};

/**
 * Literal digests of 30 generated problems with their choices per generator (seed "golden"),
 * captured from the first green run (Windows, Node 24, Aegis SDK 5949a7f, content 1.0.0 with the
 * S2a word templates). Re-pin only for a deliberate change to a generator, its distractors or the
 * word content, and say why in the commit message.
 */
const GOLDEN_DIGESTS: Record<string, string> = {
  'mul.fact': '3491a00ed907fb13',
  'div.fact': '12f4165424ee44ef',
  'mul.missing': 'b9665046181fc43b',
  'div.remainder': 'aa79f640bcc1cf28',
  'mul.power10': '7e5dfd7c3968cde1',
  'mul.tens': '514df63e9cec896e',
  'mul.2d1d': 'f264932240426237',
  'div.2d1d': '4e74529cb7ab5b93',
  'order.ops': '5476b30016ea6583',
  compare: 'e401e296cf834ea4',
  terms: '6a437531585bea35',
  word: 'b9b9c7aedeb5e6c9', // 1.4.0: the golden skill draws the new add-to and take-from templates too
};

describe('determinism', () => {
  it('draws the same problems and choices from the same seed, and others from another', () => {
    for (const [generator, s] of Object.entries(GOLDEN_SKILLS)) {
      expect(digest(s, 'same'), generator).toBe(digest(s, 'same'));
      expect(digest(s, 'same'), generator).not.toBe(digest(s, 'other'));
    }
  });

  it('matches the pinned golden digest of every generator', () => {
    const actual = Object.fromEntries(
      Object.entries(GOLDEN_SKILLS).map(([g, s]) => [g, digest(s, 'golden')]),
    );
    expect(actual).toEqual(GOLDEN_DIGESTS);
  });
});

describe('mutation checks: the rules name broken problems', () => {
  const eq = (left: Expr, right: Expr = BLANK): Problem => ({ kind: 'equation', left, right });
  const remainder = skill({
    generator: 'div.remainder',
    params: { divisors: [5], quotients: [0, 9], dividendMax: 99, remainder: 'required' },
  });
  const twoDigit = (carry: 'required' | 'forbidden') =>
    skill({
      generator: 'mul.2d1d',
      params: { twoDigit: [10, 99], oneDigit: [2, 9], carry, resultMax: 1000 },
    });
  const division = skill({
    generator: 'div.2d1d',
    params: {
      divisors: range(2, 9),
      quotients: [10, 49],
      dividendMax: 99,
      regroup: 'required',
      remainder: 'forbidden',
    },
  });
  const order = skill({
    generator: 'order.ops',
    params: {
      operators: ['add', 'sub', 'mul', 'div'],
      brackets: 'allowed',
      operations: [2, 3],
      operands: [0, 100],
      resultMax: 1000,
    },
  });
  const cases: [string, Skill, string, Problem, string][] = [
    [
      'a different fact',
      GOLDEN_SKILLS['mul.fact']!,
      'mul:7x8',
      eq(op('mul', num(8), num(7))),
      'the problem is 7 · 8 = ?',
    ],
    [
      'a different division',
      GOLDEN_SKILLS['div.fact']!,
      'div:56:7',
      eq(op('div', num(56), num(8))),
      'the problem is 56 : 7 = ?',
    ],
    [
      'the blank in the wrong place',
      skill({
        generator: 'mul.missing',
        params: { tables: [7], factors: [0, 10], position: 'first' },
      }),
      'div:56:7',
      eq(op('mul', num(7), BLANK), num(56)),
      'the blank sits where the skill asks',
    ],
    [
      'no remainder where one is required',
      remainder,
      'rem:d5',
      { kind: 'divrem', dividend: 25, divisor: 5 },
      'the remainder is required',
    ],
    [
      'a dividend over 99',
      remainder,
      'rem:d5',
      { kind: 'divrem', dividend: 104, divisor: 5 },
      'the dividend is at most 99',
    ],
    [
      'a quotient beyond the table',
      remainder,
      'rem:d5',
      { kind: 'divrem', dividend: 54, divisor: 5 },
      'the quotient is in the skill range',
    ],
    [
      'a product over 1000',
      GOLDEN_SKILLS['mul.power10']!,
      'pow10:x100',
      eq(op('mul', num(11), num(100))),
      'the product is at most 1000',
    ],
    [
      'another digit',
      GOLDEN_SKILLS['mul.tens']!,
      'tens:d3',
      eq(op('mul', num(30), num(4))),
      'tens times 3',
    ],
    [
      'no carry for a carry item',
      twoDigit('required'),
      'mul2d1d:carry',
      eq(op('mul', num(23), num(3))),
      'the ones carry into the tens',
    ],
    [
      'a carry for a no-carry item',
      twoDigit('forbidden'),
      'mul2d1d:nocarry',
      eq(op('mul', num(14), num(3))),
      'nothing carries',
    ],
    [
      'no regrouping for a regroup item',
      division,
      'div2d1d:regroup',
      eq(op('div', num(48), num(4))),
      'the tens regroup',
    ],
    [
      'a remainder the skill forbids',
      division,
      'div2d1d:regroup',
      { kind: 'divrem', dividend: 49, divisor: 3 },
      'no remainder is asked for when the skill forbids remainders',
    ],
    [
      'no brackets for a brackets item',
      order,
      'order:brackets',
      eq(op('add', num(2), op('mul', num(3), num(4)))),
      'the expression has brackets',
    ],
    [
      'brackets for a no-brackets item',
      order,
      'order:no-brackets',
      eq(op('mul', group(op('add', num(2), num(3))), num(4))),
      'the expression has no brackets',
    ],
    [
      'a number over the operand range',
      order,
      'order:no-brackets',
      eq(op('add', num(200), op('mul', num(3), num(4)))),
      'every number is in the operand range',
    ],
    [
      'a negative step',
      order,
      'order:no-brackets',
      eq(op('sub', num(2), op('mul', num(3), num(4)))),
      'every step is a whole number within the result maximum',
    ],
    [
      'a chain built from the right (60 + 6 + 45 : 5 done as 60 + (6 + 9))',
      order,
      'order:no-brackets',
      eq(op('add', num(60), op('add', num(6), op('div', num(45), num(5))))),
      'the written expression reads as its tree',
    ],
    [
      'a side built from the right',
      skill({ generator: 'compare', params: { sides: 'expression', tables: [7], equalShare: 20 } }),
      'compare:expression',
      {
        kind: 'compare',
        left: op('add', num(2), op('add', num(7), op('mul', num(7), num(3)))),
        right: num(30),
      },
      'both sides read as their trees',
    ],
    [
      'a far number',
      skill({
        generator: 'compare',
        params: { sides: 'fact-number', tables: [7], equalShare: 20 },
      }),
      'compare:fact-number',
      { kind: 'compare', left: op('mul', num(7), num(8)), right: num(20) },
      'the number is within 10 of the product',
    ],
    [
      'products outside the tables',
      skill({ generator: 'compare', params: { sides: 'fact-fact', tables: [7], equalShare: 20 } }),
      'compare:fact-fact',
      { kind: 'compare', left: op('mul', num(6), num(8)), right: op('mul', num(7), num(7)) },
      'two table products',
    ],
    [
      'the wrong highlight',
      GOLDEN_SKILLS.terms!,
      'terms:product',
      {
        kind: 'term',
        sentence: { op: 'mul', left: 6, right: 7, result: 42, remainder: null },
        highlight: 'left',
      },
      'the highlighted number is the product',
    ],
    [
      'a false sentence',
      GOLDEN_SKILLS.terms!,
      'terms:product',
      {
        kind: 'term',
        sentence: { op: 'mul', left: 6, right: 7, result: 41, remainder: null },
        highlight: 'result',
      },
      'the sentence is a true product',
    ],
  ];
  for (const [name, s, item, problem, rule] of cases) {
    it(`${s.generator}: ${name} breaks "${rule}"`, () => {
      expect(violations(s, item, problem)).toContain(rule);
    });
  }

  it('word: a number out of range, a wrong model, a wrong plural and a repeated name are named', () => {
    const fruit = data.wordTemplates.find((t) => t.id === 'word.times-as-many.fruit')!;
    const s = skill({ generator: 'word', params: { templates: [fruit.id] } });
    const good = problemFor(s, 'word:times-as-many', sources('mutate-word'));
    expect(violations(s, 'word:times-as-many', good), 'the generated problem is fine').toEqual([]);
    if (good.kind !== 'word') throw new Error('not a word problem');
    const story: WordProblem = good;
    const tamper = (change: (p: WordProblem) => void) => {
      const copy = JSON.parse(JSON.stringify(story)) as WordProblem;
      change(copy);
      return violations(s, 'word:times-as-many', copy);
    };
    expect(tamper((p) => (p.vars['times'] = 7))).toContain('times is in 2-4');
    expect(
      tamper(
        (p) => (p.model = { kind: 'equation', left: op('add', num(1), num(1)), right: BLANK }),
      ),
    ).toContain('the model is the story arithmetic');
    expect(
      tamper((p) => {
        p.vars['small'] = 1;
        p.vars['thing'] = String(p.vars['things']);
      }),
    ).toContain('thing agrees with small');
    expect(tamper((p) => (p.vars['friend'] = p.vars['name']!))).toContain(
      'different words from names',
    );
  });
});
