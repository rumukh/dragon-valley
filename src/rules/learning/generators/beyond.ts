/**
 * Beyond the small tables (Giant's Peaks), all results within `resultMax` (1000 in the core
 * program):
 *
 * - `mul.power10`: `34 · 10`, `7 · 100` (either order); items `pow10:x10`, `pow10:x100`.
 * - `mul.tens`: tens times a one-digit number, `30 · 3` (either order); items `tens:d3`.
 * - `mul.2d1d`: a two-digit times a one-digit number, `23 · 3` without a carry from the ones,
 *   `14 · 3` with one; items `mul2d1d:nocarry`, `mul2d1d:carry`. Round tens (`30 · 3`) belong to
 *   `mul.tens` and are used only when nothing else fits.
 * - `div.2d1d`: a two-digit dividend over a one-digit divisor, `69 : 3` without regrouping the
 *   tens, `48 : 3` with it; items `div2d1d:noregroup`, `div2d1d:regroup`. Without remainder (the
 *   core program) the problem is `48 : 3 = ?`; a skill that allows remainders asks
 *   `75 : 4 = ? r ?` instead.
 *
 * Divisors and one-digit factors are drawn first, then the other number, so every divisor is
 * practised equally often whatever its number of quotients.
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { BLANK, num, op, parseItemId } from '../../contract';
import type {
  Div2d1dParams,
  Mul2d1dParams,
  MulPower10Params,
  MulTensParams,
  Problem,
} from '../../contract';
import { remainderAllowed } from './remainder';
import { cannotPractise, span } from './shared';

function bucketOf(item: string, family: string): string | null {
  const parsed = parseItemId(item);
  return parsed?.kind === 'bucket' && parsed.family === family ? parsed.bucket : null;
}

/** `a · b = ?`, or `b · a = ?` when `swap`. */
function product(a: number, b: number, swap: boolean): Problem {
  return {
    kind: 'equation',
    left: swap ? op('mul', num(b), num(a)) : op('mul', num(a), num(b)),
    right: BLANK,
  };
}

export function power10Problem(
  params: DeepReadonly<MulPower10Params>,
  item: string,
  problems: RandomStream,
): Problem {
  const bucket = bucketOf(item, 'pow10');
  const power = bucket === 'x10' ? 10 : bucket === 'x100' ? 100 : 0;
  const factors = (params.powers as readonly number[]).includes(power)
    ? span(params.factors[0], params.factors[1]).filter((f) => f * power <= params.resultMax)
    : [];
  if (factors.length === 0) throw cannotPractise('mul.power10', item);
  return product(problems.pick(factors), power, problems.bool());
}

export function tensProblem(
  params: DeepReadonly<MulTensParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const bucket = bucketOf(item, 'tens');
  const digit = bucket !== null && /^d\d$/.test(bucket) ? Number(bucket.slice(1)) : 0;
  const tens = params.digits.includes(digit)
    ? span(params.tens[0], params.tens[1]).filter((t) => t * 10 * digit <= params.resultMax)
    : [];
  if (tens.length === 0) throw cannotPractise('mul.tens', item);
  return product(problems.pick(tens) * 10, digit, problems.bool());
}

/** A carry from the ones into the tens: `14 · 3` (4 · 3 = 12) carries, `23 · 3` does not. */
export function carries(twoDigit: number, oneDigit: number): boolean {
  return (twoDigit % 10) * oneDigit >= 10;
}

/** The two-digit factors that fit `oneDigit` for the wanted carry, round tens only as a last resort. */
function twoDigitFactors(
  params: DeepReadonly<Mul2d1dParams>,
  oneDigit: number,
  carry: boolean,
): number[] {
  const fitting = span(params.twoDigit[0], params.twoDigit[1]).filter(
    (a) => a * oneDigit <= params.resultMax && carries(a, oneDigit) === carry,
  );
  const unround = fitting.filter((a) => a % 10 !== 0);
  return unround.length > 0 ? unround : fitting;
}

export function mul2d1dProblem(
  params: DeepReadonly<Mul2d1dParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const bucket = bucketOf(item, 'mul2d1d');
  const carry = bucket === 'carry';
  const allowed =
    (bucket === 'carry' || bucket === 'nocarry') &&
    (params.carry === 'allowed' || (params.carry === 'required') === carry);
  const oneDigits = allowed
    ? span(params.oneDigit[0], params.oneDigit[1]).filter(
        (b) => twoDigitFactors(params, b, carry).length > 0,
      )
    : [];
  if (oneDigits.length === 0) throw cannotPractise('mul.2d1d', item);
  const oneDigit = problems.pick(oneDigits);
  return product(problems.pick(twoDigitFactors(params, oneDigit, carry)), oneDigit, false);
}

/** Regrouping: the tens are not a multiple of the divisor (`48 : 3` regroups, `69 : 3` does not). */
export function regroups(dividend: number, divisor: number): boolean {
  return ((dividend - (dividend % 10)) / 10) % divisor !== 0;
}

interface Division {
  quotient: number;
  remainder: number;
}

function divisions(
  params: DeepReadonly<Div2d1dParams>,
  divisor: number,
  regroup: boolean,
): Division[] {
  const found: Division[] = [];
  for (const quotient of span(params.quotients[0], params.quotients[1])) {
    for (const remainder of span(0, divisor - 1)) {
      const dividend = quotient * divisor + remainder;
      if (dividend < 10 || dividend > params.dividendMax) continue;
      if (!remainderAllowed(remainder, params.remainder)) continue;
      if (regroups(dividend, divisor) === regroup) found.push({ quotient, remainder });
    }
  }
  return found;
}

export function div2d1dProblem(
  params: DeepReadonly<Div2d1dParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const bucket = bucketOf(item, 'div2d1d');
  const regroup = bucket === 'regroup';
  const allowed =
    (bucket === 'regroup' || bucket === 'noregroup') &&
    (params.regroup === 'allowed' || (params.regroup === 'required') === regroup);
  const divisors = allowed
    ? params.divisors.filter((d) => divisions(params, d, regroup).length > 0)
    : [];
  if (divisors.length === 0) throw cannotPractise('div.2d1d', item);
  const divisor = problems.pick(divisors);
  const { quotient, remainder } = problems.pick(divisions(params, divisor, regroup));
  const dividend = quotient * divisor + remainder;
  return params.remainder === 'forbidden'
    ? { kind: 'equation', left: op('div', num(dividend), num(divisor)), right: BLANK }
    : { kind: 'divrem', dividend, divisor };
}
