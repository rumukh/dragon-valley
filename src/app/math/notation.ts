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
import type {
  AnswerValue,
  DivRemProblem,
  EquationProblem,
  Expr,
  ExprPath,
  Notation,
  Problem,
  ProblemStep,
} from '../../rules/contract';

export { DEFAULT_NOTATION, formatAnswer, formatProblem, NOTATIONS };
export type { Notation };

/**
 * A rendered piece of a problem, so the DOM can style numbers, signs and answer boxes. A `slot`
 * is the empty place of the sign the child is asked to choose (a story's operation step).
 */
export type Token =
  | { readonly kind: 'number'; readonly text: string; readonly highlight?: boolean }
  | { readonly kind: 'sign'; readonly text: string }
  | { readonly kind: 'bracket'; readonly text: string }
  | { readonly kind: 'blank' }
  | { readonly kind: 'slot' };

/** How an empty sign slot is written in plain text. */
export const SLOT_SYMBOL = '\u25cb';

function exprTokens(expr: Expr, notation: Notation, out: Token[], slot = false): void {
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
      out.push(
        slot ? { kind: 'slot' } : { kind: 'sign', text: OPERATOR_SYMBOLS[notation][expr.op] },
      );
      side(expr.right, 'right');
    }
  }
}

/**
 * A story's model while the child picks its operation: the operation's sign is an empty slot
 * (`5 ○ 4 = ?`), and a leftover story asks only `23 ○ 5 = ?`, since its "r ?" would give the
 * sign away.
 */
function operationTokens(model: EquationProblem | DivRemProblem, notation: Notation): Token[] {
  const out: Token[] = [];
  if (model.kind === 'divrem') {
    out.push(
      { kind: 'number', text: String(model.dividend) },
      { kind: 'slot' },
      { kind: 'number', text: String(model.divisor) },
      { kind: 'sign', text: '=' },
      { kind: 'blank' },
    );
    return out;
  }
  const leftHasSign = model.left.kind === 'op';
  exprTokens(model.left, notation, out, leftHasSign);
  out.push({ kind: 'sign', text: '=' });
  exprTokens(model.right, notation, out, !leftHasSign && model.right.kind === 'op');
  return out;
}

/** The problem as tokens; at a story's `operation` step its sign is left out (a `slot`). */
export function problemTokens(
  problem: Problem,
  notation: Notation = DEFAULT_NOTATION,
  step: ProblemStep = 'answer',
): Token[] {
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
      return step === 'operation' && problem.operation !== null
        ? operationTokens(problem.model, notation)
        : problemTokens(problem.model, notation);
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

/**
 * A number, sign or bracket of an expression with the path of the node it belongs to (Golem
 * Orders): a sign's path is its operation's, so tapping the sign picks that operation, and every
 * token of an operation's part of the line lies at or below its path.
 */
export interface PathToken {
  readonly kind: 'number' | 'sign' | 'bracket';
  readonly text: string;
  readonly path: ExprPath;
}

export function pathTokens(expr: Expr, notation: Notation = DEFAULT_NOTATION): PathToken[] {
  const out: PathToken[] = [];
  const brackets = (child: Expr, path: ExprPath): void => {
    out.push({ kind: 'bracket', text: '(', path });
    visit(child, path);
    out.push({ kind: 'bracket', text: ')', path });
  };
  const visit = (node: Expr, path: ExprPath): void => {
    switch (node.kind) {
      case 'num':
        out.push({ kind: 'number', text: String(node.value), path });
        return;
      case 'blank':
        out.push({ kind: 'number', text: '?', path });
        return;
      case 'group':
        out.push({ kind: 'bracket', text: '(', path });
        visit(node.inner, [...path, 'inner']);
        out.push({ kind: 'bracket', text: ')', path });
        return;
      case 'op': {
        const side = (child: Expr, which: 'left' | 'right'): void => {
          if (needsGroup(node.op, child, which)) brackets(child, [...path, which]);
          else visit(child, [...path, which]);
        };
        side(node.left, 'left');
        out.push({ kind: 'sign', text: OPERATOR_SYMBOLS[notation][node.op], path });
        side(node.right, 'right');
      }
    }
  };
  visit(expr, []);
  return out;
}

export function samePath(a: ExprPath, b: ExprPath): boolean {
  return a.length === b.length && a.every((step, index) => step === b[index]);
}

/** True when `path` is `prefix` itself or lies below it. */
export function isWithin(path: ExprPath, prefix: ExprPath): boolean {
  return prefix.length <= path.length && prefix.every((step, index) => path[index] === step);
}

/** The node at `path`, or null when the path leads nowhere. */
export function exprAt(expr: Expr, path: ExprPath): Expr | null {
  let node: Expr = expr;
  for (const step of path) {
    if (step === 'inner' && node.kind === 'group') node = node.inner;
    else if (step !== 'inner' && node.kind === 'op') node = node[step];
    else return null;
  }
  return node;
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
    .map((token) =>
      token.kind === 'blank'
        ? (fills[next++] ?? '?')
        : token.kind === 'slot'
          ? SLOT_SYMBOL
          : token.text,
    )
    .join(' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')');
}
