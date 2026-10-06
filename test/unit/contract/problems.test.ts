/**
 * Problems, answers, item IDs and notation. Expected values are written out by hand from the
 * Czech 3rd-grade conventions (docs/curriculum.md), not derived from the code under test.
 */
import { describe, expect, it } from 'vitest';
import { requireValue } from '@aegis/runtime';
import {
  BLANK,
  allDivFactIds,
  allMulFactIds,
  bucketId,
  commutedId,
  divFactId,
  evaluate,
  expectedAnswer,
  formatAnswer,
  formatFace,
  formatProblem,
  group,
  mulFactId,
  num,
  op,
  parseItemId,
  problemSchema,
} from '../../../src/rules/contract';
import type { Problem } from '../../../src/rules/contract';

const answer = (problem: Problem) => requireValue(expectedAnswer(problem));

describe('expected answers', () => {
  it('solves fact recall, missing factors and missing dividends', () => {
    expect(answer({ kind: 'equation', left: op('mul', num(7), num(8)), right: BLANK })).toEqual({
      kind: 'number',
      value: 56,
    });
    expect(answer({ kind: 'equation', left: op('mul', BLANK, num(6)), right: num(42) })).toEqual({
      kind: 'number',
      value: 7,
    });
    expect(answer({ kind: 'equation', left: op('div', BLANK, num(7)), right: num(8) })).toEqual({
      kind: 'number',
      value: 56,
    });
    expect(answer({ kind: 'equation', left: num(48), right: op('mul', num(4), BLANK) })).toEqual({
      kind: 'number',
      value: 12,
    });
  });

  it('applies brackets and precedence: (2 + 3) · 4 = 20 but 2 + 3 · 4 = 14', () => {
    const bracketed = op('mul', group(op('add', num(2), num(3))), num(4));
    const plain = op('add', num(2), op('mul', num(3), num(4)));
    expect(answer({ kind: 'equation', left: bracketed, right: BLANK })).toEqual({
      kind: 'number',
      value: 20,
    });
    expect(answer({ kind: 'equation', left: plain, right: BLANK })).toEqual({
      kind: 'number',
      value: 14,
    });
  });

  it('divides with a remainder smaller than the divisor: 23 : 5 = 4 r 3', () => {
    expect(answer({ kind: 'divrem', dividend: 23, divisor: 5 })).toEqual({
      kind: 'remainder',
      quotient: 4,
      remainder: 3,
    });
    expect(answer({ kind: 'divrem', dividend: 67, divisor: 9 })).toEqual({
      kind: 'remainder',
      quotient: 7,
      remainder: 4,
    });
  });

  it('compares expressions: 7 · 8 > 50 and 6 · 7 < 5 · 9', () => {
    expect(answer({ kind: 'compare', left: op('mul', num(7), num(8)), right: num(50) })).toEqual({
      kind: 'relation',
      relation: 'gt',
    });
    expect(
      answer({
        kind: 'compare',
        left: op('mul', num(6), num(7)),
        right: op('mul', num(5), num(9)),
      }),
    ).toEqual({ kind: 'relation', relation: 'lt' });
  });

  it('names terms: the product of 6 · 7 = 42 and the remainder of 23 : 5 = 4 r 3', () => {
    expect(
      answer({
        kind: 'term',
        sentence: { op: 'mul', left: 6, right: 7, result: 42, remainder: null },
        highlight: 'result',
      }),
    ).toEqual({ kind: 'term', term: 'product' });
    expect(
      answer({
        kind: 'term',
        sentence: { op: 'div', left: 23, right: 5, result: 4, remainder: 3 },
        highlight: 'right',
      }),
    ).toEqual({ kind: 'term', term: 'divisor' });
  });

  it('asks a word problem for its operation first, then its model answer', () => {
    const word: Problem = {
      kind: 'word',
      template: 'word.times-as-many.apples',
      vars: { name: 'word.name.anna', count: 4, times: 3 },
      model: { kind: 'equation', left: op('mul', num(4), num(3)), right: BLANK },
      operation: 'mul',
    };
    expect(requireValue(expectedAnswer(word, 'operation'))).toEqual({
      kind: 'operation',
      operation: 'mul',
    });
    expect(answer(word)).toEqual({ kind: 'number', value: 12 });
  });

  it('rejects problems without a unique non-negative integer answer', () => {
    const invalid: Problem[] = [
      { kind: 'equation', left: op('mul', BLANK, num(0)), right: num(0) },
      { kind: 'equation', left: op('mul', num(7), num(8)), right: num(56) },
      { kind: 'equation', left: op('sub', num(3), num(5)), right: BLANK },
      { kind: 'equation', left: op('div', num(7), num(2)), right: BLANK },
      { kind: 'equation', left: op('mul', BLANK, num(5)), right: num(12) },
      { kind: 'equation', left: op('div', num(0), BLANK), right: num(5) },
      { kind: 'equation', left: op('div', num(0), op('sub', BLANK, num(3))), right: num(2) },
      { kind: 'compare', left: BLANK, right: num(3) },
      {
        kind: 'term',
        sentence: { op: 'mul', left: 6, right: 7, result: 41, remainder: null },
        highlight: 'result',
      },
    ];
    for (const problem of invalid) {
      expect(expectedAnswer(problem).ok, JSON.stringify(problem)).toBe(false);
    }
  });

  it('evaluates exact, non-negative integers only', () => {
    expect(evaluate(op('div', num(56), num(7)))).toBe(8);
    expect(evaluate(op('div', num(7), num(0)))).toBeNull();
    expect(evaluate(op('sub', num(2), num(9)))).toBeNull();
  });

  it('round-trips problems through the schema unchanged', () => {
    const problem: Problem = { kind: 'equation', left: op('mul', BLANK, num(6)), right: num(42) };
    expect(requireValue(problemSchema.parse(JSON.parse(JSON.stringify(problem))))).toEqual(problem);
    expect(
      problemSchema.parse({ kind: 'equation', left: { kind: 'num', value: -1 }, right: BLANK }).ok,
    ).toBe(false);
  });
});

describe('item IDs', () => {
  it('has 121 multiplication facts and 110 division facts, all parseable and unique', () => {
    const mul = allMulFactIds();
    const div = allDivFactIds();
    expect(mul).toHaveLength(121);
    expect(div).toHaveLength(110);
    expect(new Set([...mul, ...div]).size).toBe(231);
    for (const id of [...mul, ...div]) expect(parseItemId(id), id).not.toBeNull();
  });

  it('formats and parses facts and buckets', () => {
    expect(mulFactId(7, 8)).toBe('mul:7x8');
    expect(divFactId(56, 7)).toBe('div:56:7');
    expect(parseItemId('div:56:7')).toEqual({ kind: 'div', dividend: 56, divisor: 7, quotient: 8 });
    expect(parseItemId('mul:10x3')).toEqual({ kind: 'mul', a: 10, b: 3, product: 30 });
    expect(bucketId('mul2d1d', 'carry')).toBe('mul2d1d:carry');
    expect(parseItemId('rem:d7')).toEqual({ kind: 'bucket', family: 'rem', bucket: 'd7' });
    expect(commutedId('mul:7x8')).toBe('mul:8x7');
    expect(commutedId('mul:6x6')).toBeNull();
  });

  it('rejects malformed and impossible item IDs', () => {
    for (const id of [
      'mul:11x2',
      'mul:7*8',
      'div:57:7',
      'div:56:0',
      'div:110:10',
      'div:056:7',
      'mul:x',
      'Rem:d7',
      'rem:',
    ]) {
      expect(parseItemId(id), id).toBeNull();
    }
    expect(() => mulFactId(11, 2)).toThrow();
    expect(() => divFactId(57, 7)).toThrow();
  });
});

describe('notation', () => {
  const fact = (a: number, b: number): Problem => ({
    kind: 'equation',
    left: op('mul', num(a), num(b)),
    right: BLANK,
  });

  it('renders Czech school notation by default', () => {
    expect(formatProblem(fact(3, 4))).toBe('3 · 4 = ?');
    expect(
      formatProblem({ kind: 'equation', left: op('div', num(12), num(3)), right: BLANK }),
    ).toBe('12 : 3 = ?');
    expect(formatProblem({ kind: 'divrem', dividend: 23, divisor: 5 })).toBe('23 : 5 = ? r ?');
    expect(formatAnswer({ kind: 'remainder', quotient: 4, remainder: 3 })).toBe('4 r 3');
  });

  it('renders international notation on request', () => {
    expect(formatProblem(fact(3, 4), 'international')).toBe('3 × 4 = ?');
    expect(formatProblem({ kind: 'divrem', dividend: 23, divisor: 5 }, 'international')).toBe(
      '23 ÷ 5 = ? R ?',
    );
  });

  it('shows brackets only where the tree needs them or where the author grouped', () => {
    expect(
      formatProblem({
        kind: 'equation',
        left: op('add', num(2), op('mul', num(3), num(4))),
        right: BLANK,
      }),
    ).toBe('2 + 3 · 4 = ?');
    expect(
      formatProblem({
        kind: 'equation',
        left: op('mul', op('add', num(2), num(3)), num(4)),
        right: BLANK,
      }),
    ).toBe('(2 + 3) · 4 = ?');
    expect(
      formatProblem({
        kind: 'equation',
        left: op('sub', num(8), op('sub', num(3), num(1))),
        right: BLANK,
      }),
    ).toBe('8 − (3 − 1) = ?');
    expect(
      formatProblem({
        kind: 'equation',
        left: op('add', group(op('mul', num(2), num(3))), num(4)),
        right: BLANK,
      }),
    ).toBe('(2 · 3) + 4 = ?');
  });

  it('renders minigame card faces in either notation', () => {
    expect(formatFace({ kind: 'expr', expr: op('mul', num(7), num(8)) })).toBe('7 · 8');
    expect(formatFace({ kind: 'expr', expr: op('div', num(56), num(7)) }, 'international')).toBe(
      '56 ÷ 7',
    );
    expect(formatFace({ kind: 'answer', answer: { kind: 'number', value: 56 } })).toBe('56');
    expect(
      formatFace({
        kind: 'sentence',
        sentence: { op: 'div', left: 23, right: 5, result: 4, remainder: 3 },
        highlight: 'remainder',
      }),
    ).toBe('23 : 5 = 4 r 3');
    expect(
      formatFace({
        kind: 'sentence',
        sentence: { op: 'mul', left: 6, right: 7, result: 42, remainder: null },
        highlight: null,
      }),
    ).toBe('6 · 7 = 42');
  });
});
