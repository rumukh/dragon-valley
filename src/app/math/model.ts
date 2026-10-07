/**
 * The picture behind a problem, shown after a miss, before a re-ask, when a fact is taught and on
 * a hint.
 *
 * In the small tables it is something to count: an array of dots for a product (rows ×
 * columns), or equal groups for a division, with leftovers set apart for a remainder (at most
 * 100 dots). Beyond them (Giant's Peaks) it is the written strategy, drawn:
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
 * A model is data. `src/app/ui/models.ts` draws it in the child's notation.
 */
import { BLANK, evaluate, num, op } from '../../rules/contract';
import type { Expr, ExprPath, Problem } from '../../rules/contract';
import { nodeAt, operations, readyOperations, reduceAt } from '../../rules/minigames/golem-orders';

/** One step of an expression worked out in order: the expression, its first operation and value. */
export interface OrderStep {
  readonly expr: Expr;
  /** The operation that goes first, as a path from the root (as in Golem Orders). */
  readonly path: ExprPath;
  readonly value: number;
}

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
    };

export type ModelKind = ProblemModel['kind'];

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
const isPower = (n: number): n is 10 | 100 => (POWERS as readonly number[]).includes(n);

/** A product of two numbers, `a · b = ?`. */
function productModel(a: number, b: number): ProblemModel | null {
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

export function modelFor(problem: Problem): ProblemModel | null {
  switch (problem.kind) {
    case 'word':
      return modelFor(problem.model);
    case 'divrem':
      return countable(problem.dividend, problem.divisor)
        ? { kind: 'groups', total: problem.dividend, size: problem.divisor }
        : null;
    case 'equation': {
      const { left, right } = problem;
      if (left.kind !== 'op') return null;
      if (right.kind === 'blank' && operations(left) >= 2) return orderModel(left);
      const a = value(left.left);
      const b = value(left.right);
      if (left.op === 'mul' && right.kind === 'blank' && a !== null && b !== null) {
        return productModel(a, b);
      }
      const product = value(right);
      if (left.op === 'mul' && product !== null) {
        // A missing factor: the product shared into groups of the known factor.
        const known = left.left.kind === 'blank' ? b : left.right.kind === 'blank' ? a : null;
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
