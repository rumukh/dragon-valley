/**
 * Reference rendering of problems as plain text in either notation.
 *
 * Czech school notation is the default; a parent setting switches to international notation.
 *
 * | Meaning              | Czech          | International  |
 * | -------------------- | -------------- | -------------- |
 * | multiplication       | `3 · 4 = 12`   | `3 × 4 = 12`   |
 * | division             | `12 : 3 = 4`   | `12 ÷ 3 = 4`   |
 * | with remainder       | `23 : 5 = 4 r 3` | `23 ÷ 5 = 4 R 3` |
 * | brackets, comparison | `(2 + 3) · 4`, `<` `>` `=` | same symbols |
 *
 * The shell renders problems as styled DOM/SVG and the verbalizer speaks them; this module is the
 * shared, DOM-free reference for both (and for tests and accessible labels). Notation is a
 * presentation preference: it is never part of the game state or a hash.
 */
import { needsGroup } from './problems';
import type { AnswerValue, Expr, Problem } from './problems';
import type { Operator, Relation } from './kinds';
import type { CardFace } from './minigames';

export const NOTATIONS = ['czech', 'international'] as const;
export type Notation = (typeof NOTATIONS)[number];
export const DEFAULT_NOTATION: Notation = 'czech';

const MINUS = '\u2212';

export const OPERATOR_SYMBOLS: Readonly<Record<Notation, Readonly<Record<Operator, string>>>> = {
  czech: { add: '+', sub: MINUS, mul: '\u00b7', div: ':' },
  international: { add: '+', sub: MINUS, mul: '\u00d7', div: '\u00f7' },
};
export const REMAINDER_SYMBOLS: Readonly<Record<Notation, string>> = {
  czech: 'r',
  international: 'R',
};
export const RELATION_SYMBOLS: Readonly<Record<Relation, string>> = { lt: '<', gt: '>', eq: '=' };
/** Shown where the child's answer goes. The shell draws a box instead. */
export const BLANK_SYMBOL = '?';

export function formatExpr(expr: Expr, notation: Notation = DEFAULT_NOTATION): string {
  switch (expr.kind) {
    case 'num':
      return String(expr.value);
    case 'blank':
      return BLANK_SYMBOL;
    case 'group':
      return `(${formatExpr(expr.inner, notation)})`;
    case 'op': {
      const side = (child: Expr, which: 'left' | 'right') =>
        needsGroup(expr.op, child, which)
          ? `(${formatExpr(child, notation)})`
          : formatExpr(child, notation);
      return `${side(expr.left, 'left')} ${OPERATOR_SYMBOLS[notation][expr.op]} ${side(expr.right, 'right')}`;
    }
  }
}

/** Text of a problem. Word problems render their arithmetic model (the story is in catalogs). */
export function formatProblem(problem: Problem, notation: Notation = DEFAULT_NOTATION): string {
  switch (problem.kind) {
    case 'equation':
      return `${formatExpr(problem.left, notation)} = ${formatExpr(problem.right, notation)}`;
    case 'divrem':
      return `${problem.dividend} ${OPERATOR_SYMBOLS[notation].div} ${problem.divisor} = ${BLANK_SYMBOL} ${REMAINDER_SYMBOLS[notation]} ${BLANK_SYMBOL}`;
    case 'compare':
      return `${formatExpr(problem.left, notation)} ${BLANK_SYMBOL} ${formatExpr(problem.right, notation)}`;
    case 'word':
      return formatProblem(problem.model, notation);
    case 'term': {
      const { sentence } = problem;
      const remainder =
        sentence.remainder === null ? '' : ` ${REMAINDER_SYMBOLS[notation]} ${sentence.remainder}`;
      return `${sentence.left} ${OPERATOR_SYMBOLS[notation][sentence.op]} ${sentence.right} = ${sentence.result}${remainder}`;
    }
  }
}

export function formatAnswer(answer: AnswerValue, notation: Notation = DEFAULT_NOTATION): string {
  switch (answer.kind) {
    case 'number':
      return String(answer.value);
    case 'remainder':
      return `${answer.quotient} ${REMAINDER_SYMBOLS[notation]} ${answer.remainder}`;
    case 'relation':
      return RELATION_SYMBOLS[answer.relation];
    case 'operation':
      return OPERATOR_SYMBOLS[notation][answer.operation];
    case 'term':
      return answer.term;
  }
}

/** Text of a minigame card or stone face (minigames.ts). Highlights are the shell's styling. */
export function formatFace(face: CardFace, notation: Notation = DEFAULT_NOTATION): string {
  switch (face.kind) {
    case 'expr':
      return formatExpr(face.expr, notation);
    case 'answer':
      return formatAnswer(face.answer, notation);
    case 'sentence':
      return formatProblem(
        { kind: 'term', sentence: face.sentence, highlight: 'result' },
        notation,
      );
  }
}
