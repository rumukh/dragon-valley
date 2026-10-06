/**
 * Independent oracles for the generator tests. Nothing here calls the contract's `evaluate`,
 * `expectedAnswer` or `needsGroup`, or the generators' own helpers: values are worked out with
 * plain arithmetic, rendered text is re-read by a separate parser, and each generator's rules are
 * restated from docs/curriculum.md §4. `violations` names every broken rule, so a failing test
 * reads as a bug report.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPrng } from '@aegis/core';
import { parseContentJson, requireValue } from '@aegis/runtime';
import { contentRegistration, formatExpr, problemSchema } from '../../../src/rules/contract';
import type {
  AnswerValue,
  ContentData,
  Expr,
  Operator,
  Problem,
  Skill,
  TemplateExpr,
  Term,
  WordProblem,
} from '../../../src/rules/contract';
import type { GeneratorSources } from '../../../src/rules/learning/generate';

export const root = join(import.meta.dirname, '..', '..', '..');

export const pack = requireValue(
  parseContentJson(
    readFileSync(join(root, 'content', 'dragon-valley.content.json'), 'utf8'),
    contentRegistration,
    'dragon-valley.content.json',
  ),
);
export const data = pack.data as ContentData;
export const catalog: Record<string, string> = JSON.parse(
  readFileSync(join(root, 'content', 'catalogs', 'en.content.json'), 'utf8'),
);

/** Fresh, independent `problems` and `words` streams for a seed, over the shipped content. */
export function sources(
  seed: string,
  content: Pick<ContentData, 'wordTemplates' | 'wordLists'> = data,
): GeneratorSources {
  return {
    problems: createPrng(`${seed}:problems`),
    words: createPrng(`${seed}:words`),
    data: content,
  };
}

export const range = (low: number, high: number): number[] =>
  Array.from({ length: Math.max(0, high - low + 1) }, (_, i) => low + i);

// ---------------------------------------------------------------------------------------------
// Arithmetic

/** One step on whole numbers, or `null` when it leaves them (negative, inexact, by zero). */
export function step(op: Operator, a: number, b: number): number | null {
  const r =
    op === 'add' ? a + b : op === 'sub' ? a - b : op === 'mul' ? a * b : b === 0 ? NaN : a / b;
  return Number.isInteger(r) && r >= 0 ? r : null;
}

/** The value of a blank-free expression tree, or `null`. */
export function value(expr: Expr): number | null {
  if (expr.kind === 'num') return expr.value;
  if (expr.kind === 'blank') return null;
  if (expr.kind === 'group') return value(expr.inner);
  const a = value(expr.left);
  const b = value(expr.right);
  return a === null || b === null ? null : step(expr.op, a, b);
}

/** Every operation node of a tree with its two operand values. */
export function operations(
  expr: Expr,
): { op: Operator; left: number; right: number; value: number | null }[] {
  if (expr.kind === 'group') return operations(expr.inner);
  if (expr.kind !== 'op') return [];
  const left = value(expr.left);
  const right = value(expr.right);
  return [
    ...operations(expr.left),
    ...operations(expr.right),
    { op: expr.op, left: left ?? -1, right: right ?? -1, value: value(expr) },
  ];
}

export function leaves(expr: Expr): number[] {
  if (expr.kind === 'num') return [expr.value];
  if (expr.kind === 'group') return leaves(expr.inner);
  if (expr.kind === 'op') return [...leaves(expr.left), ...leaves(expr.right)];
  return [];
}

export function groups(expr: Expr): Expr[] {
  if (expr.kind === 'group') return [expr, ...groups(expr.inner)];
  if (expr.kind === 'op') return [...groups(expr.left), ...groups(expr.right)];
  return [];
}

/**
 * Reads rendered Czech-notation text (`2 + 3 · 4`, `(12 − 4) : 2`) the way a child is taught:
 * brackets first, then · and :, then + and −, each from left to right. `null` when a step leaves
 * the whole numbers.
 */
export function readWritten(text: string): number | null {
  const tokens = text.match(/\d+|[+\u2212\u00b7:()]/g) ?? [];
  let at = 0;
  const factor = (): number | null => {
    const token = tokens[at++];
    if (token === '(') {
      const inner = sum();
      at++; // ')'
      return inner;
    }
    return token === undefined ? null : Number(token);
  };
  const product = (): number | null => {
    let left = factor();
    while (tokens[at] === '\u00b7' || tokens[at] === ':') {
      const op = tokens[at++] === ':' ? 'div' : 'mul';
      const right = factor();
      left = left === null || right === null ? null : step(op, left, right);
    }
    return left;
  };
  const sum = (): number | null => {
    let left = product();
    while (tokens[at] === '+' || tokens[at] === '\u2212') {
      const op = tokens[at++] === '+' ? 'add' : 'sub';
      const right = product();
      left = left === null || right === null ? null : step(op, left, right);
    }
    return left;
  };
  return sum();
}

/** The expression's written text read back equals its tree's value (brackets are right). */
export function readsAsItsTree(expr: Expr): boolean {
  return readWritten(formatExpr(expr)) === value(expr);
}

// ---------------------------------------------------------------------------------------------
// Templates

function templateValue(expr: TemplateExpr, vars: Record<string, number | string>): number | null {
  if (expr.kind === 'num') return expr.value;
  if (expr.kind === 'var') {
    const v = vars[expr.name];
    return typeof v === 'number' ? v : null;
  }
  if (expr.kind === 'group') return templateValue(expr.inner, vars);
  const a = templateValue(expr.left, vars);
  const b = templateValue(expr.right, vars);
  return a === null || b === null ? null : step(expr.op, a, b);
}

/** The answer a word problem's story asks for, worked out from its template and vars alone. */
export function storyAnswer(
  problem: WordProblem,
): { value: number } | { quotient: number; remainder: number } | null {
  const template = data.wordTemplates.find((t) => t.textKey === problem.template);
  if (!template) return null;
  if (template.model.kind === 'value') {
    const v = templateValue(template.model.expr, problem.vars);
    return v === null ? null : { value: v };
  }
  const dividend = templateValue(template.model.dividend, problem.vars);
  const divisor = templateValue(template.model.divisor, problem.vars);
  if (dividend === null || divisor === null || divisor === 0) return null;
  const remainder = dividend % divisor;
  return { quotient: (dividend - remainder) / divisor, remainder };
}

// ---------------------------------------------------------------------------------------------
// Answers and options

export type OracleAnswer =
  | { kind: 'number'; value: number }
  | { kind: 'remainder'; quotient: number; remainder: number }
  | { kind: 'relation'; relation: 'lt' | 'gt' | 'eq' }
  | { kind: 'term'; term: Term };

/** The answer worked out from the problem alone (never through `expectedAnswer`). */
export function oracleAnswer(problem: Problem): OracleAnswer | null {
  switch (problem.kind) {
    case 'equation': {
      const { left, right } = problem;
      if (right.kind === 'blank') {
        const v = value(left);
        return v === null ? null : { kind: 'number', value: v };
      }
      // A missing factor: ? · k = p or k · ? = p.
      if (left.kind === 'op' && left.op === 'mul' && right.kind === 'num') {
        const known =
          left.left.kind === 'num'
            ? left.left.value
            : left.right.kind === 'num'
              ? left.right.value
              : 0;
        return known > 0 && right.value % known === 0
          ? { kind: 'number', value: right.value / known }
          : null;
      }
      return null;
    }
    case 'divrem': {
      const remainder = problem.dividend % problem.divisor;
      return {
        kind: 'remainder',
        quotient: (problem.dividend - remainder) / problem.divisor,
        remainder,
      };
    }
    case 'compare': {
      const a = value(problem.left);
      const b = value(problem.right);
      if (a === null || b === null) return null;
      return { kind: 'relation', relation: a < b ? 'lt' : a > b ? 'gt' : 'eq' };
    }
    case 'word': {
      const answer = storyAnswer(problem);
      if (answer === null) return null;
      return 'value' in answer
        ? { kind: 'number', value: answer.value }
        : { kind: 'remainder', ...answer };
    }
    case 'term':
      return { kind: 'term', term: TERM_OF[`${problem.sentence.op}:${problem.highlight}`]! };
  }
}

const digitCount = (n: number) => String(n).length;

/**
 * Every rule a list of answer options breaks, by name: the answer offered exactly once, no
 * repeats, the right number of options, and every distractor a plausible whole number (0-1000
 * unless the answer is bigger, at most one digit longer or shorter) or remainder pair.
 */
export function optionViolations(
  problem: Problem,
  options: readonly AnswerValue[],
  count: number,
): string[] {
  const broken: string[] = [];
  const check = (ok: boolean, rule: string) => {
    if (!ok) broken.push(rule);
  };
  const answer = oracleAnswer(problem);
  check(answer !== null, 'the problem has an answer');
  if (answer === null) return broken;
  const key = (o: AnswerValue | OracleAnswer) => JSON.stringify(o, Object.keys(o).sort());
  check(
    options.filter((o) => key(o) === key(answer)).length === 1,
    'the answer is offered exactly once',
  );
  check(new Set(options.map(key)).size === options.length, 'no option is offered twice');
  check(
    options.every((o) => o.kind === answer.kind),
    'every option is the same kind of answer',
  );
  const expected = answer.kind === 'relation' ? 3 : count;
  check(options.length === expected, `${expected} options`);
  for (const option of options) {
    if (option.kind === 'number' && answer.kind === 'number') {
      check(
        Number.isInteger(option.value) && option.value >= 0,
        'numbers are whole and not negative',
      );
      check(option.value <= (answer.value <= 1000 ? 1000 : 100_000), 'numbers stay within 1000');
      check(
        Math.abs(digitCount(option.value) - digitCount(answer.value)) <= 1,
        'numbers have about as many digits as the answer',
      );
    }
    if (option.kind === 'remainder' && answer.kind === 'remainder') {
      const divisor =
        problem.kind === 'divrem'
          ? problem.divisor
          : problem.kind === 'word' && problem.model.kind === 'divrem'
            ? problem.model.divisor
            : 0;
      check(
        option.quotient >= 0 && option.remainder >= 0,
        'quotients and remainders are not negative',
      );
      check(option.remainder < 2 * divisor, 'remainders are below twice the divisor');
      check(
        Math.abs(digitCount(option.quotient) - digitCount(answer.quotient)) <= 1,
        'quotients have about as many digits as the answer',
      );
    }
  }
  return broken;
}

// ---------------------------------------------------------------------------------------------
// Rules by generator

const TERM_OF: Record<string, Term> = {
  'mul:left': 'factor',
  'mul:right': 'factor',
  'mul:result': 'product',
  'div:left': 'dividend',
  'div:right': 'divisor',
  'div:result': 'quotient',
  'div:remainder': 'remainder',
};

const bucketOf = (item: string) => item.slice(item.indexOf(':') + 1);
const isProduct = (e: Expr): e is Extract<Expr, { kind: 'op' }> =>
  e.kind === 'op' && e.op === 'mul' && e.left.kind === 'num' && e.right.kind === 'num';
const numbersOf = (e: Expr) => (e.kind === 'op' ? [value(e.left)!, value(e.right)!] : []);

/**
 * Every rule a generated problem breaks, by name. Rules restate docs/curriculum.md §4 and the
 * skill's parameters; an empty list means the problem is right for the item.
 */
export function violations(skill: Skill, item: string, problem: Problem): string[] {
  const broken: string[] = [];
  const check = (ok: boolean, rule: string) => {
    if (!ok) broken.push(rule);
  };
  check(
    problemSchema.parse(JSON.parse(JSON.stringify(problem))).ok,
    'the problem matches the problem schema',
  );
  const bucket = bucketOf(item);
  switch (skill.generator) {
    case 'mul.fact': {
      const [a, b] = item.slice(4).split('x').map(Number) as [number, number];
      check(
        problem.kind === 'equation' &&
          problem.right.kind === 'blank' &&
          isProduct(problem.left) &&
          numbersOf(problem.left).join() === `${a},${b}`,
        `the problem is ${a} · ${b} = ?`,
      );
      break;
    }
    case 'div.fact': {
      const [, p, d] = item.split(':').map(Number) as [number, number, number];
      check(
        problem.kind === 'equation' &&
          problem.right.kind === 'blank' &&
          problem.left.kind === 'op' &&
          problem.left.op === 'div' &&
          numbersOf(problem.left).join() === `${p},${d}`,
        `the problem is ${p} : ${d} = ?`,
      );
      break;
    }
    case 'mul.missing': {
      const [, p, d] = item.split(':').map(Number) as [number, number, number];
      const ok =
        problem.kind === 'equation' &&
        problem.right.kind === 'num' &&
        problem.right.value === p &&
        problem.left.kind === 'op' &&
        problem.left.op === 'mul' &&
        ((problem.left.left.kind === 'blank' &&
          problem.left.right.kind === 'num' &&
          problem.left.right.value === d) ||
          (problem.left.right.kind === 'blank' &&
            problem.left.left.kind === 'num' &&
            problem.left.left.value === d));
      check(ok, `the problem is ? · ${d} = ${p} or ${d} · ? = ${p}`);
      if (ok && problem.kind === 'equation' && problem.left.kind === 'op') {
        const first = problem.left.left.kind === 'blank';
        check(
          skill.params.position !== (first ? 'second' : 'first'),
          'the blank sits where the skill asks',
        );
      }
      break;
    }
    case 'div.remainder': {
      const d = Number(bucket.slice(1));
      check(problem.kind === 'divrem', 'a remainder problem asks for quotient and remainder');
      if (problem.kind !== 'divrem') break;
      const r = problem.dividend % problem.divisor;
      const q = (problem.dividend - r) / problem.divisor;
      check(
        problem.divisor === d && skill.params.divisors.includes(d),
        `the divisor is ${d}, one of the skill's`,
      );
      check(
        problem.dividend <= skill.params.dividendMax,
        `the dividend is at most ${skill.params.dividendMax}`,
      );
      check(
        q >= skill.params.quotients[0] && q <= skill.params.quotients[1],
        'the quotient is in the skill range',
      );
      check(r < problem.divisor, 'the remainder is smaller than the divisor');
      const req = skill.params.remainder;
      check(req === 'allowed' || (req === 'required') === r > 0, `the remainder is ${req}`);
      break;
    }
    case 'mul.power10': {
      const p = Number(bucket.slice(1));
      const ok =
        problem.kind === 'equation' && problem.right.kind === 'blank' && isProduct(problem.left);
      check(ok, 'the problem is a product');
      if (!ok || problem.kind !== 'equation') break;
      const [a, b] = numbersOf(problem.left) as [number, number];
      const f = b === p ? a : a === p ? b : -1;
      check(f >= 0, `one factor is ${p}`);
      check(
        f >= skill.params.factors[0] && f <= skill.params.factors[1],
        'the other factor is in the skill range',
      );
      check(a * b <= skill.params.resultMax, `the product is at most ${skill.params.resultMax}`);
      break;
    }
    case 'mul.tens': {
      const d = Number(bucket.slice(1));
      const ok =
        problem.kind === 'equation' && problem.right.kind === 'blank' && isProduct(problem.left);
      check(ok, 'the problem is a product');
      if (!ok || problem.kind !== 'equation') break;
      const [a, b] = numbersOf(problem.left) as [number, number];
      const t = a === d && b % 10 === 0 ? b : b === d && a % 10 === 0 ? a : -1;
      check(t > 0, `tens times ${d}`);
      check(
        t / 10 >= skill.params.tens[0] && t / 10 <= skill.params.tens[1],
        'the tens are in the skill range',
      );
      check(skill.params.digits.includes(d), 'the digit is one of the skill');
      check(a * b <= skill.params.resultMax, `the product is at most ${skill.params.resultMax}`);
      break;
    }
    case 'mul.2d1d': {
      const ok =
        problem.kind === 'equation' && problem.right.kind === 'blank' && isProduct(problem.left);
      check(ok, 'the problem is a product');
      if (!ok || problem.kind !== 'equation') break;
      const [a, b] = numbersOf(problem.left) as [number, number];
      check(
        a >= skill.params.twoDigit[0] && a <= skill.params.twoDigit[1],
        'the first factor has two digits in the range',
      );
      check(
        b >= skill.params.oneDigit[0] && b <= skill.params.oneDigit[1],
        'the second factor has one digit in the range',
      );
      check(a * b <= skill.params.resultMax, `the product is at most ${skill.params.resultMax}`);
      // Written multiplication by hand: the ones' product reaches ten.
      const carry = (a % 10) * b >= 10;
      check(
        carry === (bucket === 'carry'),
        bucket === 'carry' ? 'the ones carry into the tens' : 'nothing carries',
      );
      break;
    }
    case 'div.2d1d': {
      const forbidden = skill.params.remainder === 'forbidden';
      let dividend = -1;
      let divisor = -1;
      if (problem.kind === 'equation' && problem.left.kind === 'op' && problem.left.op === 'div') {
        [dividend, divisor] = numbersOf(problem.left) as [number, number];
        check(forbidden, 'a skill that allows remainders asks for one');
      } else if (problem.kind === 'divrem') {
        [dividend, divisor] = [problem.dividend, problem.divisor];
        check(!forbidden, 'no remainder is asked for when the skill forbids remainders');
      } else check(false, 'the problem is a division');
      const r = dividend % divisor;
      const q = (dividend - r) / divisor;
      check(skill.params.divisors.includes(divisor), 'the divisor is one of the skill');
      check(
        dividend >= 10 && dividend <= skill.params.dividendMax,
        'the dividend has two digits within the maximum',
      );
      check(
        q >= skill.params.quotients[0] && q <= skill.params.quotients[1],
        'the quotient is in the skill range',
      );
      const req = skill.params.remainder;
      check(req === 'allowed' || (req === 'required') === r > 0, `the remainder is ${req}`);
      const tensDigit = (dividend - (dividend % 10)) / 10;
      check(
        (tensDigit % divisor !== 0) === (bucket === 'regroup'),
        bucket === 'regroup' ? 'the tens regroup' : 'the tens divide exactly',
      );
      break;
    }
    case 'order.ops': {
      const ok =
        problem.kind === 'equation' && problem.right.kind === 'blank' && problem.left.kind === 'op';
      check(ok, 'the problem is an expression = ?');
      if (!ok || problem.kind !== 'equation') break;
      const expr = problem.left;
      const ops = operations(expr);
      const p = skill.params;
      check(
        ops.length >= p.operations[0] && ops.length <= p.operations[1],
        'the number of operations is in the skill range',
      );
      check(
        ops.every((o) => p.operators.includes(o.op)),
        'only the skill operators are used',
      );
      check(
        leaves(expr).every((n) => n >= p.operands[0] && n <= p.operands[1]),
        'every number is in the operand range',
      );
      check(
        ops.every((o) => o.value !== null && o.value <= Math.min(p.resultMax, 1000)),
        'every step is a whole number within the result maximum',
      );
      check(readsAsItsTree(expr), 'the written expression reads as its tree');
      const g = groups(expr);
      check(
        g.length > 0 === (bucket === 'brackets'),
        bucket === 'brackets' ? 'the expression has brackets' : 'the expression has no brackets',
      );
      check(
        g.every(
          (x) =>
            x.kind === 'group' &&
            x.inner.kind === 'op' &&
            x.inner.left.kind === 'num' &&
            x.inner.right.kind === 'num',
        ),
        'each bracket pair holds one operation of two numbers',
      );
      break;
    }
    case 'compare': {
      check(problem.kind === 'compare', 'a comparison has two sides');
      if (problem.kind !== 'compare') break;
      check(bucket === skill.params.sides, 'the item is the skill sides');
      const sides = [problem.left, problem.right];
      check(
        sides.every((s) => value(s) !== null),
        'both sides are whole numbers',
      );
      const tables = skill.params.tables;
      const tableProduct = (s: Expr) =>
        isProduct(s) && numbersOf(s).some((n) => tables.includes(n));
      if (bucket === 'fact-number') {
        const fact = sides.find(tableProduct);
        const other = sides.find((s) => s !== fact);
        check(fact !== undefined && other?.kind === 'num', 'a table product against a number');
        if (fact && other?.kind === 'num')
          check(
            Math.abs(value(fact)! - other.value) <= 10,
            'the number is within 10 of the product',
          );
      } else if (bucket === 'fact-fact') {
        check(sides.every(tableProduct), 'two table products');
      } else {
        check(
          sides.some((s) => operations(s).length >= 2),
          'at least one side is an expression with two operations',
        );
        check(sides.every(readsAsItsTree), 'both sides read as their trees');
      }
      break;
    }
    case 'terms': {
      check(problem.kind === 'term', 'a terms problem highlights a number of a sentence');
      if (problem.kind !== 'term') break;
      const s = problem.sentence;
      const term = TERM_OF[`${s.op}:${problem.highlight}`];
      check(term === bucket, `the highlighted number is the ${bucket}`);
      if (s.op === 'mul') {
        check(
          s.left * s.right === s.result && s.remainder === null,
          'the sentence is a true product',
        );
        check(
          [s.left, s.right].every((n) => n >= 2 && n <= 10),
          'the factors are 2-10',
        );
      } else {
        const r = s.remainder ?? 0;
        check(
          s.right >= 1 && s.left === s.result * s.right + r && r < s.right,
          'the sentence is a true division',
        );
        check(s.right >= 2 && s.right <= 10, 'the divisor is 2-10');
        check(
          s.remainder === null ? s.result >= 2 && s.result <= 10 : s.result >= 1 && s.result <= 9,
          'the quotient is in the table',
        );
        check(
          s.remainder === null || (s.remainder >= 1 && s.left <= 99),
          'a remainder sentence has a remainder and a dividend up to 99',
        );
      }
      const all = { left: s.left, right: s.right, result: s.result, remainder: s.remainder };
      const shown = all[problem.highlight];
      check(
        Object.entries(all).filter(([k, v]) => k !== problem.highlight && v === shown).length === 0,
        'the highlighted number appears only once',
      );
      check(skill.params.terms.includes(bucket as Term), 'the term is one of the skill');
      break;
    }
    case 'word': {
      check(problem.kind === 'word', 'a word problem tells a story');
      if (problem.kind !== 'word') break;
      const template = data.wordTemplates.find((t) => t.textKey === problem.template);
      check(
        template !== undefined && skill.params.templates.includes(template.id),
        'the story is one of the skill templates',
      );
      if (!template) break;
      check(template.family === bucket, `the story is a ${bucket} story`);
      check(
        problem.operation === template.operation,
        'the operation step is the template operation',
      );
      const lists = new Map(data.wordLists.map((l) => [l.id, l]));
      const used = new Map<string, string[]>();
      for (const [name, v] of Object.entries(template.vars)) {
        const got = problem.vars[name];
        if (v.kind === 'int')
          check(
            typeof got === 'number' && got >= v.min && got <= v.max,
            `${name} is in ${v.min}-${v.max}`,
          );
        if (v.kind === 'calc')
          check(
            got === templateValue(v.expr, problem.vars),
            `${name} is worked out from the other numbers`,
          );
        if (v.kind === 'word') {
          const list = lists.get(v.list)!;
          const entry =
            list.kind === 'thing' && typeof got === 'string' ? got.replace(/\.other$/, '') : got;
          check(
            typeof got === 'string' &&
              list.entries.includes(entry as string) &&
              (list.kind === 'name' || got.endsWith('.other')),
            `${name} is a word from ${v.list}`,
          );
          check(typeof got === 'string' && catalog[got] !== undefined, `${name} has catalog text`);
          used.set(v.list, [...(used.get(v.list) ?? []), entry as string]);
        }
        if (v.kind === 'form') {
          const thing = String(problem.vars[v.word]).replace(/\.other$/, '');
          const count = problem.vars[v.count];
          check(
            got === `${thing}.${count === 1 ? 'one' : 'other'}`,
            `${name} agrees with ${v.count}`,
          );
        }
        if (typeof got === 'number') check(got <= 1000, `${name} is at most 1000`);
      }
      for (const [list, entries] of used) {
        check(
          new Set(entries).size === entries.length ||
            lists.get(list)!.entries.length < entries.length,
          `different words from ${list}`,
        );
      }
      const answer = storyAnswer(problem);
      check(answer !== null, 'the story has a whole-number answer');
      if (answer && 'value' in answer) {
        check(
          problem.model.kind === 'equation' && value(problem.model.left) === answer.value,
          'the model is the story arithmetic',
        );
        check(answer.value <= 1000, 'the answer is at most 1000');
      }
      if (answer && 'quotient' in answer) {
        check(problem.model.kind === 'divrem', 'a leftover story asks for quotient and remainder');
        check(answer.remainder >= 1, 'something is left over');
      }
      break;
    }
  }
  return broken;
}
