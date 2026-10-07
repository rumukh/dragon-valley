/**
 * The picture behind a problem beyond the small table (src/app/math/model.ts): which model each
 * problem gets, where one kind ends and the next begins, the order an expression is worked out
 * in, and the worked lines of the split models.
 */
import { describe, expect, it } from 'vitest';
import { BLANK, group, num, op } from '../../../src/rules/contract';
import type { Expr, Problem } from '../../../src/rules/contract';
import { MAX_ORDER_STEPS, modelFor, splitLine, withoutAnswer } from '../../../src/app/math/model';
import type { ProblemModel } from '../../../src/app/math/model';

const eq = (left: Expr): Problem => ({ kind: 'equation', left, right: BLANK });
const mul = (a: number, b: number): Problem => eq(op('mul', num(a), num(b)));
const div = (a: number, b: number): Problem => eq(op('div', num(a), num(b)));
const kindOf = (problem: Problem): ProblemModel['kind'] | null => modelFor(problem)?.kind ?? null;

describe('the small tables keep their pictures to count', () => {
  it('draws products up to 10 · 10 as arrays and table divisions as groups', () => {
    expect(modelFor(mul(10, 10))).toEqual({ kind: 'array', rows: 10, columns: 10 });
    expect(modelFor(mul(7, 10))).toEqual({ kind: 'array', rows: 7, columns: 10 });
    expect(modelFor(mul(10, 2))).toEqual({ kind: 'array', rows: 10, columns: 2 });
    expect(modelFor(div(72, 8))).toEqual({ kind: 'groups', total: 72, size: 8 });
    expect(modelFor(div(56, 7))).toEqual({ kind: 'groups', total: 56, size: 7 });
  });
});

describe('place-shift: · 10, · 100, : 10 and : 100', () => {
  it('moves the digits of the other factor, whichever side it is on', () => {
    const shift = { kind: 'place-shift', op: 'mul', from: 34, to: 340, places: 1 };
    expect(modelFor(mul(34, 10))).toEqual({ ...shift, left: 34, right: 10 });
    expect(modelFor(mul(10, 34))).toEqual({ ...shift, left: 10, right: 34 });
    expect(modelFor(mul(11, 10))).toMatchObject({ kind: 'place-shift', from: 11, to: 110 });
  });

  it('moves them two places for 100, up to the thousands', () => {
    expect(modelFor(mul(7, 100))).toEqual({
      kind: 'place-shift',
      op: 'mul',
      left: 7,
      right: 100,
      from: 7,
      to: 700,
      places: 2,
    });
    expect(modelFor(mul(100, 7))).toMatchObject({ from: 7, to: 700, places: 2 });
    expect(modelFor(mul(1, 100))).toMatchObject({ from: 1, to: 100, places: 2 });
    expect(modelFor(mul(10, 100))).toMatchObject({ from: 10, to: 1000, places: 2 });
  });

  it('moves the digits back for every division by 10 or 100, the table facts too', () => {
    expect(modelFor(div(340, 10))).toEqual({
      kind: 'place-shift',
      op: 'div',
      left: 340,
      right: 10,
      from: 340,
      to: 34,
      places: 1,
    });
    expect(modelFor(div(700, 100))).toMatchObject({ op: 'div', from: 700, to: 7, places: 2 });
    expect(modelFor(div(70, 10))).toMatchObject({ kind: 'place-shift', from: 70, to: 7 });
  });

  it('has nothing to move for zero (0 : 10 is a rule fact instead)', () => {
    expect(modelFor(mul(0, 100))).toBeNull();
    expect(modelFor(div(0, 10))).toMatchObject({ kind: 'rule', rule: 'zero-shared' });
  });
});

describe('tens-groups: round tens times a one-digit number', () => {
  it('counts the round tens as tens, in either order', () => {
    expect(modelFor(mul(30, 3))).toEqual({
      kind: 'tens-groups',
      left: 30,
      right: 3,
      tens: 3,
      times: 3,
    });
    expect(modelFor(mul(3, 30))).toEqual({
      kind: 'tens-groups',
      left: 3,
      right: 30,
      tens: 3,
      times: 3,
    });
    expect(modelFor(mul(20, 2))).toMatchObject({ tens: 2, times: 2 });
    expect(modelFor(mul(90, 9))).toMatchObject({ tens: 9, times: 9 });
  });
});

describe('split-mul: a two-digit times a one-digit number', () => {
  it('splits the two-digit factor into tens and ones, in either order, carrying or not', () => {
    expect(modelFor(mul(11, 6))).toEqual({
      kind: 'split-mul',
      left: 11,
      right: 6,
      tens: 10,
      ones: 1,
      times: 6,
    });
    expect(modelFor(mul(38, 8))).toMatchObject({ tens: 30, ones: 8, times: 8 });
    expect(modelFor(mul(8, 38))).toMatchObject({ left: 8, right: 38, tens: 30, ones: 8 });
    expect(modelFor(mul(23, 3))).toMatchObject({ kind: 'split-mul', tens: 20, ones: 3 });
    expect(modelFor(mul(99, 9))).toMatchObject({ tens: 90, ones: 9, times: 9 });
  });

  it('writes the textbook line, and leaves the last step before the child answers', () => {
    const model = modelFor(mul(38, 8));
    if (model?.kind !== 'split-mul') throw new Error('expected split-mul');
    expect(splitLine(model)).toEqual([
      op('mul', num(38), num(8)),
      op('add', op('mul', num(30), num(8)), op('mul', num(8), num(8))),
      op('add', num(240), num(64)),
      num(304),
    ]);
    expect(withoutAnswer(splitLine(model)).at(-1)).toEqual(BLANK);
    const swapped = modelFor(mul(8, 38));
    if (swapped?.kind !== 'split-mul') throw new Error('expected split-mul');
    expect(splitLine(swapped)[1]).toEqual(
      op('add', op('mul', num(8), num(30)), op('mul', num(8), num(8))),
    );
  });

  it('draws nothing for two two-digit factors', () => {
    expect(modelFor(mul(12, 12))).toBeNull();
    expect(modelFor(mul(23, 15))).toBeNull();
  });
});

describe('split-div: a two-digit number divided by a one-digit number', () => {
  it('splits at the largest multiple of ten times the divisor', () => {
    expect(modelFor(div(96, 8))).toEqual({
      kind: 'split-div',
      dividend: 96,
      divisor: 8,
      head: 80,
      rest: 16,
    });
    expect(modelFor(div(48, 3))).toMatchObject({ head: 30, rest: 18 });
    expect(modelFor(div(69, 3))).toMatchObject({ head: 60, rest: 9 });
    expect(modelFor(div(99, 9))).toMatchObject({ head: 90, rest: 9 });
  });

  it('starts at a quotient of 10, and needs no rest when the split is exact', () => {
    expect(modelFor(div(80, 8))).toMatchObject({ kind: 'split-div', head: 80, rest: 0 });
    expect(modelFor(div(40, 2))).toMatchObject({ kind: 'split-div', head: 40, rest: 0 });
    expect(kindOf(div(72, 8))).toBe('groups');
  });

  it('writes the textbook line, or just the division when nothing is left', () => {
    const model = modelFor(div(96, 8));
    if (model?.kind !== 'split-div') throw new Error('expected split-div');
    expect(splitLine(model)).toEqual([
      op('div', num(96), num(8)),
      op('add', op('div', num(80), num(8)), op('div', num(16), num(8))),
      op('add', num(10), num(2)),
      num(12),
    ]);
    const exact = modelFor(div(80, 8));
    if (exact?.kind !== 'split-div') throw new Error('expected split-div');
    expect(splitLine(exact)).toEqual([op('div', num(80), num(8)), num(10)]);
  });
});

describe('order-steps: an expression worked out one operation at a time', () => {
  it('does · and : before + and −, and takes the result into the next step', () => {
    const model = modelFor(eq(op('sub', op('mul', num(4), num(6)), num(8))));
    expect(model).toEqual({
      kind: 'order-steps',
      steps: [
        { expr: op('sub', op('mul', num(4), num(6)), num(8)), path: ['left'], value: 24 },
        { expr: op('sub', num(24), num(8)), path: [], value: 16 },
      ],
      result: 16,
    });
  });

  it('does brackets first, and the brackets go with their operation', () => {
    const model = modelFor(eq(op('div', group(op('add', num(16), num(8))), num(3))));
    if (model?.kind !== 'order-steps') throw new Error('expected order-steps');
    expect(model.steps.map((step) => step.path)).toEqual([['left', 'inner'], []]);
    expect(model.steps[1]!.expr).toEqual(op('div', num(24), num(3)));
    expect(model.result).toBe(8);
  });

  it('follows Golem Orders: one operation per step, from left to right within a rank', () => {
    const paths = (left: Expr): unknown => {
      const model = modelFor(eq(left));
      return model?.kind === 'order-steps' ? model.steps.map((step) => step.path) : model;
    };
    // 2 · 3 + 4 · 5: both products before the sum, the left one first.
    expect(paths(op('add', op('mul', num(2), num(3)), op('mul', num(4), num(5))))).toEqual([
      ['left'],
      ['right'],
      [],
    ]);
    // 12 + 4 · 6 − 8 is (12 + 4 · 6) − 8: the product, then from the left.
    expect(paths(op('sub', op('add', num(12), op('mul', num(4), num(6))), num(8)))).toEqual([
      ['left', 'right'],
      ['left'],
      [],
    ]);
    // 60 − (12 + 8) : 4: the brackets, the division, then the subtraction.
    expect(paths(op('sub', num(60), op('div', group(op('add', num(12), num(8))), num(4))))).toEqual(
      [['right', 'left', 'inner'], ['right'], []],
    );
  });

  it('needs two operations, and no more than fit the picture', () => {
    expect(modelFor(eq(op('add', num(2), num(3))))).toBeNull();
    let long: Expr = num(1);
    for (let index = 0; index <= MAX_ORDER_STEPS; index++) long = op('add', long, num(1));
    expect(modelFor(eq(long))).toBeNull();
  });
});

describe('stories', () => {
  it('show the picture of their arithmetic', () => {
    const story: Problem = {
      kind: 'word',
      template: 'word.equal-groups.tickets',
      vars: {},
      model: { kind: 'equation', left: op('mul', num(38), num(8)), right: BLANK },
      operation: null,
    };
    expect(kindOf(story)).toBe('split-mul');
  });
});
