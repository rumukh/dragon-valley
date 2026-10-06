/**
 * The picture behind a problem, shown after a miss, before a re-ask and on a hint: an array of
 * dots for a product (rows × columns), or equal groups for a division, with leftovers set apart
 * for a remainder. Only small, countable pictures are offered (at most 100 dots).
 */
import type { Expr, Problem } from '../../rules/contract';

export type ProblemModel =
  | { readonly kind: 'array'; readonly rows: number; readonly columns: number }
  | { readonly kind: 'groups'; readonly total: number; readonly size: number };

export const MAX_MODEL_DOTS = 100;

const value = (expr: Expr): number | null => (expr.kind === 'num' ? expr.value : null);

function countable(total: number, size: number): boolean {
  return size >= 1 && total >= 1 && total <= MAX_MODEL_DOTS;
}

export function modelFor(problem: Problem): ProblemModel | null {
  switch (problem.kind) {
    case 'word':
      return modelFor(problem.model);
    case 'divrem':
      return countable(problem.dividend, problem.divisor)
        ? { kind: 'groups', total: problem.dividend, size: problem.divisor }
        : null;
    case 'equation': {
      const { left, right } = problem;
      if (left.kind !== 'op') return null;
      const a = value(left.left);
      const b = value(left.right);
      if (left.op === 'mul' && right.kind === 'blank' && a !== null && b !== null) {
        return a >= 1 && b >= 1 && a <= 10 && b <= 10
          ? { kind: 'array', rows: a, columns: b }
          : null;
      }
      const product = value(right);
      if (left.op === 'mul' && product !== null) {
        // A missing factor: the product shared into groups of the known factor.
        const known = left.left.kind === 'blank' ? b : left.right.kind === 'blank' ? a : null;
        return known !== null && countable(product, known)
          ? { kind: 'groups', total: product, size: known }
          : null;
      }
      if (left.op === 'div' && right.kind === 'blank' && a !== null && b !== null) {
        return countable(a, b) ? { kind: 'groups', total: a, size: b } : null;
      }
      return null;
    }
    default:
      return null;
  }
}
