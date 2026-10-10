/**
 * The picture behind a problem, shown after a miss, before a re-ask, when a fact is taught and on
 * a hint.
 *
 * In the small tables it is something to count: an array of dots for a product (rows ×
 * columns), or equal groups for a division, with leftovers set apart for a remainder (at most
 * 100 dots). The rule facts get their rule as a picture of plates (`rule`): a number times 0 or
 * 1 (either order), a number divided by 1 or by itself, and 0 divided by a number. Beyond the
 * small tables (Giant's Peaks) it is the written strategy, drawn:
 *
 * - `place-shift`: `34 · 10`, `7 · 100` (either order) and every `: 10` and `: 100`. The digits
 *   move one or two places in a place-value chart, and zeros fill the empty places.
 * - `tens-groups`: round tens times a one-digit number (either order). `30 · 3` is 3 tens · 3,
 *   drawn as ten-rods in equal groups.
 * - `split-mul`: a two-digit times a one-digit number (either order), split into tens and ones
 *   as an area model: `38 · 8 = 30 · 8 + 8 · 8`.
 * - `split-div`: a two-digit number divided exactly by a one-digit number, from a quotient of 10
 *   up. The dividend is split at the largest multiple of ten times the divisor: `96 : 8 = 80 : 8
 *   + 16 : 8`.
 * - `order-steps`: an expression of two or more operations, worked out one operation at a time
 *   in the order Golem Orders teaches. That is brackets first, then · and :, then + and −, each
 *   from left to right.
 *
 * For grades 1-2 (addition, subtraction and numbers to 100):
 *
 * - `count`: the dots of a counting problem (`num.count`), in ten-frames. The problem shows the
 *   same dots in place of the number, which is the answer and is never written or spoken.
 * - `ten-frame`: `a + b` and `a − b` (and a missing number) within 20, as dots in two
 *   ten-frames: the second addend in another shape, the taken-away dots crossed out.
 * - `number-line`: a number beyond 20 plus or minus a one-digit number (`34 + 8`, `52 − 7`), as
 *   hops on a number line.
 * - `sticks`: numbers to 100 as bundles of ten sticks (tens) and cubes (ones), for sums and
 *   differences with a step of ten or more (`40 + 30`, `34 + 25`, `3 + 40`) and for place value
 *   (`num.place`, the problem's `sticks` picture).
 *
 * A model is data. `src/app/ui/models.ts` draws it in the child's notation.
 */
import { BLANK, evaluate, num, op } from '../../rules/contract';
import type { Expr, ExprPath, Problem } from '../../rules/contract';
import { pictureOf } from './picture';
import { nodeAt, operations, readyOperations, reduceAt } from '../../rules/minigames/golem-orders';

/** One step of an expression worked out in order: the expression, its first operation and value. */
export interface OrderStep {
  readonly expr: Expr;
  /** The operation that goes first, as a path from the root (as in Golem Orders). */
  readonly path: ExprPath;
  readonly value: number;
}

/**
 * The rule facts, by their picture: `times-zero` is n · 0 (n empty plates), `zero-times` 0 · n
 * (no plates at all), `times-one` n · 1 (n plates of one), `one-times` 1 · n (one plate of n),
 * `divide-one` n : 1 (n plates of one), `zero-shared` 0 : n (n empty plates) and `divide-self`
 * n : n (one plate of n).
 */
export const RULES = [
  'times-zero',
  'zero-times',
  'times-one',
  'one-times',
  'divide-one',
  'zero-shared',
  'divide-self',
] as const;
export type Rule = (typeof RULES)[number];

export type ProblemModel =
  | { readonly kind: 'array'; readonly rows: number; readonly columns: number }
  | { readonly kind: 'groups'; readonly total: number; readonly size: number }
  | {
      readonly kind: 'place-shift';
      /** The problem as written: `34 · 10`, `10 · 34` or `340 : 10`. */
      readonly op: 'mul' | 'div';
      readonly left: number;
      readonly right: number;
      /** The number whose digits move, and the number they make. */
      readonly from: number;
      readonly to: number;
      /** Places the digits move: to the left for ·, to the right for :. */
      readonly places: 1 | 2;
    }
  | {
      readonly kind: 'tens-groups';
      readonly left: number;
      readonly right: number;
      /** The round tens as a number of tens (3 for 30), and the one-digit factor. */
      readonly tens: number;
      readonly times: number;
    }
  | {
      readonly kind: 'split-mul';
      readonly left: number;
      readonly right: number;
      /** The two-digit factor's tens and ones (30 and 8 for 38), and the one-digit factor. */
      readonly tens: number;
      readonly ones: number;
      readonly times: number;
    }
  | {
      readonly kind: 'split-div';
      readonly dividend: number;
      readonly divisor: number;
      /** `dividend = head + rest`: `head` is the largest multiple of ten times the divisor in it. */
      readonly head: number;
      readonly rest: number;
    }
  | {
      readonly kind: 'order-steps';
      readonly steps: readonly OrderStep[];
      readonly result: number;
    }
  | {
      readonly kind: 'rule';
      readonly rule: Rule;
      /** The fact as written, `left op right = result`, and the number the child finds. */
      readonly op: 'mul' | 'div';
      readonly left: number;
      readonly right: number;
      readonly result: number;
      readonly unknown: 'left' | 'right' | 'result';
    }
  | { readonly kind: 'count'; readonly count: number }
  | {
      readonly kind: 'ten-frame';
      readonly op: 'add' | 'sub';
      /** The fact `left op right = result` and the number the child finds. */
      readonly left: number;
      readonly right: number;
      readonly result: number;
      readonly unknown: AddSubUnknown;
    }
  | {
      readonly kind: 'number-line';
      readonly op: 'add' | 'sub';
      readonly left: number;
      readonly right: number;
      readonly result: number;
      readonly unknown: AddSubUnknown;
    }
  | {
      readonly kind: 'sticks';
      /** One number (place value), or the two numbers of the sum or difference `fact`. */
      readonly numbers: readonly StickNumber[];
      readonly fact: AddSubFact | null;
    };

/** `left op right = result`, and which of them the child finds. */
export interface AddSubFact {
  readonly op: 'add' | 'sub';
  readonly left: number;
  readonly right: number;
  readonly result: number;
  readonly unknown: AddSubUnknown;
}

export type AddSubUnknown = 'left' | 'right' | 'result';

/** A number as bundles of ten and loose sticks. */
export interface StickNumber {
  readonly tens: number;
  readonly ones: number;
}

export type ModelKind = ProblemModel['kind'];

/** Ten-frames hold a fact within this number. */
export const MAX_TEN_FRAME = 20;
/** Number lines and sticks draw numbers up to this one. */
export const MAX_YOUNG_NUMBER = 100;

export const MAX_MODEL_DOTS = 100;
/** More operations than this would not fit the model's place as a column of steps. */
export const MAX_ORDER_STEPS = 4;

const POWERS = [10, 100] as const;
/** The place-value chart has ones, tens, hundreds and thousands. */
export const MAX_PLACE_VALUE = 9999;

const value = (expr: Expr): number | null => (expr.kind === 'num' ? expr.value : null);

function countable(total: number, size: number): boolean {
  return size >= 1 && total >= 1 && total <= MAX_MODEL_DOTS;
}

const oneDigit = (n: number): boolean => n >= 2 && n <= 9;
/** Rule facts are drawn as plates up to this number (the small tables). */
export const MAX_RULE_NUMBER = 10;

/** The rule a product `a · b` shows, if it is a rule fact: 0 before 1, so `0 · 1` is about 0. */
function productRule(a: number, b: number): Rule | null {
  if (Math.max(a, b) > MAX_RULE_NUMBER) return null;
  if (a === 0) return 'zero-times';
  if (b === 0) return 'times-zero';
  if (b === 1) return 'times-one';
  if (a === 1) return 'one-times';
  return null;
}

/** The rule a quotient `a : b` shows, if it is a rule fact. */
function quotientRule(a: number, b: number): Rule | null {
  if (b === 0 || Math.max(a, b) > MAX_RULE_NUMBER) return null;
  if (a === 0) return 'zero-shared';
  if (b === 1) return 'divide-one';
  if (a === b) return 'divide-self';
  return null;
}

function ruleModel(
  rule: Rule,
  op: 'mul' | 'div',
  left: number,
  right: number,
  unknown: 'left' | 'right' | 'result',
): ProblemModel {
  const result = op === 'mul' ? left * right : left / right;
  return { kind: 'rule', rule, op, left, right, result, unknown };
}
const isPower = (n: number): n is 10 | 100 => (POWERS as readonly number[]).includes(n);

/** A product of two numbers, `a · b = ?`. */
function productModel(a: number, b: number): ProblemModel | null {
  const rule = productRule(a, b);
  if (rule) return ruleModel(rule, 'mul', a, b, 'result');
  if (a >= 1 && b >= 1 && a <= 10 && b <= 10) return { kind: 'array', rows: a, columns: b };
  // When both factors are powers of ten (`10 · 100`), the second moves the digits of the first.
  const power = isPower(b) ? b : isPower(a) ? a : null;
  if (power !== null) {
    const other = power === b ? a : b;
    return other >= 1 && other * power <= MAX_PLACE_VALUE
      ? {
          kind: 'place-shift',
          op: 'mul',
          left: a,
          right: b,
          from: other,
          to: other * power,
          places: power === 10 ? 1 : 2,
        }
      : null;
  }
  const digitFirst = oneDigit(a) && b >= 10;
  const times = digitFirst ? a : b;
  const twoDigit = digitFirst ? b : a;
  if (!oneDigit(times) || twoDigit < 10 || twoDigit > 99) return null;
  const ones = twoDigit % 10;
  if (ones === 0) {
    return { kind: 'tens-groups', left: a, right: b, tens: twoDigit / 10, times };
  }
  return { kind: 'split-mul', left: a, right: b, tens: twoDigit - ones, ones, times };
}

/** A quotient of two numbers, `a : b = ?`. */
function quotientModel(a: number, b: number): ProblemModel | null {
  const rule = quotientRule(a, b);
  if (rule) return ruleModel(rule, 'div', a, b, 'result');
  if (isPower(b) && a >= 1 && a <= MAX_PLACE_VALUE && a % b === 0) {
    return {
      kind: 'place-shift',
      op: 'div',
      left: a,
      right: b,
      from: a,
      to: a / b,
      places: b === 10 ? 1 : 2,
    };
  }
  if (oneDigit(b) && a >= 10 * b && a <= 99 && a % b === 0) {
    const head = Math.floor(a / (10 * b)) * 10 * b;
    return { kind: 'split-div', dividend: a, divisor: b, head, rest: a - head };
  }
  return countable(a, b) ? { kind: 'groups', total: a, size: b } : null;
}

/** An expression of two or more operations, worked out one operation at a time. */
function orderModel(expr: Expr): ProblemModel | null {
  const count = operations(expr);
  if (count < 2 || count > MAX_ORDER_STEPS) return null;
  const steps: OrderStep[] = [];
  let current = expr;
  for (let step = 0; step < count; step++) {
    const path = readyOperations(current)[0];
    const node = path && nodeAt(current, path);
    const result = node ? evaluate(node) : null;
    if (!path || result === null) return null;
    steps.push({ expr: current, path, value: result });
    current = reduceAt(current, path, result);
  }
  const result = value(current);
  return result === null ? null : { kind: 'order-steps', steps, result };
}

export function sticksOf(value: number): StickNumber {
  return { tens: Math.floor(value / 10), ones: value % 10 };
}

/**
 * `a + b = c` or `a − b = c` with at most one blank, as a fact with its unknown, or null.
 */
function addSubFact(left: Expr, right: Expr): AddSubFact | null {
  if (left.kind !== 'op' || (left.op !== 'add' && left.op !== 'sub')) return null;
  const a = value(left.left);
  const b = value(left.right);
  const c = value(right);
  const blanks = [a, b, c].filter((part) => part === null).length;
  if (blanks !== 1) return null;
  if (a === null && left.left.kind !== 'blank') return null;
  if (b === null && left.right.kind !== 'blank') return null;
  if (c === null && right.kind !== 'blank') return null;
  const add = left.op === 'add';
  let fact: [number, number, number];
  let unknown: AddSubUnknown;
  if (c === null) {
    fact = [a!, b!, add ? a! + b! : a! - b!];
    unknown = 'result';
  } else if (a === null) {
    fact = [add ? c - b! : c + b!, b!, c];
    unknown = 'left';
  } else {
    fact = [a, add ? c - a : a - c, c];
    unknown = 'right';
  }
  if (fact.some((part) => part < 0 || part > MAX_YOUNG_NUMBER)) return null;
  return { op: left.op, left: fact[0], right: fact[1], result: fact[2], unknown };
}

/** The young players' picture of an addition or subtraction. */
function addSubModel(left: Expr, right: Expr): ProblemModel | null {
  const fact = addSubFact(left, right);
  if (fact === null) return null;
  const whole = fact.op === 'add' ? fact.result : fact.left;
  if (whole <= MAX_TEN_FRAME) return { kind: 'ten-frame', ...fact };
  // A one-digit step from the first number is a hop on the number line (one hop per unit, so
  // `3 + 40` would be 40 hops); tens and two-digit steps are sticks and cubes.
  if (fact.right < 10) return { kind: 'number-line', ...fact };
  return { kind: 'sticks', numbers: [sticksOf(fact.left), sticksOf(fact.right)], fact };
}

/**
 * The model for a problem. Additions and subtractions get their pictures for young players
 * (`young`: grades 1-2) only, so a 3rd grader's screens stay as they were; a problem with a
 * picture (counting, place value) always shows it.
 */
export function modelFor(problem: Problem, young = false): ProblemModel | null {
  const picture = pictureOf(problem);
  if (picture?.kind === 'dots') return { kind: 'count', count: picture.count };
  if (picture?.kind === 'sticks') {
    return { kind: 'sticks', numbers: [{ tens: picture.tens, ones: picture.ones }], fact: null };
  }
  switch (problem.kind) {
    case 'word':
      return modelFor(problem.model, young);
    case 'divrem':
      return countable(problem.dividend, problem.divisor)
        ? { kind: 'groups', total: problem.dividend, size: problem.divisor }
        : null;
    case 'equation': {
      const { left, right } = problem;
      if (left.kind !== 'op') return null;
      if (young && operations(left) === 1 && (left.op === 'add' || left.op === 'sub')) {
        return addSubModel(left, right);
      }
      if (right.kind === 'blank' && operations(left) >= 2) return orderModel(left);
      const a = value(left.left);
      const b = value(left.right);
      if (left.op === 'mul' && right.kind === 'blank' && a !== null && b !== null) {
        return productModel(a, b);
      }
      const product = value(right);
      if (left.op === 'mul' && product !== null) {
        // A missing factor: the product shared into groups of the known factor. A rule fact
        // (`? · 5 = 0`, `7 · ? = 7`) shows its rule.
        const known = left.left.kind === 'blank' ? b : left.right.kind === 'blank' ? a : null;
        if (known !== null && known !== 0 && product % known === 0) {
          const found = product / known;
          const [x, y] = left.left.kind === 'blank' ? [found, known] : [known, found];
          const rule = productRule(x, y);
          if (rule) {
            return ruleModel(rule, 'mul', x, y, left.left.kind === 'blank' ? 'left' : 'right');
          }
        }
        return known !== null && countable(product, known)
          ? { kind: 'groups', total: product, size: known }
          : null;
      }
      if (left.op === 'div' && right.kind === 'blank' && a !== null && b !== null) {
        return quotientModel(a, b);
      }
      return null;
    }
    default:
      return null;
  }
}

/** The worked line of a split model as expressions: `38 · 8`, `30 · 8 + 8 · 8`, `240 + 64`, `304`. */
export function splitLine(
  model: Extract<ProblemModel, { kind: 'split-mul' | 'split-div' }>,
): Expr[] {
  if (model.kind === 'split-mul') {
    const { left, right, tens, ones, times } = model;
    const digitFirst = left === times && right !== times;
    const part = (n: number): Expr =>
      digitFirst ? op('mul', num(times), num(n)) : op('mul', num(n), num(times));
    return [
      op('mul', num(left), num(right)),
      op('add', part(tens), part(ones)),
      op('add', num(tens * times), num(ones * times)),
      num(left * right),
    ];
  }
  const { dividend, divisor, head, rest } = model;
  const whole = op('div', num(dividend), num(divisor));
  if (rest === 0) return [whole, num(dividend / divisor)];
  return [
    whole,
    op('add', op('div', num(head), num(divisor)), op('div', num(rest), num(divisor))),
    op('add', num(head / divisor), num(rest / divisor)),
    num(dividend / divisor),
  ];
}

/** The line's last part, the answer, as a blank: the picture before the child answers. */
export function withoutAnswer(line: readonly Expr[]): Expr[] {
  return [...line.slice(0, -1), BLANK];
}
