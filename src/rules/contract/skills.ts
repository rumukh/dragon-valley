/**
 * Skills: a generator plus parameters. Content lists skills; levels, bosses, dragons and the
 * placement check refer to them by ID. Each generator's parameters are validated by its own
 * schema, and `skillItems` enumerates the items (problems' retrieval units) a skill can produce.
 *
 * Parameter bounds follow the Czech 3rd-grade program (docs/curriculum.md): remainder division
 * keeps the dividend at most 99 with the quotient inside the table; 2-digit x 1-digit and
 * 2-digit : 1-digit stay within 1000 and, for division, without remainder; x10/x100 and tens x
 * 1-digit stay within 1000. The grades 1-2 generators (`num.*`, `add.*`, `sub.fact`,
 * `addsub.2d`) stay within 20 (facts) and 100 (2-digit work), docs/curriculum.md §7.2.
 */
import { failure, isRecord, schema, success } from '@aegis/runtime';
import type { Outcome, Schema } from '@aegis/runtime';
import { OPERATORS, TERMS, WORD_FAMILIES } from './kinds';
import type { GeneratorId, Operator, Term, WordFamily } from './kinds';
import { addFactId, bucketId, divFactId, mulFactId, subFactId } from './problems';
import { catalogKey, contentId, int, intRange, oneOf, uniqueArray } from './schema';

/** Whether a property must hold, may hold or must not hold for generated problems. */
export const REQUIREMENTS = ['required', 'allowed', 'forbidden'] as const;
export type Requirement = (typeof REQUIREMENTS)[number];
const requirement = oneOf(REQUIREMENTS);

export interface MulFactParams {
  /** The times tables practised, e.g. `[7]`. */
  tables: number[];
  /** Range of the other factor, usually `[0, 10]`. */
  factors: [number, number];
  /** Which position the table factor takes: `7 · k`, `k · 7` or both (commuted facts). */
  order: 'table-first' | 'table-second' | 'both';
}
export interface DivFactParams {
  divisors: number[];
  quotients: [number, number];
}
export interface MulMissingParams {
  /** The known factor's tables (never 0, so the blank is unique). */
  tables: number[];
  /** Range of the missing factor. */
  factors: [number, number];
  position: 'first' | 'second' | 'both';
}
export interface DivRemainderParams {
  divisors: number[];
  /** Quotient range; the core program keeps it inside the table (at most 9, occasionally 10). */
  quotients: [number, number];
  /** Largest dividend (at most 99 in the core program). */
  dividendMax: number;
  remainder: Requirement;
}
export interface MulPower10Params {
  powers: (10 | 100)[];
  factors: [number, number];
  resultMax: number;
}
export interface MulTensParams {
  /** Tens digits of the 2-digit multiple of ten, e.g. `[1, 9]` for 10..90. */
  tens: [number, number];
  digits: number[];
  resultMax: number;
}
export interface Mul2d1dParams {
  twoDigit: [number, number];
  oneDigit: [number, number];
  /** Carry from the ones into the tens (14 · 3 carries; 23 · 3 does not). */
  carry: Requirement;
  resultMax: number;
}
export interface Div2d1dParams {
  divisors: number[];
  quotients: [number, number];
  dividendMax: number;
  /** Regrouping: the tens digit is not a multiple of the divisor (48 : 3 regroups; 69 : 3 does not). */
  regroup: Requirement;
  /** The core program has no remainder here. */
  remainder: Requirement;
}
export interface OrderOpsParams {
  operators: Operator[];
  brackets: Requirement;
  /** Number of operations per expression. */
  operations: [number, number];
  operands: [number, number];
  resultMax: number;
}
export interface CompareParams {
  sides: 'fact-number' | 'fact-fact' | 'expression';
  tables: number[];
  /** Share of comparisons whose answer is `=`. */
  equalShare: number;
}
export interface WordParams {
  /** Word template IDs (`content.wordTemplates`). */
  templates: string[];
}
export interface TermsParams {
  terms: Term[];
  tables: number[];
}

// Grades 1-2 (docs/curriculum.md §7.2).

/** Bands of `num.count` (`count:<band>`) and `num.compare` (`ncompare:<band>`) buckets. */
export const COUNT_BANDS = ['0-5', '6-10', '11-20'] as const;
export const COMPARE_BANDS = ['0-10', '0-20', '0-100'] as const;
/** What a `num.place` problem asks: the tens digit, the ones digit, or the number they make. */
export const PLACE_ASKS = ['tens', 'ones', 'compose'] as const;
/** `addsub.2d` shapes: whole tens ± whole tens, 2-digit ± 1-digit, 2-digit ± 2-digit. */
export const ADDSUB_SHAPES = ['tens', '2d1d', '2d2d'] as const;
export type AddSubShape = (typeof ADDSUB_SHAPES)[number];

export interface NumCountParams {
  /** How many objects (dots in ten-frames) there are, 0..20. */
  numbers: [number, number];
}
export interface NumCompareParams {
  /** Both numbers lie in this range, 0..100. */
  numbers: [number, number];
  /** Share of comparisons whose answer is `=`. */
  equalShare: number;
}
export interface NumPlaceParams {
  /** The 2-digit numbers, 10..99. */
  numbers: [number, number];
  asks: (typeof PLACE_ASKS)[number][];
}
export interface AddFactParams {
  /** Range of both addends, within 0..10. */
  addends: [number, number];
  /** Largest sum (10 for "within 10", 20 for "within 20"). */
  sumMax: number;
  /** Crossing ten: both addends below 10 and the sum above 10 (8 + 5 crosses; 7 + 3 does not). */
  crossing: Requirement;
}
export interface SubFactParams {
  /** Range of the subtrahend, within 0..10. */
  subtrahends: [number, number];
  /** Range of the difference, within 0..10. */
  differences: [number, number];
  /** Largest minuend (10 for "within 10", 20 for "within 20"). */
  minuendMax: number;
  /** Crossing ten: the minuend above 10 and its ones below the subtrahend (13 - 6 crosses). */
  crossing: Requirement;
}
export interface AddMissingParams {
  /** The known addend's range. */
  known: [number, number];
  /** The missing addend's range. */
  missing: [number, number];
  /** Largest sum, at most 20. */
  sumMax: number;
  /** Where the blank stands: `? + 4 = 9`, `7 + ? = 10` or both. */
  position: 'first' | 'second' | 'both';
}
export interface AddSub2dParams {
  operators: ('add' | 'sub')[];
  shapes: AddSubShape[];
  /** Range of the 2-digit operand(s) (`[10, 19]` keeps 1st-grade work within 20). */
  twoDigit: [number, number];
  /** Carry (addition) or borrow (subtraction) across ten. */
  crossing: Requirement;
  /** Largest number in the problem (sum or minuend), at most 100. */
  resultMax: number;
}

export interface SkillParamsByGenerator {
  'mul.fact': MulFactParams;
  'div.fact': DivFactParams;
  'mul.missing': MulMissingParams;
  'div.remainder': DivRemainderParams;
  'mul.power10': MulPower10Params;
  'mul.tens': MulTensParams;
  'mul.2d1d': Mul2d1dParams;
  'div.2d1d': Div2d1dParams;
  'order.ops': OrderOpsParams;
  compare: CompareParams;
  word: WordParams;
  terms: TermsParams;
  'num.count': NumCountParams;
  'num.compare': NumCompareParams;
  'num.place': NumPlaceParams;
  'add.fact': AddFactParams;
  'sub.fact': SubFactParams;
  'add.missing': AddMissingParams;
  'addsub.2d': AddSub2dParams;
}

/** A skill: what the child practises, as one generator with parameters. */
export type Skill = {
  [G in GeneratorId]: {
    id: string;
    /** Parent-facing name in the progress view. */
    titleKey: string;
    generator: G;
    params: SkillParamsByGenerator[G];
  };
}[GeneratorId];

const table = int(0, 10);
const tableNonZero = int(1, 10);
const tables = uniqueArray(table, { min: 1, max: 11 });

export const SKILL_PARAM_SCHEMAS: { [G in GeneratorId]: Schema<SkillParamsByGenerator[G]> } = {
  'mul.fact': schema.object({
    tables,
    factors: intRange(0, 10),
    order: oneOf(['table-first', 'table-second', 'both'] as const),
  }),
  'div.fact': schema.object({
    divisors: uniqueArray(tableNonZero, { min: 1, max: 10 }),
    quotients: intRange(0, 10),
  }),
  'mul.missing': schema.object({
    tables: uniqueArray(tableNonZero, { min: 1, max: 10 }),
    factors: intRange(0, 10),
    position: oneOf(['first', 'second', 'both'] as const),
  }),
  'div.remainder': schema.object({
    divisors: uniqueArray(int(2, 10), { min: 1, max: 9 }),
    quotients: intRange(0, 99),
    dividendMax: int(1, 999),
    remainder: requirement,
  }),
  'mul.power10': schema.object({
    powers: uniqueArray(schema.union(schema.literal(10), schema.literal(100)), { min: 1, max: 2 }),
    factors: intRange(0, 999),
    resultMax: int(1, 100_000),
  }),
  'mul.tens': schema.object({
    tens: intRange(1, 9),
    digits: uniqueArray(int(1, 9), { min: 1, max: 9 }),
    resultMax: int(1, 100_000),
  }),
  'mul.2d1d': schema.object({
    twoDigit: intRange(10, 99),
    oneDigit: intRange(2, 9),
    carry: requirement,
    resultMax: int(1, 100_000),
  }),
  'div.2d1d': schema.object({
    divisors: uniqueArray(int(2, 9), { min: 1, max: 8 }),
    quotients: intRange(1, 99),
    dividendMax: int(10, 999),
    regroup: requirement,
    remainder: requirement,
  }),
  'order.ops': schema.object({
    operators: uniqueArray(oneOf(OPERATORS), { min: 2, max: 4 }),
    brackets: requirement,
    operations: intRange(2, 3),
    operands: intRange(0, 100),
    resultMax: int(1, 100_000),
  }),
  compare: schema.object({
    sides: oneOf(['fact-number', 'fact-fact', 'expression'] as const),
    tables,
    equalShare: int(0, 100),
  }),
  word: schema.object({ templates: uniqueArray(contentId, { min: 1, max: 64 }) }),
  terms: schema.object({ terms: uniqueArray(oneOf(TERMS), { min: 1, max: 6 }), tables }),
  'num.count': schema.object({ numbers: intRange(0, 20) }),
  'num.compare': schema.object({ numbers: intRange(0, 100), equalShare: int(0, 100) }),
  'num.place': schema.object({
    numbers: intRange(10, 99),
    asks: uniqueArray(oneOf(PLACE_ASKS), { min: 1, max: 3 }),
  }),
  'add.fact': schema.object({
    addends: intRange(0, 10),
    sumMax: int(0, 20),
    crossing: requirement,
  }),
  'sub.fact': schema.object({
    subtrahends: intRange(0, 10),
    differences: intRange(0, 10),
    minuendMax: int(0, 20),
    crossing: requirement,
  }),
  'add.missing': schema.object({
    known: intRange(0, 10),
    missing: intRange(0, 10),
    sumMax: int(0, 20),
    position: oneOf(['first', 'second', 'both'] as const),
  }),
  'addsub.2d': schema.object({
    operators: uniqueArray(oneOf(['add', 'sub'] as const), { min: 1, max: 2 }),
    shapes: uniqueArray(oneOf(ADDSUB_SHAPES), { min: 1, max: 3 }),
    twoDigit: intRange(10, 99),
    crossing: requirement,
    resultMax: int(1, 100),
  }),
};

const generatorSchema = oneOf(Object.keys(SKILL_PARAM_SCHEMAS) as GeneratorId[]);

/** Parses `{ id, titleKey, generator, params }`, validating `params` by the generator's schema. */
export const skillSchema: Schema<Skill> = {
  parse(value: unknown, path = ''): Outcome<Skill> {
    if (!isRecord(value)) return failure('invalid-data', 'Expected a skill object.', { path });
    const keys = Object.keys(value).sort().join(',');
    if (keys !== 'generator,id,params,titleKey') {
      return failure('invalid-data', 'A skill has exactly id, titleKey, generator and params.', {
        path,
      });
    }
    const id = contentId.parse(value.id, `${path}.id`);
    if (!id.ok) return id;
    const titleKey = catalogKey.parse(value.titleKey, `${path}.titleKey`);
    if (!titleKey.ok) return titleKey;
    const generator = generatorSchema.parse(value.generator, `${path}.generator`);
    if (!generator.ok) return generator;
    const params = (SKILL_PARAM_SCHEMAS[generator.value] as Schema<unknown>).parse(
      value.params,
      `${path}.params`,
    );
    if (!params.ok) return params;
    return success({
      id: id.value,
      titleKey: titleKey.value,
      generator: generator.value,
      params: params.value,
    } as Skill);
  },
};

function range([low, high]: [number, number]): number[] {
  const values: number[] = [];
  for (let value = low; value <= high; value++) values.push(value);
  return values;
}

/** Bucket families for open-ended skills (`addsub.2d` has one per operator). */
export const BUCKET_FAMILIES = {
  'div.remainder': 'rem',
  'mul.power10': 'pow10',
  'mul.tens': 'tens',
  'mul.2d1d': 'mul2d1d',
  'div.2d1d': 'div2d1d',
  'order.ops': 'order',
  compare: 'compare',
  word: 'word',
  terms: 'terms',
  'num.count': 'count',
  'num.compare': 'ncompare',
  'num.place': 'place',
  'addsub.2d': ['add2d', 'sub2d'],
} as const;

/** Whether `a + b` crosses ten: both addends' ones make ten or more and the sum exceeds 10. */
export function addCrossesTen(a: number, b: number): boolean {
  return a + b > 10 && (a % 10) + (b % 10) >= 10;
}

/** Whether `m - s` crosses ten: the minuend exceeds 10 and its ones are below the subtrahend's. */
export function subCrossesTen(m: number, s: number): boolean {
  return m > 10 && m % 10 < s % 10;
}

function meets(requirement: Requirement, holds: boolean): boolean {
  return requirement === 'allowed' || (requirement === 'required') === holds;
}

/** Operand ranges of an `addsub.2d` shape: `[low, high]` of the first and the second operand. */
function shapeOperands(
  shape: AddSubShape,
  twoDigit: [number, number],
): { first: number[]; second: number[] } {
  const two = range(twoDigit);
  if (shape === 'tens') {
    const tens = two.filter((n) => n % 10 === 0);
    return { first: tens, second: tens };
  }
  return { first: two, second: shape === '2d1d' ? range([1, 9]) : two };
}

/**
 * The item IDs a skill can produce, sorted. Word skills need the template families, supplied by
 * `familyOf(templateId)`. An empty result means the skill can never produce a problem; content
 * validation rejects it.
 */
export function skillItems(
  skill: Skill,
  familyOf: (template: string) => WordFamily | null,
): string[] {
  const items = new Set<string>();
  switch (skill.generator) {
    case 'mul.fact':
      for (const t of skill.params.tables) {
        for (const f of range(skill.params.factors)) {
          if (skill.params.order !== 'table-second') items.add(mulFactId(t, f));
          if (skill.params.order !== 'table-first') items.add(mulFactId(f, t));
        }
      }
      break;
    case 'div.fact':
      for (const d of skill.params.divisors) {
        for (const q of range(skill.params.quotients)) items.add(divFactId(d * q, d));
      }
      break;
    case 'mul.missing':
      for (const t of skill.params.tables) {
        for (const f of range(skill.params.factors)) items.add(divFactId(t * f, t));
      }
      break;
    case 'div.remainder': {
      const { divisors, quotients, dividendMax, remainder } = skill.params;
      for (const d of divisors) {
        const possible = range(quotients).some((q) =>
          range([0, d - 1]).some(
            (r) =>
              q * d + r <= dividendMax &&
              (remainder === 'allowed' || (remainder === 'required') === r > 0),
          ),
        );
        if (possible) items.add(bucketId('rem', `d${d}`));
      }
      break;
    }
    case 'mul.power10':
      for (const p of skill.params.powers) {
        if (skill.params.factors[0] * p <= skill.params.resultMax) {
          items.add(bucketId('pow10', `x${p}`));
        }
      }
      break;
    case 'mul.tens':
      for (const d of skill.params.digits) {
        if (skill.params.tens[0] * 10 * d <= skill.params.resultMax) {
          items.add(bucketId('tens', `d${d}`));
        }
      }
      break;
    case 'mul.2d1d': {
      const { twoDigit, oneDigit, carry, resultMax } = skill.params;
      for (const a of range(twoDigit)) {
        for (const b of range(oneDigit)) {
          if (a * b > resultMax) continue;
          const carries = (a % 10) * b >= 10;
          if (carry === 'allowed' || (carry === 'required') === carries) {
            items.add(bucketId('mul2d1d', carries ? 'carry' : 'nocarry'));
          }
        }
      }
      break;
    }
    case 'div.2d1d': {
      const { divisors, quotients, dividendMax, regroup, remainder } = skill.params;
      for (const d of divisors) {
        for (const q of range(quotients)) {
          for (const r of range([0, d - 1])) {
            const dividend = q * d + r;
            if (dividend < 10 || dividend > dividendMax) continue;
            if (remainder !== 'allowed' && (remainder === 'required') !== r > 0) continue;
            const regroups = ((dividend - (dividend % 10)) / 10) % d !== 0;
            if (regroup !== 'allowed' && (regroup === 'required') !== regroups) continue;
            items.add(bucketId('div2d1d', regroups ? 'regroup' : 'noregroup'));
          }
        }
      }
      break;
    }
    case 'order.ops':
      if (skill.params.brackets !== 'forbidden') items.add(bucketId('order', 'brackets'));
      if (skill.params.brackets !== 'required') items.add(bucketId('order', 'no-brackets'));
      break;
    case 'compare':
      items.add(bucketId('compare', skill.params.sides));
      break;
    case 'word':
      for (const template of skill.params.templates) {
        const family = familyOf(template);
        if (family !== null) items.add(bucketId('word', family));
      }
      break;
    case 'terms':
      for (const term of skill.params.terms) items.add(bucketId('terms', term));
      break;
    case 'num.count': {
      const [low, high] = skill.params.numbers;
      for (const band of COUNT_BANDS) {
        const [from, to] = band.split('-').map(Number) as [number, number];
        if (from <= high && to >= low) items.add(bucketId('count', band));
      }
      break;
    }
    case 'num.compare': {
      const high = skill.params.numbers[1];
      const band = high <= 10 ? '0-10' : high <= 20 ? '0-20' : '0-100';
      items.add(bucketId('ncompare', band));
      break;
    }
    case 'num.place':
      for (const ask of skill.params.asks) items.add(bucketId('place', ask));
      break;
    case 'add.fact': {
      const { addends, sumMax, crossing } = skill.params;
      for (const a of range(addends)) {
        for (const b of range(addends)) {
          if (a + b <= sumMax && meets(crossing, addCrossesTen(a, b))) items.add(addFactId(a, b));
        }
      }
      break;
    }
    case 'sub.fact': {
      const { subtrahends, differences, minuendMax, crossing } = skill.params;
      for (const s of range(subtrahends)) {
        for (const d of range(differences)) {
          if (s + d <= minuendMax && meets(crossing, subCrossesTen(s + d, s))) {
            items.add(subFactId(s + d, s));
          }
        }
      }
      break;
    }
    case 'add.missing': {
      const { known, missing, sumMax } = skill.params;
      for (const k of range(known)) {
        for (const m of range(missing)) if (k + m <= sumMax) items.add(subFactId(k + m, k));
      }
      break;
    }
    case 'addsub.2d': {
      const { operators, shapes, twoDigit, crossing, resultMax } = skill.params;
      for (const shape of shapes) {
        const { first, second } = shapeOperands(shape, twoDigit);
        for (const a of first) {
          for (const b of second) {
            if (operators.includes('add') && a + b <= resultMax) {
              const carries = addCrossesTen(a, b);
              if (meets(crossing, carries)) {
                items.add(bucketId('add2d', `${shape}-${carries ? 'carry' : 'nocarry'}`));
              }
            }
            if (operators.includes('sub') && a <= resultMax && a >= b) {
              const borrows = a % 10 < b % 10;
              if (meets(crossing, borrows)) {
                items.add(bucketId('sub2d', `${shape}-${borrows ? 'borrow' : 'noborrow'}`));
              }
            }
          }
        }
      }
      break;
    }
  }
  return [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export const wordFamilySchema = oneOf(WORD_FAMILIES);
