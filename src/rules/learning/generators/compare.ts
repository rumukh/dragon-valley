/**
 * Comparison (`compare`), answered with <, > or = on Compare Stones. Items: `compare:fact-number`,
 * `compare:fact-fact`, `compare:expression` (the skill's `sides`).
 *
 * - `fact-number`: a product against a nearby number, `7 · 8 ○ 54` (either side).
 * - `fact-fact`: two products close together, `6 · 7 ○ 5 · 9`, or equal ones, `3 · 8 ○ 4 · 6`.
 * - `expression`: precedence against brackets, `2 + 3 · 4 ○ (2 + 3) · 4`; a product against its
 *   split, `7 · 8 ○ 7 · 5 + 7 · 3` (equal) or a near miss of it.
 *
 * Every product has one factor from the skill's `tables` and the other from 0-10, and about
 * `equalShare` % of the comparisons are equal.
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { evaluate, group, num, op, parseItemId } from '../../contract';
import type { CompareParams, Expr, Problem } from '../../contract';
import { NUMBER_RANGE, cannotPractise, span } from './shared';

interface Fact {
  left: number;
  right: number;
}

const product = (fact: Fact) => fact.left * fact.right;
const factExpr = (fact: Fact): Expr => op('mul', num(fact.left), num(fact.right));

/**
 * The other factor of a product: 1-10, and 0 only when the skill practises the 0 table (a product
 * of 0 makes most comparisons trivial).
 */
function others(tables: readonly number[]): number[] {
  return span(tables.includes(0) ? 0 : 1, 10);
}

/** Every small-table fact with a factor from `tables`, in both orders, by first then second. */
function factsOf(tables: readonly number[]): Fact[] {
  const facts: Fact[] = [];
  const allowed = others(tables);
  for (const left of allowed) {
    for (const right of allowed) {
      if (tables.includes(left) || tables.includes(right)) facts.push({ left, right });
    }
  }
  return facts;
}

function drawFact(tables: readonly number[], random: RandomStream): Fact {
  const table = random.pick(tables);
  const other = random.pick(others(tables));
  return random.bool() ? { left: table, right: other } : { left: other, right: table };
}

/** The two sides, in a random order. */
function sides(a: Expr, b: Expr, random: RandomStream): Problem {
  return random.bool()
    ? { kind: 'compare', left: a, right: b }
    : { kind: 'compare', left: b, right: a };
}

function factNumber(params: DeepReadonly<CompareParams>, equal: boolean, random: RandomStream) {
  const fact = drawFact(params.tables, random);
  const value = product(fact);
  // Close enough that the child must work the product out: within a fifth of it (2 to 10).
  const reach = Math.min(10, Math.max(2, (value - (value % 5)) / 5 + 1));
  const offsets = span(-reach, reach).filter(
    (d) => d !== 0 && value + d >= 0 && value + d <= NUMBER_RANGE,
  );
  const number = equal ? value : value + random.pick(offsets);
  return sides(factExpr(fact), num(number), random);
}

function factFact(params: DeepReadonly<CompareParams>, wantEqual: boolean, random: RandomStream) {
  const facts = factsOf(params.tables);
  const twins = (fact: Fact) =>
    facts.filter(
      (f) => product(f) === product(fact) && (f.left !== fact.left || f.right !== fact.right),
    );
  // Only the 0 table has no two different products; its comparisons are all equal.
  const equal = wantEqual || facts.every((f) => product(f) === product(facts[0]!));
  const lefts = equal ? facts.filter((fact) => twins(fact).length > 0) : facts;
  const left = random.pick(lefts);
  let right: Fact;
  if (equal) right = random.pick(twins(left));
  else {
    const others = facts
      .filter((f) => product(f) !== product(left))
      .sort(
        (a, b) =>
          Math.abs(product(a) - product(left)) - Math.abs(product(b) - product(left)) ||
          a.left - b.left ||
          a.right - b.right,
      );
    right = random.pick(others.slice(0, 8));
  }
  return sides(factExpr(left), factExpr(right), random);
}

/**
 * `a · b ○ a · c + a · d`, split (`c + d = b`) or missed by one (`c + d = b ± 1`), with `b` and
 * the split total at least 3 so that one part is at least 2 (`7 · 6 ○ 7 · 5 + 7 · 1`).
 */
function split(table: number, equal: boolean, random: RandomStream): [Expr, Expr] {
  const b = random.pick(span(3, 10));
  const total = equal ? b : random.pick([b - 1, b + 1].filter((t) => t >= 3 && t <= 10));
  const c = random.pick(span(1, total - 1));
  const parts = op('add', op('mul', num(table), num(c)), op('mul', num(table), num(total - c)));
  return [op('mul', num(table), num(b)), parts];
}

function expression(params: DeepReadonly<CompareParams>, equal: boolean, random: RandomStream) {
  // Factors 0 and 1 make every comparison of this kind trivial, so they step aside here.
  const usable = params.tables.filter((t) => t >= 2);
  const table = random.pick(usable.length > 0 ? usable : span(2, 10));
  if (equal) {
    const [whole, parts] = split(table, true, random);
    return sides(whole, parts, random);
  }
  const pattern = random.int(0, 3);
  if (pattern === 0) {
    // Precedence against brackets: x + y · t ○ (x + y) · t.
    const x = random.pick(span(1, 9));
    const y = random.pick(span(1, 10 - x));
    const plain = op('add', num(x), op('mul', num(y), num(table)));
    const bracketed = op('mul', group(op('add', num(x), num(y))), num(table));
    return sides(plain, bracketed, random);
  }
  if (pattern === 1) {
    // Bracketing the wrong part: t · b + c ○ t · (b + c).
    const b = random.pick(span(1, 9));
    const c = random.pick(span(1, 10 - b));
    const plain = op('add', op('mul', num(table), num(b)), num(c));
    const bracketed = op('mul', num(table), group(op('add', num(b), num(c))));
    return sides(plain, bracketed, random);
  }
  const [whole, parts] = split(table, false, random);
  return sides(whole, parts, random);
}

export function compareProblem(
  params: DeepReadonly<CompareParams>,
  item: string,
  problems: RandomStream,
): Problem {
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'bucket' || parsed.family !== 'compare' || parsed.bucket !== params.sides) {
    throw cannotPractise('compare', item);
  }
  const equal = problems.int(0, 100) < params.equalShare;
  const problem =
    params.sides === 'fact-number'
      ? factNumber(params, equal, problems)
      : params.sides === 'fact-fact'
        ? factFact(params, equal, problems)
        : expression(params, equal, problems);
  if (
    problem.kind !== 'compare' ||
    evaluate(problem.left) === null ||
    evaluate(problem.right) === null
  ) {
    throw cannotPractise('compare', item);
  }
  return problem;
}
