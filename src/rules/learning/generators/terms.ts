/**
 * Terms (`terms`): name the highlighted number of a true sentence. Items: `terms:<term>`.
 *
 * - `factor`, `product`: `6 · 7 = 42` with a factor or the product highlighted;
 * - `dividend`, `divisor`, `quotient`: `42 : 6 = 7` with that number highlighted;
 * - `remainder`: `23 : 5 = 4 r 3` with the remainder highlighted (dividend at most 99).
 *
 * Sentences come from the skill's tables, using factors, divisors and quotients 2-10 so that no
 * sentence is trivial (a skill with only the 0 and 1 tables uses the tables 2-10 instead), and
 * the highlighted number appears nowhere else in the sentence, so the term is unambiguous.
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { TERMS, parseItemId } from '../../contract';
import type { Problem, Term, TermProblem, TermsParams } from '../../contract';
import { cannotPractise, span } from './shared';

type Sentence = TermProblem['sentence'];
type Highlight = TermProblem['highlight'];

function numbersBesides(sentence: Sentence, highlight: Highlight): number[] {
  const all: Record<Highlight, number | null> = {
    left: sentence.left,
    right: sentence.right,
    result: sentence.result,
    remainder: sentence.remainder,
  };
  return (Object.keys(all) as Highlight[])
    .filter((key) => key !== highlight && all[key] !== null)
    .map((key) => all[key]!);
}

/** Every sentence for `term` with the first number from `table`, as [sentence, highlight] pairs. */
function sentences(term: Term, table: number): [Sentence, Highlight][] {
  const out: [Sentence, Highlight][] = [];
  if (term === 'factor' || term === 'product') {
    for (const other of span(2, 10)) {
      for (const [left, right] of [
        [table, other],
        [other, table],
      ] as const) {
        const sentence = { op: 'mul' as const, left, right, result: left * right, remainder: null };
        if (term === 'product') out.push([sentence, 'result']);
        else out.push([sentence, 'left'], [sentence, 'right']);
      }
    }
  } else if (term === 'remainder') {
    // Quotients 1-9 and divisors up to 10 keep the dividend at most 99.
    for (const quotient of span(1, 9)) {
      for (const remainder of span(1, table - 1)) {
        const sentence = {
          op: 'div' as const,
          left: quotient * table + remainder,
          right: table,
          result: quotient,
          remainder,
        };
        out.push([sentence, 'remainder']);
      }
    }
  } else {
    const highlight: Highlight =
      term === 'dividend' ? 'left' : term === 'divisor' ? 'right' : 'result';
    for (const quotient of span(2, 10)) {
      const sentence = {
        op: 'div' as const,
        left: quotient * table,
        right: table,
        result: quotient,
        remainder: null,
      };
      out.push([sentence, highlight]);
    }
  }
  return out.filter(([sentence, highlight]) => {
    const value = highlight === 'remainder' ? sentence.remainder : sentence[highlight];
    return !numbersBesides(sentence, highlight).includes(value!);
  });
}

export function termProblem(
  params: DeepReadonly<TermsParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const parsed = parseItemId(item);
  const term = (TERMS as readonly string[]).find(
    (t) => parsed?.kind === 'bucket' && parsed.family === 'terms' && parsed.bucket === t,
  ) as Term | undefined;
  if (term === undefined || !params.terms.includes(term)) throw cannotPractise('terms', item);
  const usable = params.tables.filter((t) => t >= 2);
  const tables = (usable.length > 0 ? usable : span(2, 10)).filter(
    (t) => sentences(term, t).length > 0,
  );
  if (tables.length === 0) throw cannotPractise('terms', item);
  const [sentence, highlight] = problems.pick(sentences(term, problems.pick(tables)));
  return { kind: 'term', sentence, highlight };
}
