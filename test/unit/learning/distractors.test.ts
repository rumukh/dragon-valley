/**
 * Distractors: the answer options of choice input. Every option list offers the answer exactly
 * once, never repeats an option, and fills the rest with plausible mistakes (whole numbers within
 * 0-1000 and about as long as the answer; remainder pairs with remainders below twice the
 * divisor). Each problem shape offers its signature mistake, the misconception its skill is about,
 * and the order comes from the `distractors` stream.
 *
 * The answer is worked out by an independent oracle (test/unit/learning/oracle.ts), never by the
 * contract's `expectedAnswer`.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { BLANK, group, num, op, skillItems, wordFamilyLookup } from '../../../src/rules/contract';
import type { AnswerValue, Expr, Problem, Skill } from '../../../src/rules/contract';
import { choicesFor, keypadPossible, problemFor } from '../../../src/rules/learning/generate';
import { plausibleNumber } from '../../../src/rules/learning/distractors';
import { data, optionViolations, range, sources } from './oracle';

const familyOf = wordFamilyLookup(data);
const skill = (s: Omit<Skill, 'id' | 'titleKey'>): Skill =>
  ({ id: 't', titleKey: 's', ...s }) as Skill;

const SKILLS: Skill[] = [
  skill({
    generator: 'mul.fact',
    params: { tables: range(0, 10), factors: [0, 10], order: 'both' },
  }),
  skill({ generator: 'div.fact', params: { divisors: range(1, 10), quotients: [0, 10] } }),
  skill({
    generator: 'mul.missing',
    params: { tables: range(1, 10), factors: [0, 10], position: 'both' },
  }),
  skill({
    generator: 'div.remainder',
    params: { divisors: range(2, 10), quotients: [0, 10], dividendMax: 99, remainder: 'allowed' },
  }),
  skill({
    generator: 'mul.power10',
    params: { powers: [10, 100], factors: [0, 99], resultMax: 1000 },
  }),
  skill({ generator: 'mul.tens', params: { tens: [1, 9], digits: range(1, 9), resultMax: 1000 } }),
  skill({
    generator: 'mul.2d1d',
    params: { twoDigit: [10, 99], oneDigit: [2, 9], carry: 'allowed', resultMax: 1000 },
  }),
  skill({
    generator: 'div.2d1d',
    params: {
      divisors: range(2, 9),
      quotients: [10, 49],
      dividendMax: 99,
      regroup: 'allowed',
      remainder: 'forbidden',
    },
  }),
  skill({
    generator: 'div.2d1d',
    params: {
      divisors: range(2, 9),
      quotients: [10, 49],
      dividendMax: 99,
      regroup: 'allowed',
      remainder: 'required',
    },
  }),
  skill({
    generator: 'order.ops',
    params: {
      operators: ['add', 'sub', 'mul', 'div'],
      brackets: 'allowed',
      operations: [2, 3],
      operands: [0, 100],
      resultMax: 1000,
    },
  }),
  skill({
    generator: 'compare',
    params: { sides: 'expression', tables: range(2, 10), equalShare: 20 },
  }),
  skill({
    generator: 'compare',
    params: { sides: 'fact-fact', tables: range(0, 10), equalShare: 20 },
  }),
  skill({
    generator: 'terms',
    params: {
      terms: ['factor', 'product', 'dividend', 'divisor', 'quotient', 'remainder'],
      tables: range(2, 10),
    },
  }),
  skill({ generator: 'word', params: { templates: data.wordTemplates.map((t) => t.id) } }),
];

describe('answer options for every generator', () => {
  for (const count of [2, 3, 4, 6]) {
    it(`offer the answer once among ${count} plausible, distinct options`, () => {
      const broken = new Set<string>();
      for (const [index, s] of SKILLS.entries()) {
        const streams = sources(`options-${count}-${index}`);
        const distractors = createPrng(`options-${count}-${index}:distractors`);
        for (const item of skillItems(s, familyOf)) {
          for (let n = 0; n < 12; n++) {
            const problem = problemFor(s, item, streams);
            const options = choicesFor(problem, count, distractors);
            for (const rule of optionViolations(problem, options, count)) {
              broken.add(`${s.generator} ${item}: ${rule}`);
            }
          }
        }
      }
      expect([...broken]).toEqual([]);
    });
  }

  it('shuffles the answer into every position (seeded by the distractors stream)', () => {
    const facts = SKILLS[0]!;
    const streams = sources('positions');
    const distractors = createPrng('positions:distractors');
    const positions = [0, 0, 0, 0];
    for (const item of skillItems(facts, familyOf)) {
      for (let n = 0; n < 4; n++) {
        const problem = problemFor(facts, item, streams);
        const options = choicesFor(problem, 4, distractors);
        const [a, b] =
          problem.kind === 'equation' && problem.left.kind === 'op'
            ? [problem.left.left, problem.left.right]
            : [];
        const answer = (a as { value: number }).value * (b as { value: number }).value;
        positions[options.findIndex((o) => o.kind === 'number' && o.value === answer)]! += 1;
      }
    }
    // 484 problems: each position should hold the answer about a quarter of the time.
    for (const [index, hits] of positions.entries()) {
      expect(hits, `position ${index}: ${positions.join('/')}`).toBeGreaterThan(90);
    }
  });

  it('gives the same options in the same order for the same stream state', () => {
    for (const s of SKILLS) {
      const item = skillItems(s, familyOf)[0]!;
      const problem = problemFor(s, item, sources('same'));
      expect(choicesFor(problem, 4, createPrng('same')), s.generator).toEqual(
        choicesFor(problem, 4, createPrng('same')),
      );
    }
  });
});

/** The options of `problem` over many distractor seeds. */
function optionSets(problem: Problem, seeds = 40): AnswerValue[][] {
  return range(1, seeds).map((seed) => choicesFor(problem, 4, createPrng(`signature-${seed}`)));
}
const numbers = (options: AnswerValue[]) =>
  options.map((o) => (o.kind === 'number' ? o.value : NaN));
const equation = (left: Expr, right: Expr = BLANK): Problem => ({ kind: 'equation', left, right });
const n = num;

describe('signature mistakes are always offered', () => {
  const cases: [string, Problem, number][] = [
    ['14 · 3: the carry forgotten gives 32', equation(op('mul', n(14), n(3))), 32],
    ['23 · 3: only the tens multiplied gives 63', equation(op('mul', n(23), n(3))), 63],
    ['34 · 10: one zero too few gives 34', equation(op('mul', n(34), n(10))), 34],
    ['100 · 7: one zero too few gives 70', equation(op('mul', n(100), n(7))), 70],
    ['30 · 3: the zero dropped gives 9', equation(op('mul', n(30), n(3))), 9],
    ['48 : 4: the tens divided and the ones copied gives 18', equation(op('div', n(48), n(4))), 18],
    ['96 : 8: the tens divided and the ones copied gives 16', equation(op('div', n(96), n(8))), 16],
    [
      '(2 + 3) · 4: the brackets ignored gives 14',
      equation(op('mul', group(op('add', n(2), n(3))), n(4))),
      14,
    ],
    [
      '2 + 3 · 4: strictly left to right gives 20',
      equation(op('add', n(2), op('mul', n(3), n(4)))),
      20,
    ],
  ];
  for (const [name, problem, mistake] of cases) {
    it(name, () => {
      for (const options of optionSets(problem)) expect(numbers(options)).toContain(mistake);
    });
  }

  const story = (model: Expr, family: string): Problem => ({
    kind: 'word',
    template: `word.${family}.test`,
    vars: {},
    model: equation(model) as Extract<Problem, { kind: 'equation' }>,
    operation: null,
  });
  const stories: [string, Problem, number][] = [
    [
      '"4 apples, 3 times as many": 3 more gives 7',
      story(op('mul', n(4), n(3)), 'times-as-many'),
      7,
    ],
    [
      '"12 is 3 times as many as": 3 fewer gives 9',
      story(op('div', n(12), n(3)), 'times-fewer'),
      9,
    ],
    ['"4 apples, 3 more": 3 times as many gives 12', story(op('add', n(4), n(3)), 'more-than'), 12],
    [
      '"12 apples, 3 fewer": "3 times fewer" gives 4',
      story(op('sub', n(12), n(3)), 'fewer-than'),
      4,
    ],
  ];
  for (const [name, problem, mistake] of stories) {
    it(`word problems: ${name}`, () => {
      for (const options of optionSets(problem)) expect(numbers(options)).toContain(mistake);
    });
  }

  it('23 : 5 = 4 r 3: a remainder bigger than the divisor (3 r 8) is offered', () => {
    for (const options of optionSets({ kind: 'divrem', dividend: 23, divisor: 5 })) {
      expect(options).toContainEqual({ kind: 'remainder', quotient: 3, remainder: 8 });
    }
  });

  it('3 : 5 = 0 r 3: the next multiple and its difference (1 r 2) is offered', () => {
    for (const options of optionSets({ kind: 'divrem', dividend: 3, divisor: 5 })) {
      expect(options).toContainEqual({ kind: 'remainder', quotient: 1, remainder: 2 });
    }
  });

  it('terms: the closest term is always offered (product for factor, divisor for dividend)', () => {
    const sentence = { op: 'mul' as const, left: 6, right: 7, result: 42, remainder: null };
    for (const options of optionSets({ kind: 'term', sentence, highlight: 'left' })) {
      expect(options).toContainEqual({ kind: 'term', term: 'product' });
    }
    const division = { op: 'div' as const, left: 42, right: 6, result: 7, remainder: null };
    for (const options of optionSets({ kind: 'term', sentence: division, highlight: 'left' })) {
      expect(options).toContainEqual({ kind: 'term', term: 'divisor' });
    }
  });

  it('7 · 8: options come only from the neighbouring products, 7 + 8 and 65', () => {
    const plausible = new Set([56, 63, 49, 64, 48, 15, 65]);
    for (const options of optionSets(equation(op('mul', n(7), n(8))))) {
      expect(numbers(options).filter((v) => !plausible.has(v))).toEqual([]);
    }
  });

  it('comparisons offer <, > and =', () => {
    const problem: Problem = { kind: 'compare', left: op('mul', n(7), n(8)), right: n(54) };
    for (const options of optionSets(problem)) {
      expect(options.map((o) => (o.kind === 'relation' ? o.relation : '?')).sort()).toEqual([
        'eq',
        'gt',
        'lt',
      ]);
    }
  });
});

describe('plausible numbers', () => {
  it('keeps whole numbers within 1000 and about as long as the answer', () => {
    expect(plausibleNumber(32, 42)).toBe(true);
    expect(plausibleNumber(340, 34)).toBe(true);
    expect(plausibleNumber(7, 700), 'two digits shorter').toBe(false);
    expect(plausibleNumber(3400, 340), 'beyond 1000').toBe(false);
    expect(plausibleNumber(42, 42), 'the answer itself').toBe(false);
    expect(plausibleNumber(-1, 3), 'negative').toBe(false);
    expect(plausibleNumber(1500, 1200), 'a bonus answer above 1000 allows its neighbours').toBe(
      true,
    );
  });
});

describe('keypad', () => {
  it('types numbers and remainders, never relations or terms', () => {
    expect(keypadPossible(equation(op('mul', n(7), n(8))))).toBe(true);
    expect(keypadPossible({ kind: 'divrem', dividend: 23, divisor: 5 })).toBe(true);
    expect(keypadPossible({ kind: 'compare', left: n(3), right: n(4) })).toBe(false);
    expect(
      keypadPossible({
        kind: 'term',
        sentence: { op: 'mul', left: 6, right: 7, result: 42, remainder: null },
        highlight: 'result',
      }),
    ).toBe(false);
  });
});

describe('mutation checks: the option rules fail on broken option lists', () => {
  const problem = equation(op('mul', n(14), n(3)));
  const good: AnswerValue[] = [42, 32, 34, 22].map((value) => ({ kind: 'number', value }));
  it('accepts a good list (the baseline)', () => {
    expect(optionViolations(problem, good, 4)).toEqual([]);
  });
  it('names a missing answer, a repeat, a wrong count, a negative and an implausible number', () => {
    const without = good.map((o) =>
      o.kind === 'number' && o.value === 42 ? { kind: 'number' as const, value: 41 } : o,
    );
    expect(optionViolations(problem, without, 4)).toContain('the answer is offered exactly once');
    expect(optionViolations(problem, [...good.slice(0, 3), good[1]!], 4)).toContain(
      'no option is offered twice',
    );
    expect(optionViolations(problem, good.slice(0, 3), 4)).toContain('4 options');
    expect(
      optionViolations(problem, [...good.slice(0, 3), { kind: 'number', value: -2 }], 4),
    ).toContain('numbers are whole and not negative');
    expect(
      optionViolations(problem, [...good.slice(0, 3), { kind: 'number', value: 4200 }], 4),
    ).toContain('numbers stay within 1000');
  });
  it('names a remainder too big to be a mistake', () => {
    const rem: Problem = { kind: 'divrem', dividend: 23, divisor: 5 };
    const options: AnswerValue[] = [
      { kind: 'remainder', quotient: 4, remainder: 3 },
      { kind: 'remainder', quotient: 3, remainder: 8 },
      { kind: 'remainder', quotient: 2, remainder: 13 },
      { kind: 'remainder', quotient: 5, remainder: 2 },
    ];
    expect(optionViolations(rem, options, 4)).toContain('remainders are below twice the divisor');
  });
});
