/**
 * Exhaustive checks for the grades 1-2 problem generators. These tests recompute the practised
 * item from the generated problem so each problem stays in the exact fact or bucket it claims.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import {
  BLANK,
  addCrossesTen,
  evaluate,
  expectedAnswer,
  num,
  op,
  parseItemId,
  skillItems,
  subCrossesTen,
  wordFamilyLookup,
} from '../../../src/rules/contract';
import type {
  Expr,
  ItemState,
  Problem,
  ProblemRoundView,
  Skill,
  WordTemplate,
} from '../../../src/rules/contract';
import { choicesFor, problemFor } from '../../../src/rules/learning/generate';
import { creditItem } from '../../../src/rules/learning/credit';
import { isDue } from '../../../src/rules/learning/items';
import { initialProfileState } from '../../../src/rules/contract';
import type { Ctx } from '../../../src/rules/types';
import { oracle as traceOracle, wrongAnswer } from '../../traces/support';
import { data, range, sources } from './oracle';

const familyOf = wordFamilyLookup(data);
const itemsOf = (skill: Skill) => skillItems(skill, familyOf);
const skill = (s: Omit<Skill, 'id' | 'titleKey'>): Skill =>
  ({ id: 'g12', titleKey: 'skill.g12', ...s }) as Skill;

function numbers(problem: Problem): number[] {
  const answer = expectedAnswer(problem);
  expect(answer.ok).toBe(true);
  return [answer.ok && answer.value.kind === 'number' ? answer.value.value : -1];
}

function opNumbers(expr: Expr): [number, number] | null {
  return expr.kind === 'op' && expr.left.kind === 'num' && expr.right.kind === 'num'
    ? [expr.left.value, expr.right.value]
    : null;
}

function generated(skill: Skill, item: string, count = 20): Problem[] {
  return range(1, count).map((seed) => problemFor(skill, item, sources(`${item}-${seed}`)));
}

describe('grades 1-2 generators', () => {
  it('num.count practises the requested count band with a dots picture', () => {
    const s = skill({ generator: 'num.count', params: { numbers: [3, 12] } });
    expect(itemsOf(s)).toEqual(['count:0-5', 'count:11-20', 'count:6-10']);
    for (const item of itemsOf(s)) {
      const [low, high] = item.slice('count:'.length).split('-').map(Number) as [number, number];
      for (const problem of generated(s, item)) {
        expect(problem.kind).toBe('equation');
        if (problem.kind !== 'equation') continue;
        expect(problem.left).toEqual(BLANK);
        expect(problem.picture?.kind).toBe('dots');
        const answer = numbers(problem)[0]!;
        expect(answer).toBe(problem.picture?.kind === 'dots' ? problem.picture.count : -1);
        expect(answer).toBeGreaterThanOrEqual(Math.max(low, 3));
        expect(answer).toBeLessThanOrEqual(Math.min(high, 12));
      }
    }
  });

  it('num.compare draws number-number comparisons in the item band and honours equality', () => {
    const equal = skill({
      generator: 'num.compare',
      params: { numbers: [0, 20], equalShare: 100 },
    });
    for (const problem of generated(equal, 'ncompare:0-20', 8)) {
      expect(problem.kind).toBe('compare');
      if (problem.kind === 'compare') expect(evaluate(problem.left)).toBe(evaluate(problem.right));
    }

    const mixed = skill({ generator: 'num.compare', params: { numbers: [10, 30], equalShare: 0 } });
    for (const problem of generated(mixed, 'ncompare:0-100', 60)) {
      expect(problem.kind).toBe('compare');
      if (problem.kind !== 'compare') continue;
      const left = evaluate(problem.left)!;
      const right = evaluate(problem.right)!;
      expect(left).toBeGreaterThanOrEqual(10);
      expect(right).toBeGreaterThanOrEqual(10);
      expect(left).toBeLessThanOrEqual(30);
      expect(right).toBeLessThanOrEqual(30);
      expect(left).not.toBe(right);
    }
  });

  it('num.place asks tens, ones and composition with sticks pictures', () => {
    const s = skill({
      generator: 'num.place',
      params: { numbers: [10, 99], asks: ['tens', 'ones', 'compose'] },
    });
    for (const item of itemsOf(s)) {
      for (const problem of generated(s, item)) {
        expect(problem.kind).toBe('equation');
        if (problem.kind !== 'equation' || problem.picture?.kind !== 'sticks') continue;
        const n = problem.picture.tens * 10 + problem.picture.ones;
        const answer = numbers(problem)[0]!;
        if (item === 'place:compose') {
          expect(problem.right).toEqual(BLANK);
          expect(opNumbers(problem.left)).toEqual([
            problem.picture.tens * 10,
            problem.picture.ones,
          ]);
          expect(answer).toBe(n);
        } else if (item === 'place:tens') {
          expect(problem.left).toEqual(num(n));
          expect(answer).toBe(problem.picture.tens);
        } else {
          expect(problem.left).toEqual(num(n));
          expect(answer).toBe(problem.picture.ones);
        }
      }
    }
  });

  it('add.fact, sub.fact and add.missing match their exact fact items', () => {
    const add = skill({
      generator: 'add.fact',
      params: { addends: [0, 10], sumMax: 20, crossing: 'allowed' },
    });
    const sub = skill({
      generator: 'sub.fact',
      params: { subtrahends: [0, 10], differences: [0, 10], minuendMax: 20, crossing: 'allowed' },
    });
    const missing = skill({
      generator: 'add.missing',
      params: { known: [0, 10], missing: [0, 10], sumMax: 20, position: 'both' },
    });
    expect(itemsOf(add)).toHaveLength(121);
    expect(itemsOf(sub)).toHaveLength(121);
    for (const [s, item] of [
      ...itemsOf(add).map((item) => [add, item] as const),
      ...itemsOf(sub).map((item) => [sub, item] as const),
      ...itemsOf(missing).map((item) => [missing, item] as const),
    ]) {
      for (const problem of generated(s, item, 4)) {
        const parsed = parseItemId(item)!;
        const answer = numbers(problem)[0]!;
        if (parsed.kind === 'add') {
          expect(problem).toMatchObject({
            kind: 'equation',
            left: op('add', num(parsed.a), num(parsed.b)),
            right: BLANK,
          });
          expect(answer).toBe(parsed.sum);
        } else if (s.generator === 'sub.fact' && parsed.kind === 'sub') {
          expect(problem).toMatchObject({
            kind: 'equation',
            left: op('sub', num(parsed.minuend), num(parsed.subtrahend)),
            right: BLANK,
          });
          expect(answer).toBe(parsed.difference);
        } else if (parsed.kind === 'sub') {
          expect(answer).toBe(parsed.difference);
        }
      }
    }
  });

  it('addsub.2d buckets draw operands with the requested shape and carry/borrow state', () => {
    const s = skill({
      generator: 'addsub.2d',
      params: {
        operators: ['add', 'sub'],
        shapes: ['tens', '2d1d', '2d2d'],
        twoDigit: [10, 99],
        crossing: 'allowed',
        resultMax: 100,
      },
    });
    for (const item of itemsOf(s)) {
      for (const problem of generated(s, item, 40)) {
        expect(problem.kind).toBe('equation');
        if (problem.kind !== 'equation' || problem.left.kind !== 'op') continue;
        const [a, b] = opNumbers(problem.left)!;
        const [, bucket] = item.split(':') as [string, string];
        const [shape, state] = bucket.split('-') as [string, string];
        if (shape === 'tens') expect([a % 10, b % 10]).toEqual([0, 0]);
        if (shape === '2d1d') expect(b).toBeLessThan(10);
        if (shape === '2d2d') expect(b).toBeGreaterThanOrEqual(10);
        if (problem.left.op === 'add') {
          expect(a + b).toBeLessThanOrEqual(100);
          expect(addCrossesTen(a, b)).toBe(state === 'carry');
        } else {
          expect(a).toBeGreaterThanOrEqual(b);
          expect(subCrossesTen(a, b)).toBe(state === 'borrow');
        }
      }
    }
    const impossible = skill({
      generator: 'addsub.2d',
      params: {
        operators: ['add'],
        shapes: ['tens'],
        twoDigit: [10, 90],
        crossing: 'required',
        resultMax: 100,
      },
    });
    expect(() => problemFor(impossible, 'add2d:tens-carry', sources('impossible'))).toThrow(
      /cannot practise/,
    );
  });
});

describe('additive word templates', () => {
  const v = (name: string) => ({ kind: 'var' as const, name });
  const templates: WordTemplate[] = [
    {
      id: 'test.add-to',
      family: 'add-to',
      textKey: 'word.add-to.test',
      vars: { start: { kind: 'int', min: 2, max: 8 }, change: { kind: 'int', min: 1, max: 7 } },
      model: {
        kind: 'value',
        expr: { kind: 'op', op: 'add', left: v('start'), right: v('change') },
      },
      operation: 'add',
    },
    {
      id: 'test.take-from',
      family: 'take-from',
      textKey: 'word.take-from.test',
      vars: { start: { kind: 'int', min: 8, max: 15 }, change: { kind: 'int', min: 1, max: 7 } },
      model: {
        kind: 'value',
        expr: { kind: 'op', op: 'sub', left: v('start'), right: v('change') },
      },
      operation: 'sub',
    },
    {
      id: 'test.more-than',
      family: 'more-than',
      textKey: 'word.more-than.test',
      vars: { base: { kind: 'int', min: 2, max: 8 }, more: { kind: 'int', min: 1, max: 7 } },
      model: {
        kind: 'value',
        expr: { kind: 'op', op: 'add', left: v('base'), right: v('more') },
      },
      operation: 'add',
    },
    {
      id: 'test.fewer-than',
      family: 'fewer-than',
      textKey: 'word.fewer-than.test',
      vars: { larger: { kind: 'int', min: 8, max: 15 }, fewer: { kind: 'int', min: 1, max: 7 } },
      model: {
        kind: 'value',
        expr: { kind: 'op', op: 'sub', left: v('larger'), right: v('fewer') },
      },
      operation: 'sub',
    },
    {
      id: 'test.two-step-additive',
      family: 'two-step',
      textKey: 'word.two-step-additive.test',
      vars: {
        start: { kind: 'int', min: 5, max: 10 },
        gained: { kind: 'int', min: 1, max: 5 },
        lost: { kind: 'int', min: 1, max: 4 },
      },
      model: {
        kind: 'value',
        expr: {
          kind: 'op',
          op: 'sub',
          left: { kind: 'op', op: 'add', left: v('start'), right: v('gained') },
          right: v('lost'),
        },
      },
      operation: null,
    },
  ];

  it('generates additive word families with correct items, models and answers', () => {
    const content = { wordTemplates: templates, wordLists: data.wordLists };
    const s = skill({ generator: 'word', params: { templates: templates.map((t) => t.id) } });
    expect(skillItems(s, (id) => templates.find((t) => t.id === id)?.family ?? null)).toEqual([
      'word:add-to',
      'word:fewer-than',
      'word:more-than',
      'word:take-from',
      'word:two-step',
    ]);
    for (const template of templates) {
      for (const seed of range(1, 40)) {
        const problem = problemFor(
          s,
          `word:${template.family}`,
          sources(`${template.id}-${seed}`, content),
        );
        expect(problem.kind).toBe('word');
        if (problem.kind !== 'word' || problem.model.kind !== 'equation') continue;
        expect(problem.operation).toBe(template.operation);
        if (template.operation !== null) {
          expect(problem.model.left).toMatchObject({ kind: 'op', op: template.operation });
        }
        const expected = expectedAnswer(problem);
        expect(expected.ok).toBe(true);
        if (!expected.ok) continue;
        expect(traceOracle(problem, 'answer')).toEqual(expected.value);
      }
    }
  });
});

describe('trace oracle support for grades 1-2 shapes', () => {
  const asRound = (problem: Problem): ProblemRoundView =>
    ({
      problem: { problem, step: 'answer' },
    }) as ProblemRoundView;

  it('answers new equation, compare and picture shapes independently', () => {
    const cases: [Problem, number | 'gt'][] = [
      [{ kind: 'equation', left: BLANK, right: num(7), picture: { kind: 'dots', count: 7 } }, 7],
      [
        {
          kind: 'equation',
          left: num(47),
          right: op('add', op('mul', BLANK, num(10)), num(7)),
          picture: { kind: 'sticks', tens: 4, ones: 7 },
        },
        4,
      ],
      [{ kind: 'equation', left: op('sub', num(13), num(6)), right: BLANK }, 7],
      [{ kind: 'compare', left: num(12), right: num(9) }, 'gt'],
    ];
    for (const [problem, answer] of cases) {
      const got = traceOracle(problem, 'answer');
      if (answer === 'gt') expect(got).toEqual({ kind: 'relation', relation: 'gt' });
      else expect(got).toEqual({ kind: 'number', value: answer });
      expect(wrongAnswer(asRound(problem))).not.toEqual(got);
    }
  });
});

describe('additive distractors and commuted credit', () => {
  const optionValues = (problem: Problem) =>
    choicesFor(problem, 4, createPrng('additive-options')).map((o) =>
      o.kind === 'number' ? o.value : NaN,
    );

  it('offers signature additive mistakes', () => {
    expect(
      optionValues({ kind: 'equation', left: op('add', num(34), num(8)), right: BLANK }),
    ).toContain(32);
    expect(
      optionValues({ kind: 'equation', left: op('sub', num(52), num(27)), right: BLANK }),
    ).toContain(35);
    expect(
      optionValues({ kind: 'equation', left: op('add', num(7), BLANK), right: num(10) }),
    ).toContain(10);
    expect(
      optionValues({
        kind: 'equation',
        left: BLANK,
        right: num(7),
        picture: { kind: 'dots', count: 7 },
      }),
    ).toEqual(expect.arrayContaining([6, 7]));
    expect(
      optionValues({
        kind: 'equation',
        left: op('add', num(40), num(7)),
        right: BLANK,
        picture: { kind: 'sticks', tens: 4, ones: 7 },
      }),
    ).toContain(74);
  });

  it('reschedules a known commuted addition fact without promoting it', () => {
    const balance = data.balance;
    const state = initialProfileState({ dailyGoal: 30, arena: true });
    state.day = 10;
    const known: ItemState = {
      box: 3,
      due: 9,
      seen: 4,
      correct: 4,
      recent: ['ok', 'ok', 'fast'],
      lastDay: 7,
    };
    state.items = { 'add:5+3': structuredClone(known) };
    const ctx = { state, content: { data: { balance } }, emit: () => {} } as unknown as Ctx;
    expect(isDue(state.items['add:5+3'], 10)).toBe(true);
    creditItem(ctx, 'add:3+5', 'fast');
    expect(state.items['add:5+3']).toEqual({ ...known, due: 14, lastDay: 10 });
    expect(state.items['add:3+5']).toMatchObject({ box: 1, seen: 1, correct: 1 });
  });
});
