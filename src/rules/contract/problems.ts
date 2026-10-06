/**
 * Notation-agnostic problems and answers, and the item ID scheme.
 *
 * Rules produce structured problems; the shell renders them in Czech school notation
 * (`3 · 4`, `12 : 3`, `23 : 5 = 4 r 3`) or international notation (`×`, `÷`, `R`), and the
 * read-aloud verbalizer speaks the same structure ("fifty-six divided by seven"). Nothing here
 * contains a rendered symbol; see notation.ts for the reference rendering.
 *
 * Numbers are non-negative integers (3rd grade has no negatives and no fractions). Division
 * inside an expression is exact; a remainder is only ever expressed by a `divrem` problem.
 */
import { failure, schema, success } from '@aegis/runtime';
import type { Outcome, Schema } from '@aegis/runtime';
import { OPERATORS, RELATIONS, TERMS } from './kinds';
import type { Operator, Relation, Term } from './kinds';
import { catalogKey, int, lazy, nullable, oneOf } from './schema';
import { TABLE_MAX, TABLE_MIN } from './ids';

/** Largest number any problem may show or expect. Keeps every value a small safe integer. */
export const MAX_PROBLEM_NUMBER = 100_000;
/** Bounds on expression trees, so a hostile save cannot make rendering or evaluation explode. */
export const MAX_EXPR_DEPTH = 8;
export const MAX_EXPR_NODES = 31;

// ---------------------------------------------------------------------------------------------
// Expressions

/** A literal number. */
export interface NumExpr {
  kind: 'num';
  value: number;
}
/** The unknown the child supplies (rendered as an empty box or `?`). */
export interface BlankExpr {
  kind: 'blank';
}
/** A binary operation. Precedence is the tree; brackets are shown only for `group` nodes. */
export interface OpExpr {
  kind: 'op';
  op: Operator;
  left: Expr;
  right: Expr;
}
/** Explicit brackets around `inner`, rendered as `( … )`. */
export interface GroupExpr {
  kind: 'group';
  inner: Expr;
}
export type Expr = NumExpr | BlankExpr | OpExpr | GroupExpr;

const problemNumber = int(0, MAX_PROBLEM_NUMBER);

export const exprSchema: Schema<Expr> = lazy(() =>
  schema.union(
    schema.object({ kind: schema.literal('num'), value: problemNumber }),
    schema.object({ kind: schema.literal('blank') }),
    schema.object({
      kind: schema.literal('op'),
      op: oneOf(OPERATORS),
      left: exprSchema,
      right: exprSchema,
    }),
    schema.object({ kind: schema.literal('group'), inner: exprSchema }),
  ),
);

export function num(value: number): NumExpr {
  return { kind: 'num', value };
}
export const BLANK: BlankExpr = Object.freeze({ kind: 'blank' });
export function op(operator: Operator, left: Expr, right: Expr): OpExpr {
  return { kind: 'op', op: operator, left, right };
}
export function group(inner: Expr): GroupExpr {
  return { kind: 'group', inner };
}

/** Binding strength: multiplication and division bind tighter than addition and subtraction. */
export function precedence(operator: Operator): 1 | 2 {
  return operator === 'mul' || operator === 'div' ? 2 : 1;
}

/**
 * True when `child` (the `side` operand of `parent`) must be bracketed for the conventional
 * reading of the rendered text to equal the tree: a looser child, or a right child of equal
 * precedence under `-` or `:` (so `8 - (3 - 1)` and `24 : (6 : 2)` keep their brackets).
 */
export function needsGroup(parent: Operator, child: Expr, side: 'left' | 'right'): boolean {
  if (child.kind !== 'op') return false;
  const p = precedence(parent);
  const c = precedence(child.op);
  if (c < p) return true;
  return side === 'right' && c === p && (parent === 'sub' || parent === 'div');
}

function measure(expr: Expr, depth = 1): { depth: number; nodes: number } {
  if (expr.kind === 'op') {
    const left = measure(expr.left, depth + 1);
    const right = measure(expr.right, depth + 1);
    return { depth: Math.max(left.depth, right.depth), nodes: left.nodes + right.nodes + 1 };
  }
  if (expr.kind === 'group') {
    const inner = measure(expr.inner, depth + 1);
    return { depth: inner.depth, nodes: inner.nodes + 1 };
  }
  return { depth, nodes: 1 };
}

export function countBlanks(expr: Expr): number {
  if (expr.kind === 'blank') return 1;
  if (expr.kind === 'op') return countBlanks(expr.left) + countBlanks(expr.right);
  if (expr.kind === 'group') return countBlanks(expr.inner);
  return 0;
}

/**
 * Evaluate an expression without blanks. Returns `null` when the value is not a non-negative
 * integer within `MAX_PROBLEM_NUMBER` (inexact division, a negative difference, division by zero
 * or overflow): such an expression is not a valid 3rd-grade problem.
 */
export function evaluate(expr: Expr): number | null {
  switch (expr.kind) {
    case 'num':
      return expr.value;
    case 'blank':
      return null;
    case 'group':
      return evaluate(expr.inner);
    case 'op': {
      const left = evaluate(expr.left);
      const right = evaluate(expr.right);
      if (left === null || right === null) return null;
      let value: number;
      if (expr.op === 'add') value = left + right;
      else if (expr.op === 'sub') value = left - right;
      else if (expr.op === 'mul') value = left * right;
      else {
        if (right === 0 || left % right !== 0) return null;
        value = left / right;
      }
      return value >= 0 && value <= MAX_PROBLEM_NUMBER ? value : null;
    }
  }
}

/**
 * The value the blank must take so that `expr` equals `target`, or `null` if no unique
 * non-negative integer exists (for example `? · 0 = 0`, where every number fits).
 */
export function solveBlank(expr: Expr, target: number): number | null {
  if (expr.kind === 'blank') return target;
  if (expr.kind === 'num') return null;
  if (expr.kind === 'group') return solveBlank(expr.inner, target);
  const leftHasBlank = countBlanks(expr.left) > 0;
  const known = evaluate(leftHasBlank ? expr.right : expr.left);
  if (known === null) return null;
  const unknown = leftHasBlank ? expr.left : expr.right;
  let inner: number;
  switch (expr.op) {
    case 'add':
      inner = target - known;
      break;
    case 'sub':
      // ? - k = t  ->  t + k ;  k - ? = t  ->  k - t
      inner = leftHasBlank ? target + known : known - target;
      break;
    case 'mul':
      if (known === 0) return null;
      if (target % known !== 0) return null;
      inner = target / known;
      break;
    case 'div':
      if (leftHasBlank) {
        // ? : k = t  ->  t · k
        if (known === 0) return null;
        inner = target * known;
      } else {
        // k : ? = t  ->  k : t (exact, and t must not be 0)
        if (target === 0 || known % target !== 0) return null;
        inner = known / target;
      }
      break;
  }
  if (!Number.isSafeInteger(inner) || inner < 0 || inner > MAX_PROBLEM_NUMBER) return null;
  return solveBlank(unknown, inner);
}

// ---------------------------------------------------------------------------------------------
// Problems

/** `left = right` with exactly one blank on either side: `7 · 8 = ?`, `? · 6 = 42`, `(2 + 3) · 4 = ?`. */
export interface EquationProblem {
  kind: 'equation';
  left: Expr;
  right: Expr;
}
/** Division with remainder, answered with quotient and remainder: `23 : 5 = ? r ?`. */
export interface DivRemProblem {
  kind: 'divrem';
  dividend: number;
  divisor: number;
}
/** Compare two blank-free expressions with `<`, `>` or `=`: `7 · 8 ○ 50`. */
export interface CompareProblem {
  kind: 'compare';
  left: Expr;
  right: Expr;
}
/**
 * A story. The shell renders `template` (a catalog key) with `vars`: numbers are shown in the
 * story, strings are catalog keys of words (names, objects) chosen from the `words` stream.
 * `model` is the arithmetic the story asks for. With `operation` set, the child first picks that
 * operation (Riddle Scrolls), then answers `model`.
 */
export interface WordProblem {
  kind: 'word';
  template: string;
  vars: Record<string, number | string>;
  model: EquationProblem | DivRemProblem;
  operation: Operator | null;
}
/**
 * Name the highlighted number of a sentence with its term: in `6 · 7 = 42`, 42 is the product.
 * `remainder` is non-null only for a division with remainder.
 */
export interface TermProblem {
  kind: 'term';
  sentence: {
    op: 'mul' | 'div';
    left: number;
    right: number;
    result: number;
    remainder: number | null;
  };
  highlight: 'left' | 'right' | 'result' | 'remainder';
}
export type Problem = EquationProblem | DivRemProblem | CompareProblem | WordProblem | TermProblem;

const equationSchema: Schema<EquationProblem> = schema.object({
  kind: schema.literal('equation'),
  left: exprSchema,
  right: exprSchema,
});
const divRemSchema: Schema<DivRemProblem> = schema.object({
  kind: schema.literal('divrem'),
  dividend: problemNumber,
  divisor: int(1, MAX_PROBLEM_NUMBER),
});

export const problemSchema: Schema<Problem> = schema.union(
  equationSchema,
  divRemSchema,
  schema.object({ kind: schema.literal('compare'), left: exprSchema, right: exprSchema }),
  schema.object({
    kind: schema.literal('word'),
    template: catalogKey,
    vars: schema.record(schema.union(problemNumber, catalogKey)),
    model: schema.union(equationSchema, divRemSchema),
    operation: nullable(oneOf(OPERATORS)),
  }),
  schema.object({
    kind: schema.literal('term'),
    sentence: schema.object({
      op: oneOf(['mul', 'div'] as const),
      left: problemNumber,
      right: problemNumber,
      result: problemNumber,
      remainder: nullable(problemNumber),
    }),
    highlight: oneOf(['left', 'right', 'result', 'remainder'] as const),
  }),
);

// ---------------------------------------------------------------------------------------------
// Answers

export type AnswerValue =
  | { kind: 'number'; value: number }
  | { kind: 'remainder'; quotient: number; remainder: number }
  | { kind: 'relation'; relation: Relation }
  | { kind: 'operation'; operation: Operator }
  | { kind: 'term'; term: Term };

export const answerValueSchema: Schema<AnswerValue> = schema.union(
  schema.object({ kind: schema.literal('number'), value: problemNumber }),
  schema.object({
    kind: schema.literal('remainder'),
    quotient: problemNumber,
    remainder: problemNumber,
  }),
  schema.object({ kind: schema.literal('relation'), relation: oneOf(RELATIONS) }),
  schema.object({ kind: schema.literal('operation'), operation: oneOf(OPERATORS) }),
  schema.object({ kind: schema.literal('term'), term: oneOf(TERMS) }),
);

/** The step a problem is on. Only word problems with an `operation` have an `operation` step. */
export type ProblemStep = 'operation' | 'answer';

export function firstStep(problem: Problem): ProblemStep {
  return problem.kind === 'word' && problem.operation !== null ? 'operation' : 'answer';
}

/** Structural equality of answers. */
export function sameAnswer(a: AnswerValue, b: AnswerValue): boolean {
  switch (a.kind) {
    case 'number':
      return b.kind === 'number' && a.value === b.value;
    case 'remainder':
      return b.kind === 'remainder' && a.quotient === b.quotient && a.remainder === b.remainder;
    case 'relation':
      return b.kind === 'relation' && a.relation === b.relation;
    case 'operation':
      return b.kind === 'operation' && a.operation === b.operation;
    case 'term':
      return b.kind === 'term' && a.term === b.term;
  }
}

function termOf(sentence: TermProblem['sentence'], highlight: TermProblem['highlight']): Term {
  if (highlight === 'remainder') return 'remainder';
  if (sentence.op === 'mul') return highlight === 'result' ? 'product' : 'factor';
  return highlight === 'left' ? 'dividend' : highlight === 'right' ? 'divisor' : 'quotient';
}

/**
 * The single correct answer for a problem at a step, or a problem message when the problem is
 * malformed (no unique answer). Generators must only emit problems for which this succeeds.
 */
export function expectedAnswer(
  problem: Problem,
  step: ProblemStep = 'answer',
): Outcome<AnswerValue> {
  const invalid = (message: string) => failure('invalid-problem', message);
  if (step === 'operation') {
    return problem.kind === 'word' && problem.operation !== null
      ? success({ kind: 'operation', operation: problem.operation })
      : invalid('Only word problems with an operation have an operation step.');
  }
  switch (problem.kind) {
    case 'equation': {
      const shape = [measure(problem.left), measure(problem.right)];
      if (
        shape.some((s) => s.depth > MAX_EXPR_DEPTH) ||
        shape[0]!.nodes + shape[1]!.nodes > MAX_EXPR_NODES
      ) {
        return invalid('Expression tree too large.');
      }
      const leftBlanks = countBlanks(problem.left);
      const rightBlanks = countBlanks(problem.right);
      if (leftBlanks + rightBlanks !== 1) return invalid('An equation needs exactly one blank.');
      const known = evaluate(leftBlanks ? problem.right : problem.left);
      if (known === null) return invalid('The known side is not a non-negative integer.');
      const value = solveBlank(leftBlanks ? problem.left : problem.right, known);
      return value === null
        ? invalid('The blank has no unique non-negative integer value.')
        : success({ kind: 'number', value });
    }
    case 'divrem':
      return problem.divisor >= 1
        ? success({
            kind: 'remainder',
            quotient: (problem.dividend - (problem.dividend % problem.divisor)) / problem.divisor,
            remainder: problem.dividend % problem.divisor,
          })
        : invalid('Divisor must be at least 1.');
    case 'compare': {
      if (countBlanks(problem.left) + countBlanks(problem.right) !== 0) {
        return invalid('A comparison has no blanks.');
      }
      const left = evaluate(problem.left);
      const right = evaluate(problem.right);
      if (left === null || right === null) return invalid('Both sides must evaluate.');
      return success({
        kind: 'relation',
        relation: left < right ? 'lt' : left > right ? 'gt' : 'eq',
      });
    }
    case 'word':
      return expectedAnswer(problem.model, 'answer');
    case 'term': {
      const { sentence, highlight } = problem;
      const exact =
        sentence.op === 'mul'
          ? sentence.left * sentence.right === sentence.result && sentence.remainder === null
          : sentence.right >= 1 &&
            sentence.left === sentence.result * sentence.right + (sentence.remainder ?? 0) &&
            (sentence.remainder === null || sentence.remainder < sentence.right);
      if (!exact) return invalid('The sentence is not arithmetically true.');
      if (highlight === 'remainder' && sentence.remainder === null) {
        return invalid('Only a division with remainder has a remainder.');
      }
      return success({ kind: 'term', term: termOf(sentence, highlight) });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Item IDs

/**
 * Items are the unit of spaced retrieval and mastery.
 *
 * - `mul:AxB`: the small-table fact A · B as presented (A, B in 0..10). 121 items; `mul:7x8` and
 *   `mul:8x7` are distinct items that share partial credit.
 * - `div:P:D`: the fact P : D = Q with D in 1..10 and Q in 0..10. 110 items. A missing-factor
 *   problem `? · 6 = 42` practises `div:42:6`.
 * - `<family>:<bucket>`: open-ended skills grouped into buckets, e.g. `rem:d7` (remainder,
 *   divisor 7), `mul2d1d:carry`, `div2d1d:regroup`, `order:brackets`, `word:times-fewer`,
 *   `terms:quotient`. The family is never `mul` or `div`.
 *
 * The item is what is retrieved; presentation (direct, missing factor, word problem, choice or
 * keypad) is a property of the problem, not of the item.
 */
export const MUL_FACT_PATTERN = /^mul:(\d|10)x(\d|10)$/;
export const DIV_FACT_PATTERN = /^div:(\d{1,3}):([1-9]|10)$/;
export const BUCKET_PATTERN = /^(?!mul:|div:)([a-z][a-z0-9]*):([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export type ParsedItem =
  | { kind: 'mul'; a: number; b: number; product: number }
  | { kind: 'div'; dividend: number; divisor: number; quotient: number }
  | { kind: 'bucket'; family: string; bucket: string };

function inTable(value: number): boolean {
  return value >= TABLE_MIN && value <= TABLE_MAX;
}

export function mulFactId(a: number, b: number): string {
  if (!inTable(a) || !inTable(b) || !Number.isInteger(a) || !Number.isInteger(b)) {
    throw new RangeError(`mul facts use factors ${TABLE_MIN}..${TABLE_MAX}`);
  }
  return `mul:${a}x${b}`;
}

export function divFactId(dividend: number, divisor: number): string {
  const quotient = dividend / divisor;
  if (!Number.isInteger(quotient) || divisor < 1 || divisor > TABLE_MAX || !inTable(quotient)) {
    throw new RangeError('div facts are P : D = Q with D in 1..10 and Q in 0..10');
  }
  return `div:${dividend}:${divisor}`;
}

export function bucketId(family: string, bucket: string): string {
  const id = `${family}:${bucket}`;
  if (!BUCKET_PATTERN.test(id)) throw new RangeError(`Invalid bucket item ID: ${id}`);
  return id;
}

/** Parse an item ID, or `null` if it is not a valid item ID. */
export function parseItemId(id: string): ParsedItem | null {
  const mul = MUL_FACT_PATTERN.exec(id);
  if (mul) {
    const a = Number(mul[1]);
    const b = Number(mul[2]);
    return { kind: 'mul', a, b, product: a * b };
  }
  const div = DIV_FACT_PATTERN.exec(id);
  if (div) {
    const dividend = Number(div[1]);
    const divisor = Number(div[2]);
    const quotient = dividend / divisor;
    return Number.isInteger(quotient) && inTable(quotient) && String(dividend) === div[1]
      ? { kind: 'div', dividend, divisor, quotient }
      : null;
  }
  const bucket = BUCKET_PATTERN.exec(id);
  return bucket ? { kind: 'bucket', family: bucket[1]!, bucket: bucket[2]! } : null;
}

export function isItemId(id: string): boolean {
  return parseItemId(id) !== null;
}

/** The commuted twin of a multiplication fact (`mul:7x8` -> `mul:8x7`), or null. */
export function commutedId(id: string): string | null {
  const parsed = parseItemId(id);
  return parsed?.kind === 'mul' && parsed.a !== parsed.b ? mulFactId(parsed.b, parsed.a) : null;
}

/** Every small-table multiplication fact in window order (row A, column B). */
export function allMulFactIds(): string[] {
  const ids: string[] = [];
  for (let a = TABLE_MIN; a <= TABLE_MAX; a++) {
    for (let b = TABLE_MIN; b <= TABLE_MAX; b++) ids.push(mulFactId(a, b));
  }
  return ids;
}

/** Every small-table division fact, by divisor then quotient. */
export function allDivFactIds(): string[] {
  const ids: string[] = [];
  for (let divisor = 1; divisor <= TABLE_MAX; divisor++) {
    for (let quotient = TABLE_MIN; quotient <= TABLE_MAX; quotient++) {
      ids.push(divFactId(divisor * quotient, divisor));
    }
  }
  return ids;
}

export const itemIdSchema: Schema<string> = {
  parse(value: unknown, path = '') {
    return typeof value === 'string' && isItemId(value)
      ? success(value)
      : failure('invalid-data', 'Expected an item ID (mul:AxB, div:P:D or family:bucket).', {
          path,
        });
  },
};
