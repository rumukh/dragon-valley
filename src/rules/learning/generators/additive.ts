/**
 * Grades 1-2 additive generators: small addition/subtraction facts, missing addends and
 * two-digit addition/subtraction buckets. Fact items are exact (`add:A+B`, `sub:M-S`); 2-digit
 * bucket items draw uniformly from valid operand pairs for their shape and carry/borrow state.
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { BLANK, addCrossesTen, num, op, parseItemId, subCrossesTen } from '../../contract';
import type { AddMissingParams, AddSub2dParams, AddSubShape, Problem } from '../../contract';
import { cannotPractise, span } from './shared';

function meets(requirement: 'required' | 'allowed' | 'forbidden', holds: boolean): boolean {
  return requirement === 'allowed' || (requirement === 'required') === holds;
}

function inRange(value: number, [low, high]: readonly [number, number]): boolean {
  return value >= low && value <= high;
}

export function addFactProblem(item: string): Problem {
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'add') throw cannotPractise('add.fact', item);
  return { kind: 'equation', left: op('add', num(parsed.a), num(parsed.b)), right: BLANK };
}

export function subFactProblem(item: string): Problem {
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'sub') throw cannotPractise('sub.fact', item);
  return {
    kind: 'equation',
    left: op('sub', num(parsed.minuend), num(parsed.subtrahend)),
    right: BLANK,
  };
}

export function missingAddendProblem(
  params: DeepReadonly<AddMissingParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const parsed = parseItemId(item);
  if (
    parsed?.kind !== 'sub' ||
    !inRange(parsed.subtrahend, params.known) ||
    !inRange(parsed.difference, params.missing) ||
    parsed.minuend > params.sumMax
  ) {
    throw cannotPractise('add.missing', item);
  }
  const blankFirst = params.position === 'first' || (params.position === 'both' && problems.bool());
  const known = num(parsed.subtrahend);
  return {
    kind: 'equation',
    left: blankFirst ? op('add', BLANK, known) : op('add', known, BLANK),
    right: num(parsed.minuend),
  };
}

function shapeOperands(
  shape: AddSubShape,
  twoDigit: readonly [number, number],
): { first: number[]; second: number[] } {
  const two = span(twoDigit[0], twoDigit[1]);
  if (shape === 'tens') {
    const tens = two.filter((n) => n % 10 === 0);
    return { first: tens, second: tens };
  }
  return { first: two, second: shape === '2d1d' ? span(1, 9) : two };
}

function bucket(
  item: string,
): { operator: 'add' | 'sub'; shape: AddSubShape; crosses: boolean } | null {
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'bucket' || (parsed.family !== 'add2d' && parsed.family !== 'sub2d')) {
    return null;
  }
  const [shape, state] = parsed.bucket.split('-') as [AddSubShape, string];
  if (shape !== 'tens' && shape !== '2d1d' && shape !== '2d2d') return null;
  if (parsed.family === 'add2d' && (state === 'carry' || state === 'nocarry')) {
    return { operator: 'add', shape, crosses: state === 'carry' };
  }
  if (parsed.family === 'sub2d' && (state === 'borrow' || state === 'noborrow')) {
    return { operator: 'sub', shape, crosses: state === 'borrow' };
  }
  return null;
}

export function addSub2dProblem(
  params: DeepReadonly<AddSub2dParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const wanted = bucket(item);
  if (
    wanted === null ||
    !params.operators.includes(wanted.operator) ||
    !params.shapes.includes(wanted.shape) ||
    !meets(params.crossing, wanted.crosses)
  ) {
    throw cannotPractise('addsub.2d', item);
  }
  const { first, second } = shapeOperands(wanted.shape, params.twoDigit);
  const pairs: [number, number][] = [];
  for (const a of first) {
    for (const b of second) {
      if (wanted.operator === 'add') {
        if (a + b <= params.resultMax && addCrossesTen(a, b) === wanted.crosses) {
          pairs.push([a, b]);
        }
      } else if (a >= b && a <= params.resultMax && subCrossesTen(a, b) === wanted.crosses) {
        pairs.push([a, b]);
      }
    }
  }
  if (pairs.length === 0) throw cannotPractise('addsub.2d', item);
  const [a, b] = problems.pick(pairs);
  return {
    kind: 'equation',
    left: op(wanted.operator, num(a), num(b)),
    right: BLANK,
  };
}
