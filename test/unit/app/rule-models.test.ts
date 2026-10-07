/**
 * The rule facts' pictures (src/app/math/model.ts `rule`): a number times 0 or 1, divided by 1 or
 * by itself, and 0 divided by a number, in either order and as missing factors, get their rule;
 * every other small-table fact keeps its array or groups.
 */
import { describe, expect, it } from 'vitest';
import { BLANK, num, op } from '../../../src/rules/contract';
import type { Expr, Problem } from '../../../src/rules/contract';
import { modelFor } from '../../../src/app/math/model';

const eq = (left: Expr, right: Expr = BLANK): Problem => ({ kind: 'equation', left, right });
const mul = (a: number, b: number): Problem => eq(op('mul', num(a), num(b)));
const div = (a: number, b: number): Problem => eq(op('div', num(a), num(b)));

describe('rule facts', () => {
  it('draw a number times 0 and 0 times a number', () => {
    expect(modelFor(mul(4, 0))).toEqual({
      kind: 'rule',
      rule: 'times-zero',
      op: 'mul',
      left: 4,
      right: 0,
      result: 0,
      unknown: 'result',
    });
    expect(modelFor(mul(0, 4))).toEqual({
      kind: 'rule',
      rule: 'zero-times',
      op: 'mul',
      left: 0,
      right: 4,
      result: 0,
      unknown: 'result',
    });
    expect(modelFor(mul(0, 0))).toMatchObject({ rule: 'zero-times', result: 0 });
    expect(modelFor(mul(10, 0))).toMatchObject({ rule: 'times-zero', left: 10 });
    // 0 comes before 1: 0 · 1 and 1 · 0 are about 0.
    expect(modelFor(mul(0, 1))).toMatchObject({ rule: 'zero-times' });
    expect(modelFor(mul(1, 0))).toMatchObject({ rule: 'times-zero' });
  });

  it('draw a number times 1, in either order', () => {
    expect(modelFor(mul(1, 7))).toEqual({
      kind: 'rule',
      rule: 'one-times',
      op: 'mul',
      left: 1,
      right: 7,
      result: 7,
      unknown: 'result',
    });
    expect(modelFor(mul(7, 1))).toMatchObject({ rule: 'times-one', result: 7 });
    expect(modelFor(mul(1, 10))).toMatchObject({ rule: 'one-times', result: 10 });
    expect(modelFor(mul(1, 1))).toMatchObject({ rule: 'times-one', result: 1 });
  });

  it('draw a division by 1, of 0 and by itself', () => {
    expect(modelFor(div(7, 1))).toEqual({
      kind: 'rule',
      rule: 'divide-one',
      op: 'div',
      left: 7,
      right: 1,
      result: 7,
      unknown: 'result',
    });
    expect(modelFor(div(0, 5))).toMatchObject({ rule: 'zero-shared', result: 0 });
    expect(modelFor(div(0, 1))).toMatchObject({ rule: 'zero-shared' });
    expect(modelFor(div(6, 6))).toMatchObject({ rule: 'divide-self', result: 1 });
    expect(modelFor(div(10, 10))).toMatchObject({ rule: 'divide-self', result: 1 });
    expect(modelFor(div(10, 1))).toMatchObject({ rule: 'divide-one', result: 10 });
    expect(modelFor(div(1, 1))).toMatchObject({ rule: 'divide-one', result: 1 });
  });

  it('draw a missing factor that makes a rule fact, keeping the unknown in its place', () => {
    expect(modelFor(eq(op('mul', BLANK, num(5)), num(0)))).toMatchObject({
      rule: 'zero-times',
      left: 0,
      right: 5,
      result: 0,
      unknown: 'left',
    });
    expect(modelFor(eq(op('mul', num(5), BLANK), num(0)))).toMatchObject({
      rule: 'times-zero',
      unknown: 'right',
    });
    expect(modelFor(eq(op('mul', BLANK, num(7)), num(7)))).toMatchObject({
      rule: 'one-times',
      left: 1,
      unknown: 'left',
    });
    expect(modelFor(eq(op('mul', BLANK, num(1)), num(7)))).toMatchObject({
      rule: 'times-one',
      left: 7,
      unknown: 'left',
    });
  });

  it('leave the rest of the small tables to arrays and groups, and beyond them to strategies', () => {
    expect(modelFor(mul(10, 10))).toEqual({ kind: 'array', rows: 10, columns: 10 });
    expect(modelFor(mul(2, 3))).toEqual({ kind: 'array', rows: 2, columns: 3 });
    expect(modelFor(div(12, 3))).toEqual({ kind: 'groups', total: 12, size: 3 });
    expect(modelFor(eq(op('mul', BLANK, num(6)), num(42)))).toEqual({
      kind: 'groups',
      total: 42,
      size: 6,
    });
    expect(modelFor(mul(1, 100))).toMatchObject({ kind: 'place-shift' });
    expect(modelFor(div(100, 100))).toMatchObject({ kind: 'place-shift' });
    expect(modelFor(mul(0, 100))).toBeNull();
  });
});
