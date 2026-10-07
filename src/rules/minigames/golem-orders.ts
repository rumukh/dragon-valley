/**
 * Golem Orders (`dv.golem-orders`): the Golem only moves when told what to do first. An
 * expression is shown as a row of gears; the child picks the operation that goes first, says its
 * result, and the expression shrinks, until one number is left.
 *
 * Config `{ expr }` (no blanks, every step a whole number); moves `{ type: 'pick', path }` (a path
 * of `left`, `right` and `inner` steps from the root to an operation) and `{ type: 'answer',
 * value }` for the picked operation. A pick that is not first yet answers `not-first`; a wrong
 * value `wrong-value`. Nothing is lost.
 *
 * The expression is always worked out the way it reads (`readsAsComputed`): brackets only where
 * they are written, · and : before + and −, operations of one rank from left to right. So
 * `60 + 6 + 45 : 5` is the tree `(60 + 6) + 45 : 5`, never `60 + (6 + 45 : 5)`, and the
 * operations that may go next (`readyOperations`) follow the textbook order: inside brackets first
 * (the innermost pair that still holds an operation; separate pairs in either order), then, within
 * a pair or once none is left, · and : before + and −, from left to right. Independent operations
 * of the same rank may go in either order (`2 · 3 + 4 · 5`); in a chain like `8 − 3 + 2` only the
 * left step is ready.
 */
import type { MinigameAdapter } from '@aegis/narrative';
import { countBlanks, evaluate, exprSchema, num, precedence } from '../contract';
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
 * Whether the tree is the expression as it reads: no operand is an unbracketed operation that
 * binds more loosely than its parent, and no right operand an unbracketed one of the same rank
 * (a reader works `60 + 6 + 9` from the left, so the tree `60 + (6 + 9)` would refuse the step a
 * child rightly takes first).
 */
export function readsAsComputed(expr: Expr): boolean {
  if (expr.kind === 'group') return readsAsComputed(expr.inner);
  if (expr.kind !== 'op') return true;
  const rank = precedence(expr.op);
  const { left, right } = expr;
  if (left.kind === 'op' && precedence(left.op) < rank) return false;
  if (right.kind === 'op' && precedence(right.op) <= rank) return false;
  return readsAsComputed(left) && readsAsComputed(right);
}

/** The same tree with brackets written wherever it would otherwise read differently. */
export function bracketed(expr: Expr): Expr {
  if (expr.kind === 'group') return { kind: 'group', inner: bracketed(expr.inner) };
  if (expr.kind !== 'op') return expr;
  const rank = precedence(expr.op);
  const left = bracketed(expr.left);
  const right = bracketed(expr.right);
  return {
    ...expr,
    left: left.kind === 'op' && precedence(left.op) < rank ? { kind: 'group', inner: left } : left,
    right:
      right.kind === 'op' && precedence(right.op) <= rank ? { kind: 'group', inner: right } : right,
  };
}

/**
 * The operations that may go next, each as a path from the root: inside brackets first (the
 * innermost pairs that still hold an operation, each pair on its own), then, within a pair or
 * once none is left, · and : before + and −. An operation is ready when both its numbers are
 * there; in an expression that reads as computed, the tree then also keeps each rank from left to
 * right.
 */
export function readyOperations(expr: Expr): ExprPath[] {
  return nextInScope(expr, []);
}

/** The next operations within one pair of brackets (or the whole expression). */
function nextInScope(scope: Expr, at: ExprPath): ExprPath[] {
  const pairs: { inner: Expr; path: ExprPath }[] = [];
  const ready: { path: ExprPath; strong: boolean }[] = [];
  const visit = (node: Expr, path: ExprPath): void => {
    if (node.kind === 'group') {
      if (!isNumber(node.inner)) pairs.push({ inner: node.inner, path: [...path, 'inner'] });
    } else if (node.kind === 'op') {
      if (isNumber(node.left) && isNumber(node.right)) {
        ready.push({ path, strong: node.op === 'mul' || node.op === 'div' });
      }
      visit(node.left, [...path, 'left']);
      visit(node.right, [...path, 'right']);
    }
  };
  visit(scope, at);
  if (pairs.length > 0) return pairs.flatMap((pair) => nextInScope(pair.inner, pair.path));
  const strong = ready.filter((r) => r.strong);
  return (strong.length > 0 ? strong : ready).map((r) => r.path);
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
  if (!readsAsComputed(parsed.value)) {
    invalid(path, 'The expression must be worked out the way it reads.');
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
