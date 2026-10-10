/**
 * Grades 1-2 number generators:
 *
 * - `num.count`: `? = n` with a dots picture. The shell hides the known side for dots pictures.
 * - `num.compare`: `a ○ b`, two plain numbers in the requested band.
 * - `num.place`: place-value sticks for a two-digit number `n = 10t + o`.
 *   Shapes are deliberately simple for young children:
 *   - `place:compose`: `tensValue + ones = ?`, e.g. `40 + 7 = ?`
 *   - `place:tens`: `n = ? · 10 + ones`
 *   - `place:ones`: `n = tens · 10 + ?`
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { BLANK, bucketId, num, op, parseItemId } from '../../contract';
import type { NumCompareParams, NumCountParams, NumPlaceParams, Problem } from '../../contract';
import { cannotPractise, span } from './shared';

function bucketOf(item: string, family: string): string | null {
  const parsed = parseItemId(item);
  return parsed?.kind === 'bucket' && parsed.family === family ? parsed.bucket : null;
}

function bandRange(bucket: string): [number, number] | null {
  const [low, high] = bucket.split('-').map(Number);
  return Number.isInteger(low) && Number.isInteger(high) ? [low!, high!] : null;
}

function intersect(a: readonly [number, number], b: readonly [number, number]): number[] {
  return span(Math.max(a[0], b[0]), Math.min(a[1], b[1]));
}

export function countProblem(
  params: DeepReadonly<NumCountParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const bucket = bucketOf(item, 'count');
  const band = bucket === null ? null : bandRange(bucket);
  const numbers = band === null ? [] : intersect(params.numbers, band);
  if (numbers.length === 0) throw cannotPractise('num.count', item);
  const count = problems.pick(numbers);
  return {
    kind: 'equation',
    left: BLANK,
    right: num(count),
    picture: { kind: 'dots', count },
  };
}

export function numberCompareProblem(
  params: DeepReadonly<NumCompareParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const bucket = bucketOf(item, 'ncompare');
  const band = bucket === null ? null : bandRange(bucket);
  const numbers = band === null ? [] : intersect(params.numbers, band);
  if (numbers.length === 0 || bucketId('ncompare', bucket!) !== item) {
    throw cannotPractise('num.compare', item);
  }
  const equal = problems.int(0, 100) < params.equalShare || numbers.length === 1;
  const left = problems.pick(numbers);
  if (equal) return { kind: 'compare', left: num(left), right: num(left) };

  const others = numbers.filter((n) => n !== left);
  const nearReach = Math.max(2, Math.min(10, numbers.length / 5 - ((numbers.length / 5) % 1) + 1));
  const near = others.filter((n) => Math.abs(n - left) <= nearReach);
  const pool = near.length > 0 && problems.bool() ? near : others;
  return { kind: 'compare', left: num(left), right: num(problems.pick(pool)) };
}

export function placeProblem(
  params: DeepReadonly<NumPlaceParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const ask = bucketOf(item, 'place');
  const numbers = params.asks.includes(ask as NumPlaceParams['asks'][number])
    ? span(params.numbers[0], params.numbers[1]).filter((n) => n >= 10 && n <= 99)
    : [];
  if (numbers.length === 0 || (ask !== 'tens' && ask !== 'ones' && ask !== 'compose')) {
    throw cannotPractise('num.place', item);
  }
  const n = problems.pick(numbers);
  const t = (n - (n % 10)) / 10;
  const o = n % 10;
  const picture = { kind: 'sticks' as const, tens: t, ones: o };
  if (ask === 'compose') {
    return { kind: 'equation', left: op('add', num(t * 10), num(o)), right: BLANK, picture };
  }
  const placeExpr =
    ask === 'tens'
      ? op('add', op('mul', BLANK, num(10)), num(o))
      : op('add', op('mul', num(t), num(10)), BLANK);
  return { kind: 'equation', left: num(n), right: placeExpr, picture };
}
