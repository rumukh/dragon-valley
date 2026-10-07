/**
 * Order of operations (`order.ops`): `2 + 3 · 4 = ?`, `20 − 12 : 4 = ?`, `(2 + 3) · 4 = ?`,
 * `24 : (8 − 2) = ?`. Items: `order:no-brackets` and `order:brackets`.
 *
 * A problem has 2 or 3 operations (`operations`) over the skill's `operators`. Every tree is
 * exactly how its written text is read at school (`readsAsWritten`): brackets first, then · and :,
 * then + and −, each from left to right, so a chain of the same strength is built from the left
 * (`(60 + 6) + 9`) and Golem Orders' steps follow the reading. A no-brackets problem mixes · or :
 * with + or − when the operators allow, so precedence matters. A brackets problem needs at least
 * one pair of brackets (never one pair inside another) and, whenever the numbers allow, gives a
 * different value without them.
 *
 * Numbers come from a small dynamic program: for the chosen expression shape it computes every
 * value each part can take, then draws the answer and splits it top-down, so the draw never fails
 * and every intermediate value is a non-negative integer within `resultMax` (and the 3rd-grade
 * range of 1000). Leaves come from `operands`; · and : stay inside the small tables (factors,
 * divisors and quotients 2-10), because the skill is the order, not big products. Only when the
 * parameters leave no room for that are 0, 1 and larger factors allowed.
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { BLANK, evaluate, num, op, parseItemId, precedence } from '../../contract';
import type { Expr, Operator, OrderOpsParams, Problem } from '../../contract';
import { bracketsOf, tokensOf, withGroups, withoutBrackets } from './expressions';
import { NUMBER_RANGE, cannotPractise, span } from './shared';

interface Limits {
  max: number;
  leaf: [number, number];
  factor: [number, number];
  divisor: [number, number];
  quotient: [number, number];
}

function limitsFor(params: DeepReadonly<OrderOpsParams>, strict: boolean): Limits {
  const max = Math.min(params.resultMax, NUMBER_RANGE);
  return strict
    ? {
        max,
        leaf: [Math.max(params.operands[0], 1), Math.min(params.operands[1], max)],
        factor: [2, 10],
        divisor: [2, 10],
        quotient: [2, 10],
      }
    : {
        max,
        leaf: [params.operands[0], Math.min(params.operands[1], max)],
        factor: [0, max],
        divisor: [1, max],
        quotient: [0, max],
      };
}

/** Unlabelled binary trees with `n` operations, leaves as `num(0)` placeholders. */
function shapes(n: number): Expr[] {
  if (n === 0) return [num(0)];
  const out: Expr[] = [];
  for (let leftSize = 0; leftSize < n; leftSize++) {
    for (const left of shapes(leftSize)) {
      for (const right of shapes(n - 1 - leftSize)) out.push(op('add', left, right));
    }
  }
  return out;
}

/** Every sequence of `n` operators drawn from `operators` (with repetition), in a fixed order. */
function sequences(operators: readonly Operator[], n: number): Operator[][] {
  if (n === 0) return [[]];
  return sequences(operators, n - 1).flatMap((rest) => operators.map((o) => [...rest, o]));
}

/** `shape` with its operations labelled in reading order. */
function label(shape: Expr, operators: readonly Operator[]): Expr {
  let next = 0;
  const visit = (node: Expr): Expr => {
    if (node.kind !== 'op') return node;
    const left = visit(node.left);
    const operator = operators[next++]!;
    return op(operator, left, visit(node.right));
  };
  return visit(shape);
}

/**
 * The expression shapes (with brackets marked) a problem of `n` operations may take. Bracket pairs
 * hold a single operation of two numbers (`(2 + 3) · 4`, `(12 − 4) : (1 + 1)`), as in 3rd-grade
 * textbooks, and one pair never sits inside another. When the operators allow it, brackets hold
 * an addition or a subtraction (`24 : (6 − 2)`, `20 − (8 + 3)`) rather than `24 : (6 : 2)`.
 */
function skeletons(params: DeepReadonly<OrderOpsParams>, n: number, brackets: boolean): Expr[] {
  const operators = params.operators as readonly Operator[];
  const levels = new Set(operators.map(precedence));
  const out: Expr[] = [];
  for (const shape of shapes(n)) {
    for (const sequence of sequences(operators, n)) {
      const tree = withGroups(label(shape, sequence));
      // `60 + (6 + 9)` without its brackets is written `60 + 6 + 9`, which is read `(60 + 6) + 9`.
      if (!readsAsWritten(tree)) continue;
      const { pairs, nested } = bracketsOf(tree);
      if (brackets ? pairs === 0 || nested || !simpleGroups(tree) : pairs > 0) continue;
      if (!brackets && levels.size > 1 && new Set(sequence.map(precedence)).size < 2) continue;
      out.push(tree);
    }
  }
  const additive = out.filter((tree) => groupsAdditive(tree));
  return additive.length > 0 ? additive : out;
}

/**
 * True when the tree is exactly how its written text is read at school: brackets first, then
 * · and :, then + and −, each from left to right. An operand of an operation binds at least as
 * tightly as the operation (else it is bracketed), and a right operand binds strictly more
 * tightly: a right operand of the same strength is read with the operation before it, so
 * `60 + (6 + 9)` written without brackets would be done as `(60 + 6) + 9`.
 */
export function readsAsWritten(expr: Expr): boolean {
  if (expr.kind === 'group') return readsAsWritten(expr.inner);
  if (expr.kind !== 'op') return true;
  const strength = precedence(expr.op);
  const { left, right } = expr;
  if (left.kind === 'op' && precedence(left.op) < strength) return false;
  if (right.kind === 'op' && precedence(right.op) <= strength) return false;
  return readsAsWritten(left) && readsAsWritten(right);
}

/** Every bracket pair holds one operation of two numbers. */
function simpleGroups(expr: Expr): boolean {
  if (expr.kind === 'group') {
    const inner = expr.inner;
    return inner.kind === 'op' && inner.left.kind === 'num' && inner.right.kind === 'num';
  }
  return expr.kind !== 'op' || (simpleGroups(expr.left) && simpleGroups(expr.right));
}

/** Every bracket pair holds an addition or a subtraction. */
function groupsAdditive(expr: Expr): boolean {
  if (expr.kind === 'group') return expr.inner.kind === 'op' && precedence(expr.inner.op) === 1;
  return expr.kind !== 'op' || (groupsAdditive(expr.left) && groupsAdditive(expr.right));
}

type Values = Uint8Array;

function members(values: Values, low = 0, high = values.length - 1): number[] {
  const out: number[] = [];
  for (let v = Math.max(low, 0); v <= Math.min(high, values.length - 1); v++) {
    if (values[v]) out.push(v);
  }
  return out;
}

/** Every value each part of `tree` can take under `limits`. */
function valueSets(tree: Expr, limits: Limits): Map<Expr, Values> {
  const sets = new Map<Expr, Values>();
  const visit = (node: Expr): Values => {
    const out = new Uint8Array(limits.max + 1);
    if (node.kind === 'group') {
      out.set(visit(node.inner));
    } else if (node.kind === 'num') {
      for (const v of span(limits.leaf[0], limits.leaf[1])) out[v] = 1;
    } else if (node.kind === 'op') {
      const left = visit(node.left);
      const right = visit(node.right);
      if (node.op === 'add' || node.op === 'sub') {
        const ls = members(left);
        const rs = members(right);
        for (const x of ls) {
          for (const y of rs) {
            const v = node.op === 'add' ? x + y : x - y;
            if (v >= 0 && v <= limits.max) out[v] = 1;
          }
        }
      } else if (node.op === 'mul') {
        for (const x of members(left, ...limits.factor)) {
          for (const y of members(right, ...limits.factor)) {
            if (x * y <= limits.max) out[x * y] = 1;
          }
        }
      } else {
        for (const y of members(right, ...limits.divisor)) {
          for (const q of span(limits.quotient[0], limits.quotient[1])) {
            if (q <= limits.max && q * y <= limits.max && left[q * y]) out[q] = 1;
          }
        }
      }
    }
    sets.set(node, out);
    return out;
  };
  visit(tree);
  return sets;
}

/** Fill `node` with numbers so that it is worth `target`, splitting top-down. */
function build(
  node: Expr,
  target: number,
  sets: Map<Expr, Values>,
  limits: Limits,
  random: RandomStream,
): Expr {
  if (node.kind === 'num') return num(target);
  if (node.kind === 'group')
    return { kind: 'group', inner: build(node.inner, target, sets, limits, random) };
  if (node.kind !== 'op') return node;
  const left = sets.get(node.left)!;
  const right = sets.get(node.right)!;
  const pairs: [number, number][] = [];
  if (node.op === 'add') {
    for (const x of members(left, 0, target)) if (right[target - x]) pairs.push([x, target - x]);
  } else if (node.op === 'sub') {
    for (const y of members(right))
      if (target + y <= limits.max && left[target + y]) pairs.push([target + y, y]);
  } else if (node.op === 'mul') {
    for (const x of members(left, ...limits.factor)) {
      for (const y of members(right, ...limits.factor)) if (x * y === target) pairs.push([x, y]);
    }
  } else {
    for (const y of members(right, ...limits.divisor)) {
      if (target * y <= limits.max && left[target * y]) pairs.push([target * y, y]);
    }
  }
  const [x, y] = random.pick(pairs);
  return op(
    node.op,
    build(node.left, x, sets, limits, random),
    build(node.right, y, sets, limits, random),
  );
}

/** A filled expression for `skeleton`, or `null` when no numbers fit it. */
function fill(
  skeleton: Expr,
  limits: Limits,
  brackets: boolean,
  random: RandomStream,
): Expr | null {
  if (limits.leaf[0] > limits.leaf[1]) return null;
  const sets = valueSets(skeleton, limits);
  const answers = members(sets.get(skeleton)!);
  if (answers.length === 0) return null;
  let expr = build(skeleton, random.pick(answers), sets, limits, random);
  // Brackets should change the value; a few redraws find such numbers when they exist.
  for (let attempt = 0; brackets && attempt < 8; attempt++) {
    if (withoutBrackets(tokensOf(expr)!) !== evaluate(expr)) break;
    expr = build(skeleton, random.pick(answers), sets, limits, random);
  }
  return expr;
}

export function orderProblem(
  params: DeepReadonly<OrderOpsParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const parsed = parseItemId(item);
  const bucket = parsed?.kind === 'bucket' && parsed.family === 'order' ? parsed.bucket : null;
  const brackets = bucket === 'brackets';
  const allowed =
    (bucket === 'brackets' && params.brackets !== 'forbidden') ||
    (bucket === 'no-brackets' && params.brackets !== 'required');
  if (allowed) {
    const counts = span(params.operations[0], params.operations[1]);
    const first = problems.pick(counts);
    const order = [first, ...counts.filter((n) => n !== first)];
    for (const strict of [true, false]) {
      const limits = limitsFor(params, strict);
      for (const n of order) {
        const candidates = skeletons(params, n, brackets);
        while (candidates.length > 0) {
          const index = problems.int(0, candidates.length);
          const expr = fill(candidates[index]!, limits, brackets, problems);
          if (expr !== null) return { kind: 'equation', left: expr, right: BLANK };
          candidates.splice(index, 1);
        }
      }
    }
  }
  throw cannotPractise('order.ops', item);
}
