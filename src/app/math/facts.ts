/**
 * Small-table facts as text, for the grown-ups' area and the printables: `mul:7x8` is `7 · 8`
 * with the answer `56`, `div:56:7` is `56 : 7` with the answer `8` (or `×`, `÷` in international
 * notation). Other items (remainder buckets, word problems, terms) are skills rather than single
 * facts and have no question and answer of their own.
 */
import { OPERATOR_SYMBOLS, parseItemId } from '../../rules/contract';
import type { Notation } from '../../rules/contract';

export interface FactText {
  readonly item: string;
  /** `7 · 8` */
  readonly question: string;
  /** `56` */
  readonly answer: string;
  /** `7 · 8 = 56` */
  readonly sentence: string;
}

/** The fact behind a small-table item, or `null` for any other item. */
export function factText(item: string, notation: Notation): FactText | null {
  const parsed = parseItemId(item);
  if (parsed === null || parsed.kind === 'bucket') return null;
  const signs = OPERATOR_SYMBOLS[notation];
  const question =
    parsed.kind === 'mul'
      ? `${parsed.a} ${signs.mul} ${parsed.b}`
      : `${parsed.dividend} ${signs.div} ${parsed.divisor}`;
  const answer = String(parsed.kind === 'mul' ? parsed.product : parsed.quotient);
  return { item, question, answer, sentence: `${question} = ${answer}` };
}
