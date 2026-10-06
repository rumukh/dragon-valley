/**
 * How the shell writes problems. The notation tables and the reference text come from the
 * domain contract (`src/rules/contract/notation.ts`); this module adds what a screen needs on
 * top: problems as styled tokens (numbers, signs, brackets, answer boxes, a highlighted number)
 * and a problem written out with its answer filled in.
 *
 * | Meaning          | Czech            | International    |
 * | ---------------- | ---------------- | ---------------- |
 * | multiplication   | `3 · 4 = 12`     | `3 × 4 = 12`     |
 * | division         | `12 : 3 = 4`     | `12 ÷ 3 = 4`     |
 * | with remainder   | `23 : 5 = 4 r 3` | `23 ÷ 5 = 4 R 3` |
 */
import {
  DEFAULT_NOTATION,
  formatAnswer,
  formatProblem,
  needsGroup,
  NOTATIONS,
  OPERATOR_SYMBOLS,
  REMAINDER_SYMBOLS,
} from '../../rules/contract';
import type { AnswerValue, Expr, Notation, Problem } from '../../rules/contract';

export { DEFAULT_NOTATION, formatAnswer, formatProblem, NOTATIONS };
export type { Notation };

/** A rendered piece of a problem, so the DOM can style numbers, signs and answer boxes. */
export type Token =
  | { readonly kind: 'number'; readonly text: string; readonly highlight?: boolean }
  | { readonly kind: 'sign'; readonly text: string }
  | { readonly kind: 'bracket'; readonly text: string }
  | { readonly kind: 'blank' };

function exprTokens(expr: Expr, notation: Notation, out: Token[]): void {
  switch (expr.kind) {
    case 'num':
      out.push({ kind: 'number', text: String(expr.value) });
      return;
    case 'blank':
      out.push({ kind: 'blank' });
      return;
    case 'group':
      out.push({ kind: 'bracket', text: '(' });
      exprTokens(expr.inner, notation, out);
      out.push({ kind: 'bracket', text: ')' });
      return;
    case 'op': {
      const side = (child: Expr, which: 'left' | 'right'): void => {
        if (needsGroup(expr.op, child, which)) {
          out.push({ kind: 'bracket', text: '(' });
          exprTokens(child, notation, out);
          out.push({ kind: 'bracket', text: ')' });
        } else {
          exprTokens(child, notation, out);
        }
      };
      side(expr.left, 'left');
      out.push({ kind: 'sign', text: OPERATOR_SYMBOLS[notation][expr.op] });
      side(expr.right, 'right');
    }
  }
}

export function problemTokens(problem: Problem, notation: Notation = DEFAULT_NOTATION): Token[] {
  const out: Token[] = [];
  switch (problem.kind) {
    case 'equation':
      exprTokens(problem.left, notation, out);
      out.push({ kind: 'sign', text: '=' });
      exprTokens(problem.right, notation, out);
      return out;
    case 'divrem':
      out.push(
        { kind: 'number', text: String(problem.dividend) },
        { kind: 'sign', text: OPERATOR_SYMBOLS[notation].div },
        { kind: 'number', text: String(problem.divisor) },
        { kind: 'sign', text: '=' },
        { kind: 'blank' },
        { kind: 'sign', text: REMAINDER_SYMBOLS[notation] },
        { kind: 'blank' },
      );
      return out;
    case 'compare':
      exprTokens(problem.left, notation, out);
      out.push({ kind: 'blank' });
      exprTokens(problem.right, notation, out);
      return out;
    case 'word':
      // The story is catalog text the screen shows above; the tokens are its arithmetic.
      return problemTokens(problem.model, notation);
    case 'term': {
      const { sentence, highlight } = problem;
      const number = (value: number, part: typeof highlight): Token => ({
        kind: 'number',
        text: String(value),
        ...(highlight === part ? { highlight: true } : {}),
      });
      out.push(
        number(sentence.left, 'left'),
        { kind: 'sign', text: OPERATOR_SYMBOLS[notation][sentence.op] },
        number(sentence.right, 'right'),
        { kind: 'sign', text: '=' },
        number(sentence.result, 'result'),
      );
      if (sentence.remainder !== null) {
        out.push(
          { kind: 'sign', text: REMAINDER_SYMBOLS[notation] },
          number(sentence.remainder, 'remainder'),
        );
      }
      return out;
    }
  }
}

/** The problem with its blanks filled by `answer`: `7 · 8 = 56`, `23 : 5 = 4 r 3`. */
export function formatSolved(
  problem: Problem,
  answer: AnswerValue,
  notation: Notation = DEFAULT_NOTATION,
): string {
  if (problem.kind === 'word') return formatSolved(problem.model, answer, notation);
  if (problem.kind === 'term') return formatProblem(problem, notation);
  const fills =
    answer.kind === 'remainder'
      ? [String(answer.quotient), String(answer.remainder)]
      : [formatAnswer(answer, notation)];
  let next = 0;
  return problemTokens(problem, notation)
    .map((token) => (token.kind === 'blank' ? (fills[next++] ?? '?') : token.text))
    .join(' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')');
}
