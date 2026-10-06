/**
 * Division with remainder (`div.remainder`): `23 : 5 = ? r ?`, answered with the quotient and the
 * remainder. The item is the divisor's bucket (`rem:d5`); the quotient and remainder are drawn
 * uniformly from the pairs the parameters allow, so the remainder is always smaller than the
 * divisor and the dividend never exceeds `dividendMax` (at most 99 in the core program).
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { parseItemId } from '../../contract';
import type { DivRemainderParams, Problem, Requirement } from '../../contract';
import { cannotPractise, span } from './shared';

export interface RemainderPair {
  quotient: number;
  remainder: number;
}

/** Whether a remainder satisfies the skill's requirement. */
export function remainderAllowed(remainder: number, requirement: Requirement): boolean {
  return requirement === 'allowed' || (requirement === 'required') === remainder > 0;
}

/**
 * Every quotient and remainder the skill allows for `divisor`, by quotient then remainder. The
 * all-zero sentence `0 : d = 0 r 0` is left out unless it is the only one.
 */
export function remainderPairs(
  params: DeepReadonly<DivRemainderParams>,
  divisor: number,
): RemainderPair[] {
  const pairs: RemainderPair[] = [];
  for (const quotient of span(params.quotients[0], params.quotients[1])) {
    for (const remainder of span(0, divisor - 1)) {
      if (quotient * divisor + remainder > params.dividendMax) continue;
      if (remainderAllowed(remainder, params.remainder)) pairs.push({ quotient, remainder });
    }
  }
  const nonZero = pairs.filter((pair) => pair.quotient + pair.remainder > 0);
  return nonZero.length > 0 ? nonZero : pairs;
}

export function remainderProblem(
  params: DeepReadonly<DivRemainderParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const parsed = parseItemId(item);
  const divisor =
    parsed?.kind === 'bucket' && parsed.family === 'rem' ? bucketDivisor(parsed.bucket) : 0;
  const pairs = params.divisors.includes(divisor) ? remainderPairs(params, divisor) : [];
  if (pairs.length === 0) throw cannotPractise('div.remainder', item);
  const { quotient, remainder } = problems.pick(pairs);
  return { kind: 'divrem', dividend: quotient * divisor + remainder, divisor };
}

/** `d7` -> 7; anything else -> 0. */
function bucketDivisor(bucket: string): number {
  const match = /^d(\d+)$/.exec(bucket);
  return match ? Number(match[1]) : 0;
}
