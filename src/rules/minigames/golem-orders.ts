/**
 * Golem Orders (`dv.golem-orders`): the Golem only moves when told what to do first. An
 * expression is shown as a row of gears; the child picks the operation that goes first (inside
 * brackets first, then · and :, then + and −, left to right), says its result, and the expression
 * shrinks, until one number is left.
 *
 * Config `{ expr }` (no blanks, every step a whole number); moves `{ type: 'pick', path }` (a path
 * of `left`, `right` and `inner` steps from the root to an operation) and `{ type: 'answer',
 * value }` for the picked operation. Independent operations of the same rank may go in either
 * order (`2 · 3 + 4 · 5`); a chain like `8 − 3 + 2` is a tree, so only its left step is ready. A
 * pick that is not first yet answers `not-first`; a wrong value `wrong-value`. Nothing is lost.
 */
import type { MinigameAdapter } from '@aegis/narrative';
import { countBlanks, evaluate, exprSchema, num } from '../contract';
import type { Expr, ExprPath, GolemOrdersBoard, GolemOrdersMove } from '../contract';
import { array, integer, invalid, literal, object } from './decode';

export const GOLEM_ORDERS_KIND = 'dv.golem-orders';

export interface GolemOrdersConfig {
  expr: Expr;
}

export interface GolemOrdersState {
  expr: Expr;
  picked: ExprPath | null;
  last: 'right' | 'not-first' | 'wrong-value' | null;
  steps: number;
  mistakes: number;
}

const STEPS = ['left', 'right', 'inner'] as const;

export function operations(expr: Expr): number {
  if (expr.kind === 'op') return 1 + operations(expr.left) + operations(expr.right);
  if (expr.kind === 'group') return operations(expr.inner);
  return 0;
}

export function nodeAt(expr: Expr, path: ExprPath): Expr | null {
  let node: Expr = expr;
  for (const step of path) {
    if (step === 'inner' && node.kind === 'group') node = node.inner;
    else if (step !== 'inner' && node.kind === 'op') node = node[step];
    else return null;
  }
  return node;
}

/** A plain number, or brackets around one (they disappear once the number is all that is left). */
function isNumber(node: Expr): boolean {
  return node.kind === 'num' || (node.kind === 'group' && isNumber(node.inner));
}

/**
 * The operations that may go next: operations of two plain numbers, of the best rank (inside
 * brackets before outside, · and : before + and −). Each is a path from the root.
 */
export function readyOperations(expr: Expr): ExprPath[] {
  const found: { path: ExprPath; rank: number }[] = [];
  const visit = (node: Expr, path: ExprPath, inGroup: boolean) => {
    if (node.kind === 'group') visit(node.inner, [...path, 'inner'], true);
    else if (node.kind === 'op') {
      if (isNumber(node.left) && isNumber(node.right)) {
        const rank = (inGroup ? 0 : 2) + (node.op === 'mul' || node.op === 'div' ? 0 : 1);
        found.push({ path, rank });
      }
      visit(node.left, [...path, 'left'], inGroup);
      visit(node.right, [...path, 'right'], inGroup);
    }
  };
  visit(expr, [], false);
  let best = 4;
  for (const entry of found) best = Math.min(best, entry.rank);
  return found.filter((f) => f.rank === best).map((f) => f.path);
}

const samePath = (a: ExprPath, b: ExprPath) =>
  a.length === b.length && a.every((step, i) => step === b[i]);

/** Replace the node at `path` with the number `value`, dropping brackets around a lone number. */
export function reduceAt(expr: Expr, path: ExprPath, value: number): Expr {
  const replace = (node: Expr, rest: ExprPath): Expr => {
    if (rest.length === 0) return num(value);
    const [step, ...tail] = rest;
    if (node.kind === 'group' && step === 'inner') {
      const inner = replace(node.inner, tail);
      return inner.kind === 'num' ? inner : { kind: 'group', inner };
    }
    if (node.kind === 'op' && step === 'left') return { ...node, left: replace(node.left, tail) };
    if (node.kind === 'op' && step === 'right') {
      return { ...node, right: replace(node.right, tail) };
    }
    return node;
  };
  return replace(expr, path);
}

function decodeExpr(value: unknown, path: string): Expr {
  const parsed = exprSchema.parse(value, path);
  if (!parsed.ok) invalid(path, 'Expected an expression.');
  if (countBlanks(parsed.value) > 0 || evaluate(parsed.value) === null) {
    invalid(path, 'The expression must work out to a whole number.');
  }
  return parsed.value;
}

function decodePath(value: unknown, path: string): ExprPath {
  return array(value, path, { min: 0, max: 16 }).map((step, i) =>
    literal(step, `${path}[${i}]`, STEPS),
  );
}

export const golemOrdersAdapter: MinigameAdapter<
  GolemOrdersConfig,
  GolemOrdersState,
  GolemOrdersMove,
  Omit<GolemOrdersBoard, 'kind'>
> = {
  kind: GOLEM_ORDERS_KIND,
  schema: 1,
  config(value) {
    const o = object(value, '$.config', ['expr']);
    const expr = decodeExpr(o.expr, '$.config.expr');
    if (operations(expr) === 0) invalid('$.config.expr', 'Give the Golem at least one step.');
    return { expr };
  },
  state(value, config) {
    const o = object(value, '$.progress', ['expr', 'picked', 'last', 'steps', 'mistakes']);
    const expr = decodeExpr(o.expr, '$.progress.expr');
    const steps = integer(o.steps, '$.progress.steps', 0, 64);
    if (
      evaluate(expr) !== evaluate(config.expr) ||
      operations(expr) !== operations(config.expr) - steps
    ) {
      invalid('$.progress.expr', 'This expression is not where the Golem got to.');
    }
    const picked = o.picked === null ? null : decodePath(o.picked, '$.progress.picked');
    if (picked !== null && !readyOperations(expr).some((p) => samePath(p, picked))) {
      invalid('$.progress.picked', 'That operation is not ready.');
    }
    return {
      expr,
      picked,
      last:
        o.last === null
          ? null
          : literal(o.last, '$.progress.last', ['right', 'not-first', 'wrong-value'] as const),
      steps,
      mistakes: integer(o.mistakes, '$.progress.mistakes', 0, 1_000_000),
    };
  },
  action(value) {
    const o = object(value, '$.move', ['type', 'path', 'value']);
    const type = literal(o.type, '$.move.type', ['pick', 'answer'] as const);
    if (type === 'pick') {
      object(value, '$.move', ['type', 'path']);
      return { type, path: decodePath(o.path, '$.move.path') };
    }
    object(value, '$.move', ['type', 'value']);
    return { type, value: integer(o.value, '$.move.value', 0, 100_000) };
  },
  initial: (config) => ({
    expr: config.expr,
    picked: null,
    last: null,
    steps: 0,
    mistakes: 0,
  }),
  reduce(config, state, move) {
    if (move.type === 'pick') {
      const node = nodeAt(state.expr, move.path);
      if (node === null || node.kind !== 'op') invalid('$.move.path', 'Pick an operation.');
      return readyOperations(state.expr).some((p) => samePath(p, move.path))
        ? { ...state, picked: move.path, last: null }
        : { ...state, last: 'not-first', mistakes: state.mistakes + 1 };
    }
    if (state.picked === null) invalid('$.move', 'Pick the operation that goes first.');
    const result = evaluate(nodeAt(state.expr, state.picked)!);
    if (move.value !== result) {
      return { ...state, last: 'wrong-value', mistakes: state.mistakes + 1 };
    }
    return {
      ...state,
      expr: reduceAt(state.expr, state.picked, result),
      picked: null,
      last: 'right',
      steps: state.steps + 1,
    };
  },
  project: (config, state) => ({
    expr: state.expr,
    start: config.expr,
    picked: state.picked,
    last: state.last,
    steps: state.steps,
    mistakes: state.mistakes,
  }),
  completed: (config, state) => state.expr.kind === 'num',
};
