/**
 * Answer options for choice input: the correct answer plus `count - 1` distractors, shuffled with
 * the `distractors` stream.
 *
 * Distractors are the mistakes a child plausibly makes on the problem shown. Each problem shape
 * names its signature mistake (the misconception the skill is about, such as a forgotten carry),
 * which is always offered when it is a valid option, and a ranked list of further mistakes; the
 * rest of the options are drawn from the first few of those so that rounds vary. Every numeric
 * distractor is a whole number, never the answer, inside the 3rd-grade range of 0-1000 (unless the
 * answer itself is larger) and at most one digit longer or shorter than the answer. Remainder
 * distractors are `{ quotient, remainder }` pairs with a remainder below twice the divisor.
 *
 * Mistakes by problem shape (signature first):
 * - small-table product `7 · 8`: neighbouring products `7 · 9`, `7 · 7`, `8 · 8`, `6 · 8`;
 *   `7 + 8`; the digits reversed (65); slips ± 1, ± 2, ± 10;
 * - `34 · 10`, `7 · 100`: **one zero too few** (34, 70); one zero too many; `34 + 10`;
 *   neighbouring products `35 · 10`, `33 · 10`;
 * - tens `30 · 3`: **the zero dropped** (9); the zero doubled (900); `30 + 3`; neighbouring
 *   products;
 * - two-digit `14 · 3`: **the carry forgotten** (32) or, without a carry, **only the tens
 *   multiplied** (`23 · 3` -> 63); only the ones multiplied (22); neighbouring products; ± 10;
 *   `14 + 3`;
 * - small-table quotient `42 : 6`: the quotient ± 1 or ± 2; the divisor; ± 10;
 * - two-digit quotient `48 : 3`: **the tens divided and the ones copied** (18) or **the tens and
 *   ones divided separately** (`48 : 3` -> 12); only the tens (10); the zero dropped; ± 1; ± 10;
 *   `48 − 3`;
 * - missing factor `? · 6 = 42`: the answer ± 1 or ± 2; the known factor; ± 10;
 * - small addition/subtraction facts: counting slips ±1 first, then the other operation, ±2,
 *   reversed digits and ±10;
 * - two-digit addition/subtraction: **carry forgotten** (`34 + 8` -> 32), **digit-wise
 *   subtraction** (`52 - 27` -> 35), borrow/carry slips, ±1, ±10, reversed digits and the other
 *   operation;
 * - missing addend `7 + ? = 10`: the sum, the sum plus the known addend, slips, and the known
 *   addend;
 * - counting dots: `n ± 1`, `n ± 2`; place value: swapped tens/ones, the whole number, slips;
 * - order of operations: **brackets ignored** (`(2 + 3) · 4` -> 14) or **precedence ignored**,
 *   strictly left to right (`2 + 3 · 4` -> 20); brackets first, then left to right; a step left
 *   out (12); slips;
 * - word problems: **the additive/multiplicative contrast** ("3 more" read as "3 times as many"
 *   and back, `12 − 3` for "that is 3 times as many as"); the operation in the wrong direction
 *   (`12 · 3` for `12 : 3`, `4 − 3` for `4 + 3`); one step of a two-step story; the arithmetic
 *   mistakes of a one-step product or quotient (`43 · 3` -> 123); slips;
 * - remainders `23 : 5 = 4 r 3`: **the remainder not smaller than the divisor** (3 r 8), or for a
 *   quotient of 0 **the next multiple's difference** (`3 : 5` -> 1 r 2); the next multiple's
 *   difference (5 r 2); quotient and remainder swapped (3 r 4); the remainder or the quotient off
 *   by one; the remainder forgotten (4 r 0);
 * - comparisons and operations: the whole vocabulary (<, >, = or +, −, ·, :);
 * - terms: **the closest term** (`product` for `factor`, `divisor` for `dividend`), then other
 *   terms of the same and the other operation.
 */
import { requireValue } from '@aegis/runtime';
import type { RandomStream } from '@aegis/runtime';
import {
  MAX_PROBLEM_NUMBER,
  OPERATORS,
  RELATIONS,
  evaluate,
  expectedAnswer,
  sameAnswer,
} from '../contract';
import type { AnswerValue, Expr, Operator, Problem, Term } from '../contract';
import { digits } from './items';
import {
  leftToRight,
  operatorsOf,
  partialValues,
  tokensOf,
  withOperator,
  withoutBrackets,
} from './generators/expressions';
import type { Token } from './generators/expressions';
import { NUMBER_RANGE, shuffle } from './generators/shared';

/** How many more of the ranked mistakes than needed the options are drawn from. */
const POOL_EXTRA = 3;

/**
 * A problem's mistakes: the first valid `signature` mistake is always offered; the others are
 * drawn from the first few valid `ranked` ones.
 */
export interface Mistakes<T> {
  signature: T[];
  ranked: T[];
}

type Pair = { quotient: number; remainder: number };

/** A numeric distractor a child could plausibly give for `answer`. */
export function plausibleNumber(value: number, answer: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value !== answer &&
    value <= (answer <= NUMBER_RANGE ? NUMBER_RANGE : MAX_PROBLEM_NUMBER) &&
    Math.abs(digits(value) - digits(answer)) <= 1
  );
}

/** A remainder distractor a child could plausibly give for `answer` when dividing by `divisor`. */
export function plausiblePair(pair: Pair, answer: Pair, divisor: number): boolean {
  return (
    Number.isSafeInteger(pair.quotient) &&
    Number.isSafeInteger(pair.remainder) &&
    pair.quotient >= 0 &&
    pair.remainder >= 0 &&
    (pair.quotient !== answer.quotient || pair.remainder !== answer.remainder) &&
    pair.remainder < 2 * divisor &&
    pair.quotient <= (answer.quotient <= NUMBER_RANGE ? NUMBER_RANGE : MAX_PROBLEM_NUMBER) &&
    Math.abs(digits(pair.quotient) - digits(answer.quotient)) <= 1
  );
}

function reversedDigits(value: number): number | null {
  const text = String(value);
  if (text.length < 2) return null;
  const reversed = Number([...text].reverse().join(''));
  return reversed === value ? null : reversed;
}

const tens = (value: number) => (value - (value % 10)) / 10;
const slips = (answer: number) => [
  answer + 1,
  answer - 1,
  answer + 2,
  answer - 2,
  answer + 10,
  answer - 10,
];

function productMistakes(a: number, b: number, answer: number): Mistakes<number> {
  if (a <= 10 && b <= 10) {
    const reversed = reversedDigits(answer);
    return {
      signature: [],
      ranked: [
        a * (b + 1),
        a * (b - 1),
        (a + 1) * b,
        (a - 1) * b,
        a + b,
        ...(reversed ? [reversed] : []),
        ...slips(answer),
      ],
    };
  }
  const power = b === 100 || b === 10 ? b : a === 100 || a === 10 ? a : 0;
  if (power !== 0) {
    const f = power === b ? a : b;
    return {
      signature: [answer / 10],
      ranked: [answer * 10, f + power, (f + 1) * power, (f - 1) * power],
    };
  }
  const round = a % 10 === 0 && b <= 9 ? a : b % 10 === 0 && a <= 9 ? b : 0;
  if (round !== 0) {
    const d = round === a ? b : a;
    const t = round / 10;
    return {
      signature: [t * d],
      ranked: [
        t * d * 100,
        round + d,
        round * (d + 1),
        round * (d - 1),
        (round + 10) * d,
        (round - 10) * d,
      ],
    };
  }
  const big = a >= 10 ? a : b;
  const small = big === a ? b : a;
  const [t, u] = [tens(big), big % 10];
  const ones = u * small;
  return {
    signature: [t * small * 10 + (ones % 10), t * small * 10 + u],
    ranked: [
      t * small * 10 + u,
      t * 10 + ones,
      big * (small + 1),
      big * (small - 1),
      answer + 10,
      answer - 10,
      big + small,
    ],
  };
}

function quotientMistakes(dividend: number, divisor: number, answer: number): Mistakes<number> {
  if (divisor <= 10 && answer <= 10) {
    return {
      signature: [],
      ranked: [answer + 1, answer - 1, answer + 2, answer - 2, divisor, answer + 10, answer - 10],
    };
  }
  const t = tens(dividend);
  const u = dividend % 10;
  const tensQuotient = (t - (t % divisor)) / divisor;
  const separately = tensQuotient * 10 + (u - (u % divisor)) / divisor;
  return {
    signature: [tensQuotient * 10 + u, separately],
    ranked: [
      separately,
      tensQuotient * 10,
      tensQuotient,
      answer + 1,
      answer - 1,
      answer + 10,
      answer - 10,
      dividend - divisor,
    ],
  };
}

function additionMistakes(a: number, b: number, answer: number): Mistakes<number> {
  const reversed = reversedDigits(answer);
  if (a <= 10 && b <= 10 && answer <= 20) {
    return {
      signature: [],
      ranked: [
        answer + 1,
        answer - 1,
        Math.abs(a - b),
        answer + 2,
        answer - 2,
        ...(reversed ? [reversed] : []),
        answer + 10,
        answer - 10,
      ],
    };
  }
  const ones = (a % 10) + (b % 10);
  const tensSum = tens(a) + tens(b);
  const carryForgotten = tensSum * 10 + (ones % 10);
  const carryAsDigits = Number(`${tensSum}${ones}`);
  return {
    signature: [carryForgotten],
    ranked: [
      carryAsDigits,
      answer + 1,
      answer - 1,
      answer + 10,
      answer - 10,
      ...(reversed ? [reversed] : []),
      Math.abs(a - b),
    ],
  };
}

function subtractionMistakes(a: number, b: number, answer: number): Mistakes<number> {
  const reversed = reversedDigits(answer);
  if (a <= 20 && b <= 10) {
    return {
      signature: [],
      ranked: [
        answer + 1,
        answer - 1,
        a + b,
        Math.abs(b - a),
        answer + 2,
        answer - 2,
        answer + 10,
        answer - 10,
      ],
    };
  }
  const digitWise = Math.abs(tens(a) - tens(b)) * 10 + Math.abs((a % 10) - (b % 10));
  const borrowForgotten = (tens(a) - tens(b)) * 10 + (10 + (a % 10) - (b % 10));
  return {
    signature: [digitWise, borrowForgotten === digitWise ? answer + 10 : borrowForgotten],
    ranked: [
      answer + 1,
      answer - 1,
      answer + 10,
      answer - 10,
      ...(reversed ? [reversed] : []),
      a + b,
    ],
  };
}

function missingAddendMistakes(sum: number, known: number, answer: number): Mistakes<number> {
  return {
    signature: [],
    ranked: [sum, sum + known, answer + 1, answer - 1, answer + 2, answer - 2, known],
  };
}

function dotsMistakes(answer: number): Mistakes<number> {
  return { signature: [], ranked: [answer + 1, answer - 1, answer + 2, answer - 2] };
}

function placeMistakes(
  problem: Extract<Problem, { kind: 'equation' }>,
  answer: number,
): Mistakes<number> | null {
  const picture = problem.picture?.kind === 'sticks' ? problem.picture : null;
  if (picture === null) return null;
  const n = picture.tens * 10 + picture.ones;
  const swapped = picture.ones * 10 + picture.tens;
  if (problem.right.kind === 'blank') {
    return {
      signature: swapped === n ? [] : [swapped],
      ranked: [n, answer + 1, answer - 1, answer + 10, answer - 10],
    };
  }
  return {
    signature: [answer === picture.tens ? picture.ones : picture.tens],
    ranked: [n, answer + 1, answer - 1, answer + 10, answer - 10],
  };
}

/** Tokens with every bracket worked out first: the child does brackets, then left to right. */
function bracketsFirst(expr: Expr): Token[] | null {
  switch (expr.kind) {
    case 'num':
      return [expr.value];
    case 'blank':
      return null;
    case 'group': {
      const inner = bracketsFirst(expr.inner);
      const value = inner === null ? null : leftToRight(inner);
      return value === null ? null : [value];
    }
    case 'op': {
      const left = bracketsFirst(expr.left);
      const right = bracketsFirst(expr.right);
      return left && right ? [...left, expr.op, ...right] : null;
    }
  }
}

const present = (values: readonly (number | null)[]): number[] =>
  values.filter((value): value is number => value !== null);

function expressionMistakes(expr: Expr, answer: number): Mistakes<number> {
  const tokens = tokensOf(expr);
  const kept = bracketsFirst(expr);
  return {
    signature: present(tokens ? [withoutBrackets(tokens), leftToRight(tokens)] : []),
    ranked: present([
      ...(tokens ? [leftToRight(tokens)] : []),
      ...(kept ? [leftToRight(kept)] : []),
      ...partialValues(expr),
      ...slips(answer),
    ]),
  };
}

/** "3 more" for "3 times as many" (and back), "3 fewer" for "that is 3 times as many as". */
const CONTRAST: Readonly<Record<Operator, Operator>> = {
  add: 'mul',
  mul: 'add',
  sub: 'div',
  div: 'sub',
};
/** The operation in the wrong direction: added instead of taken away, multiplied for divided. */
const INVERSE: Readonly<Record<Operator, Operator>> = {
  add: 'sub',
  sub: 'add',
  mul: 'div',
  div: 'mul',
};

function storyMistakes(expr: Expr, answer: number, template: string): Mistakes<number> {
  const operators = operatorsOf(expr);
  const swapped = (table: Readonly<Record<Operator, Operator>>) =>
    operators.map((operator, index) => evaluate(withOperator(expr, index, table[operator])));
  const tokens = tokensOf(expr);
  // A one-step story also invites the arithmetic mistakes of its operation. Additive arithmetic is
  // limited to the new additive change-story families so existing 3rd-grade traces stay pinned.
  const additiveStory = template.includes('.add-to.') || template.includes('.take-from.');
  const arithmetic =
    expr.kind === 'op' && expr.left.kind === 'num' && expr.right.kind === 'num'
      ? expr.op === 'mul'
        ? productMistakes(expr.left.value, expr.right.value, answer)
        : expr.op === 'div'
          ? quotientMistakes(expr.left.value, expr.right.value, answer)
          : additiveStory && expr.op === 'add'
            ? additionMistakes(expr.left.value, expr.right.value, answer)
            : additiveStory && expr.op === 'sub'
              ? subtractionMistakes(expr.left.value, expr.right.value, answer)
              : null
      : null;
  return {
    signature: present(swapped(CONTRAST)),
    ranked: present([
      ...swapped(CONTRAST),
      ...swapped(INVERSE),
      ...partialValues(expr),
      ...(tokens ? [leftToRight(tokens)] : []),
      ...(arithmetic ? [...arithmetic.signature, ...arithmetic.ranked] : []),
      ...slips(answer),
    ]),
  };
}

/** The mistakes for a numeric answer, by the problem's shape. */
export function numberMistakes(problem: Problem, answer: number): Mistakes<number> {
  if (problem.kind === 'word') {
    return problem.model.kind === 'equation'
      ? storyMistakes(problem.model.left, answer, problem.template)
      : { signature: [], ranked: slips(answer) };
  }
  if (problem.kind === 'equation') {
    const { left, right } = problem;
    if (problem.picture?.kind === 'dots') return dotsMistakes(answer);
    const place = placeMistakes(problem, answer);
    if (place !== null) return place;
    if (right.kind === 'blank' && left.kind === 'op') {
      if (left.left.kind === 'num' && left.right.kind === 'num') {
        const [a, b] = [left.left.value, left.right.value];
        if (left.op === 'add') return additionMistakes(a, b, answer);
        if (left.op === 'sub') return subtractionMistakes(a, b, answer);
        if (left.op === 'mul') return productMistakes(a, b, answer);
        if (left.op === 'div') return quotientMistakes(a, b, answer);
      }
      return expressionMistakes(left, answer);
    }
    if (left.kind === 'op' && right.kind === 'num') {
      // A missing factor/addend: `? · k = p`, `k · ? = p`, `? + k = s` or `k + ? = s`.
      const known =
        left.left.kind === 'num'
          ? left.left.value
          : left.right.kind === 'num'
            ? left.right.value
            : null;
      if (left.op === 'add' && known !== null) {
        return missingAddendMistakes(right.value, known, answer);
      }
      return {
        signature: [],
        ranked: [
          answer + 1,
          answer - 1,
          answer + 2,
          answer - 2,
          ...(known === null ? [] : [known]),
          answer + 10,
          answer - 10,
        ],
      };
    }
  }
  return { signature: [], ranked: slips(answer) };
}

/** The mistakes for `quotient r remainder` when dividing by `divisor`. */
export function remainderMistakes(
  divisor: number,
  quotient: number,
  remainder: number,
): Mistakes<Pair> {
  const [q, r, d] = [quotient, remainder, divisor];
  const overshoot = r > 0 ? [{ quotient: q + 1, remainder: d - r }] : [];
  return {
    signature: [{ quotient: q - 1, remainder: r + d }, ...overshoot],
    ranked: [
      ...overshoot,
      { quotient: r, remainder: q },
      { quotient: q, remainder: r + 1 },
      { quotient: q, remainder: r - 1 },
      { quotient: q + 1, remainder: r },
      { quotient: q - 1, remainder: r },
      { quotient: q, remainder: 0 },
    ],
  };
}

/** The terms a child confuses with each one, closest first. */
export const TERM_NEIGHBOURS: Readonly<Record<Term, readonly Term[]>> = {
  factor: ['product', 'divisor', 'quotient', 'dividend', 'remainder'],
  product: ['factor', 'dividend', 'quotient', 'divisor', 'remainder'],
  dividend: ['divisor', 'product', 'quotient', 'factor', 'remainder'],
  divisor: ['dividend', 'factor', 'quotient', 'product', 'remainder'],
  quotient: ['product', 'dividend', 'divisor', 'remainder', 'factor'],
  remainder: ['quotient', 'divisor', 'dividend', 'product', 'factor'],
};

/**
 * `wanted` distinct mistakes: the first valid signature mistake, then a seeded draw from the
 * first few valid ranked ones.
 */
function pick<T>(
  mistakes: Mistakes<T>,
  wanted: number,
  valid: (value: T) => boolean,
  same: (a: T, b: T) => boolean,
  random: RandomStream,
): T[] {
  const picked: T[] = [];
  const signature = mistakes.signature.find(valid);
  if (signature !== undefined && wanted > 0) picked.push(signature);
  const pool: T[] = [];
  for (const value of mistakes.ranked) {
    if (!valid(value) || picked.some((p) => same(p, value)) || pool.some((p) => same(p, value)))
      continue;
    pool.push(value);
  }
  const remaining = wanted - picked.length;
  return [...picked, ...shuffle(pool.slice(0, remaining + POOL_EXTRA), random).slice(0, remaining)];
}

/**
 * `count` options including the correct one, in seeded order. Numeric and remainder options are
 * the answer plus plausible mistakes; relations and operations offer their whole vocabulary;
 * terms offer the answer, its closest neighbour and further neighbours.
 */
export function choicesFor(problem: Problem, count: number, random: RandomStream): AnswerValue[] {
  const expected = requireValue(expectedAnswer(problem));
  const wanted = Math.max(1, count - 1);
  let options: AnswerValue[];
  switch (expected.kind) {
    case 'number': {
      const answer = expected.value;
      const valid = (value: number) => plausibleNumber(value, answer);
      const picked = pick(
        numberMistakes(problem, answer),
        wanted,
        valid,
        (a, b) => a === b,
        random,
      );
      // Rarely needed: answers like 0 offer few mistakes, so the nearest numbers fill in.
      for (let k = 1; picked.length < wanted && k <= NUMBER_RANGE; k++) {
        for (const value of [answer + k, answer - k]) {
          if (picked.length < wanted && valid(value) && !picked.includes(value)) picked.push(value);
        }
      }
      options = [expected, ...picked.map((value): AnswerValue => ({ kind: 'number', value }))];
      break;
    }
    case 'remainder': {
      const divisor =
        problem.kind === 'divrem'
          ? problem.divisor
          : problem.kind === 'word' && problem.model.kind === 'divrem'
            ? problem.model.divisor
            : expected.remainder + 1;
      const valid = (pair: Pair) => plausiblePair(pair, expected, divisor);
      const same = (a: Pair, b: Pair) => a.quotient === b.quotient && a.remainder === b.remainder;
      const picked = pick(
        remainderMistakes(divisor, expected.quotient, expected.remainder),
        wanted,
        valid,
        same,
        random,
      );
      for (let k = 1; picked.length < wanted && k <= NUMBER_RANGE; k++) {
        for (const pair of [
          { quotient: expected.quotient + k, remainder: expected.remainder },
          { quotient: expected.quotient, remainder: expected.remainder + k },
        ]) {
          if (picked.length < wanted && valid(pair) && !picked.some((p) => same(p, pair))) {
            picked.push(pair);
          }
        }
      }
      options = [expected, ...picked.map((pair): AnswerValue => ({ kind: 'remainder', ...pair }))];
      break;
    }
    case 'relation':
      options = RELATIONS.map((relation): AnswerValue => ({ kind: 'relation', relation }));
      break;
    case 'operation':
      options = OPERATORS.map((operation): AnswerValue => ({ kind: 'operation', operation }));
      break;
    case 'term': {
      const [closest, ...others] = TERM_NEIGHBOURS[expected.term];
      const picked = pick(
        { signature: [closest!], ranked: others },
        wanted,
        () => true,
        (a, b) => a === b,
        random,
      );
      options = [expected, ...picked.map((term): AnswerValue => ({ kind: 'term', term }))];
      break;
    }
  }
  const distinct = options.filter(
    (option, index) => options.findIndex((o) => sameAnswer(o, option)) === index,
  );
  return shuffle(distinct, random);
}

/** Whether the answer can be typed on the keypad (numbers and remainders; not <, > or terms). */
export function keypadPossible(problem: Problem): boolean {
  const expected = expectedAnswer(problem);
  return expected.ok && (expected.value.kind === 'number' || expected.value.kind === 'remainder');
}
