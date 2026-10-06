/**
 * Small-table facts: `mul.fact` (`7 · 8 = ?`), `div.fact` (`56 : 7 = ?`) and `mul.missing`
 * (`? · 7 = 56`, which practises the division fact `div:56:7`). The item is the fact itself, so
 * only the missing factor's position is drawn.
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { BLANK, num, op, parseItemId } from '../../contract';
import type { MulMissingParams, Problem } from '../../contract';
import { cannotPractise } from './shared';

export function mulFactProblem(item: string): Problem {
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'mul') throw cannotPractise('mul.fact', item);
  return { kind: 'equation', left: op('mul', num(parsed.a), num(parsed.b)), right: BLANK };
}

export function divFactProblem(item: string): Problem {
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'div') throw cannotPractise('div.fact', item);
  return {
    kind: 'equation',
    left: op('div', num(parsed.dividend), num(parsed.divisor)),
    right: BLANK,
  };
}

export function missingFactorProblem(
  params: DeepReadonly<MulMissingParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'div' || parsed.divisor === 0) throw cannotPractise('mul.missing', item);
  const first = params.position === 'first' || (params.position === 'both' && problems.bool());
  const known = num(parsed.divisor);
  return {
    kind: 'equation',
    left: first ? op('mul', BLANK, known) : op('mul', known, BLANK),
    right: num(parsed.dividend),
  };
}
