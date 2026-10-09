/**
 * Problems in both notations, and read-aloud words. Expected strings are written out by hand
 * from the approved notation table (docs/plan.md §2.10), not derived from the code under test.
 */
import { describe, expect, it } from 'vitest';
import {
  formatAnswer,
  formatProblem,
  formatSolved,
  problemTokens,
  SLOT_SYMBOL,
} from '../../../src/app/math/notation';
import { BLANK, group, num, op } from '../../../src/rules/contract';
import type { Problem, TermProblem } from '../../../src/rules/contract';
import { numberToWords } from '../../../src/app/speech/numbers';
import { speakAnswer, speakProblem, speakSolved } from '../../../src/app/speech/verbalizer';

const fact: Problem = { kind: 'equation', left: op('mul', num(7), num(8)), right: BLANK };
const missingFactor: Problem = {
  kind: 'equation',
  left: op('mul', BLANK, num(6)),
  right: num(42),
};
const division: Problem = { kind: 'equation', left: op('div', num(56), num(7)), right: BLANK };
const remainder: Problem = { kind: 'divrem', dividend: 23, divisor: 5 };
const brackets: Problem = {
  kind: 'equation',
  left: op('mul', group(op('add', num(2), num(3))), num(4)),
  right: BLANK,
};
const implicit: Problem = {
  kind: 'equation',
  left: op('sub', num(8), op('sub', num(3), num(1))),
  right: BLANK,
};
const compare: Problem = { kind: 'compare', left: op('mul', num(7), num(8)), right: num(50) };
const product: TermProblem = {
  kind: 'term',
  sentence: { op: 'mul', left: 6, right: 7, result: 42, remainder: null },
  highlight: 'result',
};
const square: TermProblem = {
  kind: 'term',
  sentence: { op: 'mul', left: 4, right: 4, result: 16, remainder: null },
  highlight: 'right',
};
const leftover: TermProblem = {
  kind: 'term',
  sentence: { op: 'div', left: 23, right: 5, result: 4, remainder: 3 },
  highlight: 'remainder',
};
const story: Problem = {
  kind: 'word',
  template: 'word.baskets',
  vars: { baskets: 3, apples: 4 },
  model: { kind: 'equation', left: op('mul', num(3), num(4)), right: BLANK },
  operation: 'mul',
};
const leftoverStory: Problem = {
  kind: 'word',
  template: 'word.leftover.bags',
  vars: { total: 23, size: 5 },
  model: { kind: 'divrem', dividend: 23, divisor: 5 },
  operation: 'div',
};
describe('notation', () => {
  it('writes Czech school notation by default', () => {
    expect(formatProblem(fact)).toBe('7 · 8 = ?');
    expect(formatProblem(missingFactor)).toBe('? · 6 = 42');
    expect(formatProblem(division)).toBe('56 : 7 = ?');
    expect(formatProblem(remainder)).toBe('23 : 5 = ? r ?');
    expect(formatSolved(remainder, { kind: 'remainder', quotient: 4, remainder: 3 })).toBe(
      '23 : 5 = 4 r 3',
    );
  });

  it('writes international notation on request', () => {
    expect(formatProblem(fact, 'international')).toBe('7 × 8 = ?');
    expect(formatProblem(division, 'international')).toBe('56 ÷ 7 = ?');
    expect(formatProblem(remainder, 'international')).toBe('23 ÷ 5 = ? R ?');
    expect(formatAnswer({ kind: 'remainder', quotient: 4, remainder: 3 }, 'international')).toBe(
      '4 R 3',
    );
  });

  it('shows brackets the tree needs, both explicit and implied', () => {
    expect(formatProblem(brackets)).toBe('(2 + 3) · 4 = ?');
    expect(formatProblem(implicit)).toBe('8 \u2212 (3 \u2212 1) = ?');
    expect(formatSolved(brackets, { kind: 'number', value: 20 })).toBe('(2 + 3) · 4 = 20');
  });

  it('writes comparisons with the sign as the blank', () => {
    expect(formatProblem(compare)).toBe('7 · 8 ? 50');
    expect(formatAnswer({ kind: 'relation', relation: 'gt' })).toBe('>');
  });

  it('writes whole sentences for term questions and marks the number asked about', () => {
    expect(formatProblem(product)).toBe('6 · 7 = 42');
    expect(formatProblem(leftover)).toBe('23 : 5 = 4 r 3');
    expect(formatProblem(leftover, 'international')).toBe('23 ÷ 5 = 4 R 3');
    const tokens = problemTokens(square);
    const marked = tokens.filter((token) => token.kind === 'number' && token.highlight === true);
    // The second 4 is asked about, not the first.
    expect(marked).toHaveLength(1);
    expect(tokens.indexOf(marked[0]!)).toBe(2);
  });

  it('writes a story problem as its arithmetic, and operations per notation', () => {
    expect(formatProblem(story)).toBe('3 · 4 = ?');
    expect(formatSolved(story, { kind: 'number', value: 12 }, 'international')).toBe('3 × 4 = 12');
    expect(formatAnswer({ kind: 'operation', operation: 'div' })).toBe(':');
    expect(formatAnswer({ kind: 'operation', operation: 'div' }, 'international')).toBe('÷');
  });

  it('leaves the sign out while a story asks which sign it needs', () => {
    const text = (tokens: ReturnType<typeof problemTokens>) =>
      tokens
        .map((token) =>
          token.kind === 'blank' ? '?' : token.kind === 'slot'
              ? SLOT_SYMBOL
              : token.kind === 'dots'
                ? ''
                : token.text,
        )
        .join(' ');
    expect(text(problemTokens(story, 'czech', 'operation'))).toBe('3 ○ 4 = ?');
    expect(text(problemTokens(story, 'czech', 'answer'))).toBe('3 · 4 = ?');
    // A leftover story would give its sign away with "r ?", so it asks only the sum.
    expect(text(problemTokens(leftoverStory, 'international', 'operation'))).toBe('23 ○ 5 = ?');
    expect(text(problemTokens(leftoverStory, 'international', 'answer'))).toBe('23 ÷ 5 = ? R ?');
    // Problems without an operation step ignore the step.
    expect(text(problemTokens(fact, 'czech', 'operation'))).toBe('7 · 8 = ?');
  });
});

describe('number words', () => {
  it('reads numbers in British style', () => {
    const cases: [number, string][] = [
      [0, 'zero'],
      [7, 'seven'],
      [13, 'thirteen'],
      [20, 'twenty'],
      [56, 'fifty-six'],
      [99, 'ninety-nine'],
      [100, 'one hundred'],
      [105, 'one hundred and five'],
      [342, 'three hundred and forty-two'],
      [1000, 'one thousand'],
      [1005, 'one thousand and five'],
      [2304, 'two thousand three hundred and four'],
      [12_000, 'twelve thousand'],
      [100_000, 'one hundred thousand'],
      [999_999, 'nine hundred and ninety-nine thousand nine hundred and ninety-nine'],
    ];
    for (const [value, words] of cases) expect(numberToWords(value), String(value)).toBe(words);
  });

  it('refuses numbers it cannot say', () => {
    for (const value of [-1, 1.5, 1_000_000, Number.NaN]) {
      expect(() => numberToWords(value)).toThrow(RangeError);
    }
  });
});

describe('read-aloud', () => {
  it('reads problems the way they are written', () => {
    expect(speakProblem(fact)).toBe('Seven times eight equals what?');
    expect(speakProblem(missingFactor)).toBe('What times six equals forty-two?');
    expect(speakProblem(division)).toBe('Fifty-six divided by seven equals what?');
    expect(speakProblem(remainder)).toBe(
      'Twenty-three divided by five equals what, remainder what?',
    );
    expect(speakProblem(brackets)).toBe(
      'Open bracket, two plus three, close bracket times four equals what?',
    );
    expect(speakProblem(implicit)).toBe(
      'Eight minus open bracket, three minus one, close bracket equals what?',
    );
    expect(speakProblem(compare)).toBe('Which sign goes between seven times eight and fifty?');
  });

  it('reads answers and finished facts', () => {
    expect(speakAnswer({ kind: 'remainder', quotient: 4, remainder: 3 })).toBe(
      'four remainder three',
    );
    expect(speakSolved(fact, { kind: 'number', value: 56 })).toBe(
      'Seven times eight equals fifty-six.',
    );
    expect(speakSolved(remainder, { kind: 'remainder', quotient: 4, remainder: 3 })).toBe(
      'Twenty-three divided by five equals four remainder three.',
    );
    expect(speakSolved(compare, { kind: 'relation', relation: 'gt' })).toBe(
      'Seven times eight is greater than fifty.',
    );
  });

  it('reads term questions as the sentence, then the question', () => {
    expect(speakProblem(product)).toBe(
      'Six times seven equals forty-two. What do we call forty-two?',
    );
    expect(speakProblem(square)).toBe(
      'Four times four equals sixteen. What do we call the second four?',
    );
    expect(speakProblem(leftover)).toBe(
      'Twenty-three divided by five equals four remainder three. What do we call three?',
    );
    expect(speakSolved(product, { kind: 'term', term: 'product' })).toBe(
      'Forty-two is the product.',
    );
    expect(speakSolved(square, { kind: 'term', term: 'factor' })).toBe(
      'The second four is a factor.',
    );
    expect(speakAnswer({ kind: 'term', term: 'remainder' })).toBe('the remainder');
  });

  it('reads a story problem’s arithmetic and names operations', () => {
    expect(speakProblem(story)).toBe('Three times four equals what?');
    expect(speakSolved(story, { kind: 'number', value: 12 })).toBe(
      'Three times four equals twelve.',
    );
    expect(speakAnswer({ kind: 'operation', operation: 'mul' })).toBe('multiplying');
    expect(speakAnswer({ kind: 'operation', operation: 'div' })).toBe('dividing');
  });

  it('asks for the missing sign at a story’s operation step', () => {
    expect(speakProblem(story, 'operation')).toBe('Three, which sign, four, equals what?');
    expect(speakProblem(story, 'answer')).toBe('Three times four equals what?');
    expect(speakProblem(leftoverStory, 'operation')).toBe(
      'Twenty-three, which sign, five, equals what?',
    );
    expect(speakProblem(fact, 'operation')).toBe('Seven times eight equals what?');
  });

  it('speaks both notations with the same words', () => {
    for (const problem of [fact, division, remainder, brackets]) {
      expect(formatProblem(problem, 'czech')).not.toBe(formatProblem(problem, 'international'));
    }
    // Speech takes no notation: `·` and `×` are both "times", `r` and `R` both "remainder".
    expect(speakProblem(division)).toContain('divided by');
  });
});
