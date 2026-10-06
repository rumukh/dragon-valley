/**
 * Arithmetic on expression trees for generators and distractors: the ways a child may misread an
 * expression (strictly left to right, ignoring brackets, stopping after one step) and the
 * operator swaps behind the classic word-problem mistakes. Every function returns `null` for a
 * value that is not a non-negative integer, like the contract's `evaluate`.
 */
import { MAX_PROBLEM_NUMBER, evaluate, group, needsGroup, op, precedence } from '../../contract';
import type { Expr, Operator } from '../../contract';

/** One step of integer arithmetic, or `null` when it leaves the non-negative integers. */
export function apply(operator: Operator, left: number, right: number): number | null {
  let value: number;
  if (operator === 'add') value = left + right;
  else if (operator === 'sub') value = left - right;
  else if (operator === 'mul') value = left * right;
  else {
    if (right === 0 || left % right !== 0) return null;
    value = left / right;
  }
  return value >= 0 && value <= MAX_PROBLEM_NUMBER ? value : null;
}

export type Token = number | Operator;

/** The numbers and operators of a blank-free expression in reading order, brackets dropped. */
export function tokensOf(expr: Expr): Token[] | null {
  switch (expr.kind) {
    case 'num':
      return [expr.value];
    case 'blank':
      return null;
    case 'group':
      return tokensOf(expr.inner);
    case 'op': {
      const left = tokensOf(expr.left);
      const right = tokensOf(expr.right);
      return left && right ? [...left, expr.op, ...right] : null;
    }
  }
}

/** The value when every operation is done strictly from left to right. */
export function leftToRight(tokens: readonly Token[]): number | null {
  let value = tokens[0];
  if (typeof value !== 'number') return null;
  for (let i = 1; i + 1 < tokens.length; i += 2) {
    const operator = tokens[i] as Operator;
    const next = tokens[i + 1] as number;
    const result: number | null = apply(operator, value, next);
    if (result === null) return null;
    value = result;
  }
  return value;
}

/** The value of the written tokens with · and : first, ignoring any brackets. */
export function withoutBrackets(tokens: readonly Token[]): number | null {
  const terms: Token[] = [tokens[0]!];
  for (let i = 1; i + 1 < tokens.length; i += 2) {
    const operator = tokens[i] as Operator;
    const next = tokens[i + 1] as number;
    if (precedence(operator) === 2) {
      const previous = terms.pop() as number;
      const result = apply(operator, previous, next);
      if (result === null) return null;
      terms.push(result);
    } else {
      terms.push(operator, next);
    }
  }
  return leftToRight(terms);
}

/** The value of every operation inside the expression except the whole (a step stopped early). */
export function partialValues(expr: Expr): number[] {
  const values: number[] = [];
  const visit = (node: Expr, top: boolean) => {
    if (node.kind === 'group') return visit(node.inner, top);
    if (node.kind !== 'op') return;
    visit(node.left, false);
    visit(node.right, false);
    if (!top) {
      const value = evaluate(node);
      if (value !== null) values.push(value);
    }
  };
  visit(expr, true);
  return values;
}

/**
 * The expression with the operator at in-order position `index` replaced by `operator`. Brackets
 * are recomputed for the new tree, so the result reads as the child would write it.
 */
export function withOperator(expr: Expr, index: number, operator: Operator): Expr {
  let position = 0;
  const rebuild = (node: Expr): Expr => {
    if (node.kind === 'group') return rebuild(node.inner);
    if (node.kind !== 'op') return node;
    const left = rebuild(node.left);
    const mine = position++;
    const right = rebuild(node.right);
    return op(mine === index ? operator : node.op, left, right);
  };
  return withGroups(rebuild(expr));
}

/** The operators of an expression in reading order. */
export function operatorsOf(expr: Expr): Operator[] {
  if (expr.kind === 'group') return operatorsOf(expr.inner);
  if (expr.kind !== 'op') return [];
  return [...operatorsOf(expr.left), expr.op, ...operatorsOf(expr.right)];
}

/**
 * The tree with explicit brackets wherever the conventional reading needs them (`needsGroup`),
 * and nowhere else: `(2 + 3) · 4`, `24 : (6 − 2)`, `8 − (3 − 1)`.
 */
export function withGroups(expr: Expr): Expr {
  if (expr.kind === 'group') return withGroups(expr.inner);
  if (expr.kind !== 'op') return expr;
  const side = (child: Expr, which: 'left' | 'right') => {
    const inner = withGroups(child);
    return needsGroup(expr.op, inner, which) ? group(inner) : inner;
  };
  return op(expr.op, side(expr.left, 'left'), side(expr.right, 'right'));
}

/** How many bracket pairs an expression shows, and whether one sits inside another. */
export function bracketsOf(expr: Expr): { pairs: number; nested: boolean } {
  let pairs = 0;
  let nested = false;
  const visit = (node: Expr, inside: boolean) => {
    if (node.kind === 'group') {
      pairs += 1;
      if (inside) nested = true;
      visit(node.inner, true);
    } else if (node.kind === 'op') {
      visit(node.left, inside);
      visit(node.right, inside);
    }
  };
  visit(expr, false);
  return { pairs, nested };
}
