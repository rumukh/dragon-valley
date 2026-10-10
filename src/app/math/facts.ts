/**
 * Small-table facts as text, for the grown-ups' area and the printables: `add:3+4` is `3 + 4`
 * with the answer `7`, `sub:9-4` is `9 - 4` with `5`, `mul:7x8` is `7 · 8` with `56`,
 * `div:56:7` is `56 : 7` with `8` (or `×`, `÷` in international notation). Other items
 * (remainder buckets, word problems, terms) are skills rather than single facts and have no
 * question and answer of their own.
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
  let question: string;
  let value: number;
  switch (parsed.kind) {
    case 'add':
      question = `${parsed.a} ${signs.add} ${parsed.b}`;
      value = parsed.sum;
      break;
    case 'sub':
      question = `${parsed.minuend} ${signs.sub} ${parsed.subtrahend}`;
      value = parsed.difference;
      break;
    case 'mul':
      question = `${parsed.a} ${signs.mul} ${parsed.b}`;
      value = parsed.product;
      break;
    case 'div':
      question = `${parsed.dividend} ${signs.div} ${parsed.divisor}`;
      value = parsed.quotient;
      break;
  }
  const answer = String(value);
  return { item, question, answer, sentence: `${question} = ${answer}` };
}
