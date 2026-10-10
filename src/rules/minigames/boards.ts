/**
 * Minigame boards: generating each board of a minigame round, projecting it as a typed
 * `BoardView`, and the credits a move earns.
 *
 * | Activity        | Narrative kind     | Board                                                         |
 * | --------------- | ------------------ | ------------------------------------------------------------- |
 * | `memory-match`  | `matching`         | `pairs` facts with different values: `7 · 8` ↔ `56`, `56 : 7` ↔ `8` |
 * | `number-trail`  | `ordering`         | multiples of a table, `length` long, `gaps` stones to order    |
 * | `egg-grid`      | `dv.egg-grid`      | a product (from a fact), find every rectangle up to 10 × 10    |
 * | `fact-family`   | `dv.fact-family`   | a family a, b, a · b with different factors of at least 2      |
 *
 * Boards draw from the round's items with the `problems` stream, prefer the focus egg's facts
 * (as Feeding Time does), and never repeat the previous board of the round.
 *
 * Credits: a matched pair, a new rectangle or a finished family or trail is a retrieval of its
 * facts. A memory pair found with no mismatch so far on the board counts as fast; a family or
 * trail right on the first check counts as ok, after more checks as slow (correct, no box move).
 * Every credited step also earns `balance.coins.correct` coins.
 */
import { createMinigameRegistry } from '@aegis/narrative';
import type { Json, MinigameDefinition, MinigameState } from '@aegis/narrative';
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import {
  CARD_BACK_LABEL,
  addCrossesTen,
  addFactId,
  bucketId,
  divFactId,
  mulFactId,
  parseCardLabel,
  parseItemId,
  subCrossesTen,
  subFactId,
} from '../contract';
import type {
  AddSubShape,
  BundleSticksBoard,
  BoardView,
  EggGridBoard,
  EggGridSplit,
  Expr,
  FactFamilyBoard,
  GolemOrdersBoard,
  MinigameActivityKind,
  NumberTrailBoard,
  ResponseBucket,
  SharingFeastBoard,
  Skill,
  TenFrameBoard,
  Term,
} from '../contract';
import { orderProblem } from '../learning/generators/order';
import { shuffled } from '../learning/selection';
import { EGG_GRID_KIND, eggGridAdapter, rectangles } from './egg-grid';
import type { EggGridConfig, EggGridState } from './egg-grid';
import { FACT_FAMILY_KIND, factFamilyAdapter } from './fact-family';
import type { FactFamilyConfig, FactFamilyState } from './fact-family';
import { TEN_FRAME_KIND, tenFrameAdapter } from './ten-frame';
import type { TenFrameConfig, TenFrameState } from './ten-frame';
import { BUNDLE_STICKS_KIND, bundleSticksAdapter } from './bundle-sticks';
import type { BundleSticksConfig, BundleSticksState } from './bundle-sticks';
import { GOLEM_ORDERS_KIND, bracketed, golemOrdersAdapter, readsAsComputed } from './golem-orders';
import type { GolemOrdersConfig, GolemOrdersState } from './golem-orders';
import { SHARING_FEAST_KIND, sharingFeastAdapter } from './sharing-feast';
import type { SharingFeastConfig, SharingFeastState } from './sharing-feast';
import type { ReadState } from '../types';

/** The minigame registry of the rules: the narrative built-ins plus Dragon Valley's adapters. */
export const MINIGAMES = createMinigameRegistry()
  .register(eggGridAdapter)
  .register(factFamilyAdapter)
  .register(sharingFeastAdapter)
  .register(golemOrdersAdapter)
  .register(tenFrameAdapter)
  .register(bundleSticksAdapter);

export type Options = Readonly<Record<string, number | boolean | string>>;

export interface BoardRequest {
  activity: MinigameActivityKind;
  /** The definition ID (`<round>.b<board>`), also the base of the instance ID. */
  id: string;
  /** The board's number in its round (1-based) and the round's number of boards, when known:
   * Egg Grid boards go from easy to hard over a round. */
  board?: number;
  boards?: number;
  pool: readonly string[];
  focus: readonly string[] | null;
  skills: readonly DeepReadonly<Skill>[];
  options: Options;
  previous: DeepReadonly<MinigameDefinition> | null;
  state: ReadState;
  random: RandomStream;
}

interface MatchingConfig {
  cards: { id: string; pair: string; labelKey: string; backLabelKey: string }[];
}
interface MatchingState {
  open: string[];
  matched: string[];
  attempts: number;
}
interface OrderingConfig {
  items: { id: string; labelKey: string }[];
  solution: string[];
}
interface OrderingState {
  order: string[];
  submitted: boolean;
  attempts: number;
}

/** The value a fact card pairs with: the product or the quotient. */
function factValue(item: string): { face: string; value: number } | null {
  const parsed = parseItemId(item);
  if (parsed?.kind === 'mul') return { face: `fact:${item}`, value: parsed.product };
  if (parsed?.kind === 'div') return { face: `fact:${item}`, value: parsed.quotient };
  // Additive faces are `expr:` labels: `+` is not allowed in a narrative ID (`fact:add:3+5`).
  if (parsed?.kind === 'add')
    return { face: `expr:add:${parsed.a}:${parsed.b}`, value: parsed.sum };
  if (parsed?.kind === 'sub') {
    return { face: `expr:sub:${parsed.minuend}:${parsed.subtrahend}`, value: parsed.difference };
  }
  return null;
}

/** Products an egg grid can be built for, by item. */
/**
 * Products an egg grid can be built for, by item: facts of two factors of at least 2, so every
 * board has a real array to find (`1 × 5` is only a line of eggs).
 */
function eggProducts(pool: readonly string[]): { item: string; product: number }[] {
  return pool.flatMap((item) => {
    const parsed = parseItemId(item);
    if (parsed?.kind === 'mul' && parsed.a >= 2 && parsed.b >= 2) {
      return [{ item, product: parsed.product }];
    }
    if (parsed?.kind === 'div' && parsed.divisor >= 2 && parsed.quotient >= 2) {
      return [{ item, product: parsed.dividend }];
    }
    return [];
  });
}

/**
 * The part of `sorted` (easiest first) for board `board` of `boards`: the round's boards take
 * consecutive bands, so a round goes from easy to hard. Everything when the board is unknown.
 */
function band<T>(sorted: readonly T[], board?: number, boards?: number): T[] {
  if (board === undefined || boards === undefined || boards <= 1 || sorted.length <= 1) {
    return [...sorted];
  }
  const k = Math.min(Math.max(board, 1), boards) - 1;
  const start = (k * sorted.length - ((k * sorted.length) % boards)) / boards;
  const stop = ((k + 1) * sorted.length - (((k + 1) * sorted.length) % boards)) / boards;
  return sorted.slice(start, Math.max(stop, start + 1));
}

/** Families with two different factors of at least 2, by item. */
function families(pool: readonly string[]): { item: string; a: number; b: number }[] {
  return pool.flatMap((item) => {
    const parsed = parseItemId(item);
    if (parsed?.kind === 'mul' && parsed.a >= 2 && parsed.b >= 2 && parsed.a !== parsed.b) {
      return [{ item, a: parsed.a, b: parsed.b }];
    }
    if (
      parsed?.kind === 'div' &&
      parsed.divisor >= 2 &&
      parsed.quotient >= 2 &&
      parsed.divisor !== parsed.quotient
    ) {
      return [{ item, a: parsed.divisor, b: parsed.quotient }];
    }
    return [];
  });
}

/** Additive families `a + b = sum`, by addition or subtraction item. */
function additiveFamilies(pool: readonly string[]): { item: string; a: number; b: number }[] {
  return pool.flatMap((item) => {
    const parsed = parseItemId(item);
    if (parsed?.kind === 'add' && parsed.a !== parsed.b)
      return [{ item, a: parsed.a, b: parsed.b }];
    if (parsed?.kind === 'sub' && parsed.subtrahend !== parsed.difference) {
      return [{ item, a: parsed.subtrahend, b: parsed.difference }];
    }
    return [];
  });
}

interface TrailCandidate {
  step: number;
  length: number;
  start: number;
  direction?: 'up' | 'down';
}

/** Steps a number trail can count in: multiplication tables, or grade 1-2 counting trails. */
function trailCandidates(
  skills: readonly DeepReadonly<Skill>[],
  options: Options = {},
): TrailCandidate[] {
  const requestedLength = Number(options['length'] ?? 10);
  const steps = new Set<number>();
  let additiveMax = 0;
  let hasYoungSkill = false;
  for (const skill of skills) {
    if (skill.generator === 'mul.fact' || skill.generator === 'mul.missing') {
      skill.params.tables.forEach((table) => steps.add(table));
    } else if (skill.generator === 'div.fact') {
      skill.params.divisors.forEach((divisor) => steps.add(divisor));
    } else if (skill.generator === 'mul.tens') {
      // Count in whole tens: 30, 60, 90, … (tens times one digit).
      range(skill.params.tens).forEach((tens) => steps.add(tens * 10));
    } else if (skill.generator === 'num.count' || skill.generator === 'num.compare') {
      hasYoungSkill = true;
      additiveMax = Math.max(additiveMax, skill.params.numbers[1]);
    } else if (skill.generator === 'num.place') {
      hasYoungSkill = true;
      additiveMax = Math.max(additiveMax, skill.params.numbers[1]);
    } else if (skill.generator === 'add.fact') {
      hasYoungSkill = true;
      additiveMax = Math.max(additiveMax, skill.params.sumMax);
    } else if (skill.generator === 'sub.fact') {
      hasYoungSkill = true;
      additiveMax = Math.max(additiveMax, skill.params.minuendMax);
    } else if (skill.generator === 'add.missing') {
      hasYoungSkill = true;
      additiveMax = Math.max(additiveMax, skill.params.sumMax);
    } else if (skill.generator === 'addsub.2d') {
      hasYoungSkill = true;
      additiveMax = Math.max(additiveMax, skill.params.resultMax);
    }
  }
  const tableTrails = [...steps]
    .filter((step) => step >= 2)
    .sort((a, b) => a - b)
    .map((step) => ({ step, length: requestedLength, start: step }) satisfies TrailCandidate);
  if (tableTrails.length > 0 || !hasYoungSkill) return tableTrails;

  const max = Math.max(additiveMax, 10);
  const candidates: TrailCandidate[] = [];
  for (const step of [1, 2, 10]) {
    const length = Math.min(requestedLength, Math.floor(max / step) + 1);
    if (length >= 3) candidates.push({ step, length, start: 0 });
  }
  const downLength = Math.min(requestedLength, max + 1);
  if (downLength >= 3)
    candidates.push({ step: 1, length: downLength, start: max, direction: 'down' });
  return candidates;
}

/** Distinct-value pairs a Memory Match board can deal in its mode. */
function matchable(
  pool: readonly string[],
  skills: readonly DeepReadonly<Skill>[],
  mode: unknown,
): number {
  if (mode === 'term') {
    const terms = skills.flatMap((s) => (s.generator === 'terms' ? s.params.terms : []));
    return new Set(terms.filter((term) => pool.includes(bucketId('terms', term)))).size;
  }
  if (mode === 'family') {
    return new Set(
      pool
        .map((item) => parseItemId(item))
        .flatMap((p) =>
          p?.kind === 'mul'
            ? [p.product]
            : p?.kind === 'add'
              ? [p.sum]
              : p?.kind === 'sub'
                ? [p.minuend]
                : [],
        ),
    ).size;
  }
  const values = new Set<string>(
    pool.flatMap((item) => {
      const fact = factValue(item);
      return fact === null ? [] : [`${fact.value}`];
    }),
  );
  const leftovers = feasts(pool, skills).filter((source) => source.item.startsWith('rem:'));
  for (const source of leftovers) {
    for (const deal of source.deals) {
      const left = deal.total % deal.baskets;
      values.add(`${(deal.total - left) / deal.baskets}r${left}`);
    }
  }
  return values.size;
}

interface Feast {
  item: string;
  /** Every `{ total, baskets }` this source can deal. */
  deals: { total: number; baskets: number }[];
}

function range([low, high]: readonly [number, number] | readonly number[]): number[] {
  const values: number[] = [];
  for (let value = low ?? 0; value <= (high ?? -1); value++) values.push(value);
  return values;
}

function fits(requirement: 'required' | 'allowed' | 'forbidden', holds: boolean): boolean {
  return requirement === 'allowed' || (requirement === 'required') === holds;
}

function shapeOperands(
  shape: AddSubShape,
  twoDigit: readonly [number, number],
): { first: number[]; second: number[] } {
  const two = range(twoDigit);
  if (shape === 'tens') {
    const tens = two.filter((n) => n % 10 === 0);
    return { first: tens, second: tens };
  }
  return { first: two, second: shape === '2d1d' ? range([1, 9]) : two };
}

function optionTask<T extends string>(
  options: Options,
  allowed: readonly T[],
  fallback: T | 'mix',
) {
  const task = options['task'];
  return typeof task === 'string' && (allowed as readonly string[]).includes(task)
    ? (task as T)
    : fallback;
}

interface TenFrameSource {
  item: string;
  task: TenFrameConfig['task'];
  a: number;
  b: number | null;
  target: number;
}

function tenFrameSources(
  pool: readonly string[],
  skills: readonly DeepReadonly<Skill>[],
  options: Options = {},
): TenFrameSource[] {
  const wanted = optionTask(options, ['show', 'make-ten', 'cross'] as const, 'mix');
  const sources: TenFrameSource[] = [];
  const push = (source: TenFrameSource) => {
    if (wanted === 'mix' || source.task === wanted) sources.push(source);
  };
  for (const item of pool) {
    const parsed = parseItemId(item);
    if (parsed?.kind === 'add' && parsed.a <= 10 && parsed.b <= 10 && parsed.sum <= 20) {
      if (parsed.sum > 10 && parsed.a < 10 && parsed.b > 10 - parsed.a) {
        push({ item, task: 'cross', a: parsed.a, b: parsed.b, target: parsed.sum });
      } else if (parsed.sum === 10) {
        push({ item, task: 'make-ten', a: parsed.a, b: null, target: 10 });
      } else {
        push({ item, task: 'show', a: 0, b: null, target: parsed.sum });
      }
    }
  }
  for (const skill of skills) {
    if (skill.generator !== 'num.count') continue;
    for (const item of pool) {
      const parsed = parseItemId(item);
      if (parsed?.kind !== 'bucket' || parsed.family !== 'count') continue;
      const [low, high] = skill.params.numbers;
      for (const target of range([Math.max(0, low), Math.min(20, high)])) {
        push({ item, task: 'show', a: 0, b: null, target });
      }
    }
  }
  return sources;
}

interface BundleSource {
  item: string;
  task: BundleSticksConfig['task'];
  target: number | null;
  a: number | null;
  b: number | null;
}

function addSub2dExamples(
  skill: Extract<DeepReadonly<Skill>, { generator: 'addsub.2d' }>,
  item: string,
): BundleSource[] {
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'bucket' || (parsed.family !== 'add2d' && parsed.family !== 'sub2d'))
    return [];
  const match = /^(tens|2d1d|2d2d)-(carry|nocarry|borrow|noborrow)$/.exec(parsed.bucket);
  if (!match) return [];
  const shape = match[1] as AddSubShape;
  if (!skill.params.shapes.includes(shape)) return [];
  const task = parsed.family === 'add2d' ? 'add' : 'sub';
  if (!skill.params.operators.includes(task)) return [];
  const crosses = match[2] === 'carry' || match[2] === 'borrow';
  if (!fits(skill.params.crossing, crosses)) return [];
  const { first, second } = shapeOperands(shape, skill.params.twoDigit);
  const examples: BundleSource[] = [];
  for (const a of first) {
    for (const b of second) {
      if (task === 'add') {
        if (a + b <= skill.params.resultMax && addCrossesTen(a, b) === crosses) {
          examples.push({ item, task, target: null, a, b });
        }
      } else if (a >= b && a <= skill.params.resultMax && subCrossesTen(a, b) === crosses) {
        examples.push({ item, task, target: null, a, b });
      }
    }
  }
  return examples;
}

function bundleSources(
  pool: readonly string[],
  skills: readonly DeepReadonly<Skill>[],
  options: Options = {},
): BundleSource[] {
  const wanted = optionTask(options, ['build', 'add', 'sub'] as const, 'mix');
  const sources: BundleSource[] = [];
  const push = (source: BundleSource) => {
    if (wanted === 'mix' || source.task === wanted) sources.push(source);
  };
  for (const skill of skills) {
    if (skill.generator === 'num.place') {
      for (const item of pool) {
        const parsed = parseItemId(item);
        if (parsed?.kind !== 'bucket' || parsed.family !== 'place') continue;
        for (const target of range(skill.params.numbers))
          push({ item, task: 'build', target, a: null, b: null });
      }
    } else if (skill.generator === 'addsub.2d') {
      for (const item of pool) for (const source of addSub2dExamples(skill, item)) push(source);
    }
  }
  return sources.filter((source) => {
    const result =
      source.task === 'build'
        ? (source.target ?? 0)
        : source.task === 'add'
          ? (source.a ?? 0) + (source.b ?? 0)
          : (source.a ?? 0) - (source.b ?? 0);
    return result >= 0 && result <= 100;
  });
}

/**
 * What a Sharing Feast can share: division facts of the pool (no leftovers), and dividends drawn
 * within the parameters of the round's remainder and 2-digit division skills.
 */
function feasts(pool: readonly string[], skills: readonly DeepReadonly<Skill>[]): Feast[] {
  const available = new Set(pool);
  const sources: Feast[] = [];
  for (const item of pool) {
    const parsed = parseItemId(item);
    if (parsed?.kind === 'div' && parsed.divisor >= 2 && parsed.quotient >= 1) {
      sources.push({ item, deals: [{ total: parsed.dividend, baskets: parsed.divisor }] });
    }
  }
  for (const skill of skills) {
    if (skill.generator === 'div.remainder') {
      const { divisors, quotients, dividendMax, remainder } = skill.params;
      for (const baskets of divisors) {
        const item = bucketId('rem', `d${baskets}`);
        if (!available.has(item)) continue;
        const deals = range(quotients).flatMap((q) =>
          range([0, baskets - 1])
            .filter((r) => fits(remainder, r > 0) && q * baskets + r >= 1)
            .filter((r) => q * baskets + r <= dividendMax)
            .map((r) => ({ total: q * baskets + r, baskets })),
        );
        if (deals.length > 0) sources.push({ item, deals });
      }
    } else if (skill.generator === 'div.2d1d') {
      const { divisors, quotients, dividendMax, regroup, remainder } = skill.params;
      for (const regroups of [false, true]) {
        const item = bucketId('div2d1d', regroups ? 'regroup' : 'noregroup');
        if (!available.has(item) || !fits(regroup, regroups)) continue;
        const deals = divisors.flatMap((baskets) =>
          range(quotients).flatMap((q) =>
            range([0, baskets - 1]).flatMap((r) => {
              const total = q * baskets + r;
              const tens = (total - (total % 10)) / 10;
              const ok =
                total >= 10 &&
                total <= dividendMax &&
                fits(remainder, r > 0) &&
                (tens % baskets !== 0) === regroups;
              return ok ? [{ total, baskets }] : [];
            }),
          ),
        );
        if (deals.length > 0) sources.push({ item, deals });
      }
    }
  }
  return sources;
}

type OrderSkill = Extract<DeepReadonly<Skill>, { generator: 'order.ops' }>;

/** Order-of-operations skills of the round with an order item in the pool. */
function golemSkills(
  pool: readonly string[],
  skills: readonly DeepReadonly<Skill>[],
): OrderSkill[] {
  return skills.filter(
    (skill): skill is OrderSkill =>
      skill.generator === 'order.ops' && orderItems(pool, skill).length > 0,
  );
}

/** The pool's order items an order skill can produce (its `brackets` requirement). */
function orderItems(pool: readonly string[], skill: OrderSkill): string[] {
  return pool.filter((item) =>
    item === 'order:brackets'
      ? skill.params.brackets !== 'forbidden'
      : item === 'order:no-brackets' && skill.params.brackets !== 'required',
  );
}

/** Whether the round's items and skills can make a board of this activity. */
export function canMakeBoard(
  activity: MinigameActivityKind,
  pool: readonly string[],
  skills: readonly DeepReadonly<Skill>[],
  options: Options = {},
): boolean {
  switch (activity) {
    case 'memory-match':
      return matchable(pool, skills, options['match']) >= 2;
    case 'number-trail':
      return trailCandidates(skills, options).length > 0;
    case 'egg-grid':
      return eggProducts(pool).length > 0;
    case 'fact-family':
      return families(pool).length + additiveFamilies(pool).length > 0;
    case 'sharing-feast':
      return feasts(pool, skills).length > 0;
    case 'golem-orders':
      return golemSkills(pool, skills).length > 0;
    case 'ten-frame':
      return tenFrameSources(pool, skills, options).length > 0;
    case 'bundle-sticks':
      return bundleSources(pool, skills, options).length > 0;
  }
}

/** Prefer the focus egg's entries, never the previous board's, else anything. */
function prefer<T extends { item: string }>(
  entries: readonly T[],
  request: BoardRequest,
  same: (entry: T) => boolean,
): T[] {
  const fresh = entries.filter((entry) => !same(entry));
  const from = fresh.length > 0 ? fresh : [...entries];
  const focused =
    request.focus === null ? [] : from.filter((entry) => request.focus!.includes(entry.item));
  return focused.length > 0 ? focused : from;
}

function eggGridConfig(request: BoardRequest): EggGridConfig {
  const previous = (request.previous?.config as { product?: number } | undefined)?.product;
  const choices = prefer(eggProducts(request.pool), request, (e) => e.product === previous);
  const products = [...new Set(choices.map((choice) => choice.product))];
  const split = request.options['split'];
  // Easy to hard: board k of n takes the k-th band of the round's products (smallest first),
  // or the preferred products closest to that band.
  const all = [...new Set(eggProducts(request.pool).map((e) => e.product))].sort((a, b) => a - b);
  const range = band(all, request.board, request.boards);
  const [low, high] = [range[0]!, range[range.length - 1]!];
  const distance = (p: number) => (p < low ? low - p : p > high ? p - high : 0);
  const nearest = Math.min(...products.map(distance));
  const product = request.random.pick(
    products.filter((p) => distance(p) === nearest).sort((a, b) => a - b),
  );
  // Find every rectangle: the factor pairs and both orders of each (at most four up to 10 × 10).
  return {
    product,
    maxSide: 10,
    split: (typeof split === 'string' ? split : 'none') as EggGridSplit,
    find: rectangles(product, 10).length,
  };
}

function factFamilyConfig(request: BoardRequest): FactFamilyConfig {
  const previous = request.previous?.config as
    { a?: number; b?: number; operation?: string } | undefined;
  const additive = additiveFamilies(request.pool);
  if (families(request.pool).length === 0 && additive.length > 0) {
    const sameAdd = (e: { a: number; b: number }) =>
      previous?.operation === 'add' &&
      ((e.a === previous.a && e.b === previous.b) || (e.a === previous.b && e.b === previous.a));
    const family = request.random.pick(prefer(additive, request, sameAdd));
    return { a: family.a, b: family.b, product: family.a + family.b, operation: 'add' };
  }
  const same = (e: { a: number; b: number }) =>
    previous !== undefined &&
    previous.operation !== 'add' &&
    ((e.a === previous.a && e.b === previous.b) || (e.a === previous.b && e.b === previous.a));
  const family = request.random.pick(prefer(families(request.pool), request, same));
  return { a: family.a, b: family.b, product: family.a * family.b };
}

interface MemoryPair {
  /** The pair ID: an item ID (`mul:7x8`), `fam:<mul item>` for a × ↔ ÷ family, `terms:<term>`,
   * or `<bucket item>/<n>` when one bucket gives several pairs. */
  pair: string;
  faces: [string, string];
  /** What makes two pairs look alike on one board (each must differ). */
  value: string;
}

/** Fact ↔ value pairs: a fact and its product or quotient, or a remainder sum and its answer. */
function valuePairs(request: BoardRequest): MemoryPair[] {
  const pairs: MemoryPair[] = [];
  for (const item of request.pool) {
    const fact = factValue(item);
    if (fact !== null) {
      pairs.push({ pair: item, faces: [fact.face, `num:${fact.value}`], value: `${fact.value}` });
    }
  }
  for (const source of feasts(request.pool, request.skills)) {
    if (!source.item.startsWith('rem:')) continue;
    source.deals.forEach((deal, n) => {
      const left = deal.total % deal.baskets;
      const each = (deal.total - left) / deal.baskets;
      pairs.push({
        pair: `${source.item}/${n}`,
        faces: [`expr:div:${deal.total}:${deal.baskets}`, `rem:${each}:${left}`],
        value: `${each}r${left}`,
      });
    });
  }
  return pairs;
}

/** × ↔ ÷ pairs of one family: `6 · 7 = 42` and `42 : 7 = 6`. */
function familyPairs(request: BoardRequest): MemoryPair[] {
  return request.pool.flatMap((item) => {
    const parsed = parseItemId(item);
    if (parsed?.kind === 'mul' && parsed.a >= 1 && parsed.b >= 1) {
      const { a, b, product } = parsed;
      return [
        {
          pair: `fam:${item}`,
          faces: [
            `example:mul:${a}:${b}:${product}:-:none`,
            `example:div:${product}:${b}:${a}:-:none`,
          ],
          value: `${product}`,
        } satisfies MemoryPair,
      ];
    }
    if (parsed?.kind === 'add') {
      return [
        {
          pair: `fam:${item}`,
          faces: [`expr:add:${parsed.a}:${parsed.b}`, `expr:sub:${parsed.sum}:${parsed.a}`],
          value: `${parsed.sum}`,
        } satisfies MemoryPair,
      ];
    }
    if (parsed?.kind === 'sub') {
      return [
        {
          pair: `fam:${item}`,
          faces: [
            `expr:add:${parsed.difference}:${parsed.subtrahend}`,
            `expr:sub:${parsed.minuend}:${parsed.subtrahend}`,
          ],
          value: `${parsed.minuend}`,
        } satisfies MemoryPair,
      ];
    }
    return [];
  });
}

const TERM_HIGHLIGHT: Record<Term, { op: 'mul' | 'div'; highlight: string }> = {
  factor: { op: 'mul', highlight: 'left' },
  product: { op: 'mul', highlight: 'result' },
  dividend: { op: 'div', highlight: 'left' },
  divisor: { op: 'div', highlight: 'right' },
  quotient: { op: 'div', highlight: 'result' },
  remainder: { op: 'div', highlight: 'remainder' },
};

/** Term ↔ example pairs: `product` and `6 · 7 = 42` with 42 highlighted. */
function termPairs(request: BoardRequest): MemoryPair[] {
  const pairs: MemoryPair[] = [];
  for (const skill of request.skills) {
    if (skill.generator !== 'terms') continue;
    const tables = skill.params.tables.filter((t) => t >= 2);
    for (const term of skill.params.terms) {
      if (!request.pool.includes(bucketId('terms', term)) || tables.length === 0) continue;
      const a = request.random.pick(tables);
      const b = request.random.int(2, 10);
      const { op, highlight } = TERM_HIGHLIGHT[term];
      const example =
        op === 'mul'
          ? `example:mul:${a}:${b}:${a * b}:-:${highlight}`
          : term === 'remainder'
            ? `example:div:${a * b + 1}:${a}:${b}:1:${highlight}`
            : `example:div:${a * b}:${a}:${b}:-:${highlight}`;
      pairs.push({ pair: bucketId('terms', term), faces: [`term:${term}`, example], value: term });
    }
  }
  return pairs;
}

/**
 * A pair ID as a narrative stable ID: `+` (in `add:3+5`) is not allowed there, and no item ID
 * uses `_`, so `+` is stored as `_` (`add:3_5`, `fam:add:3_5`) and restored by `pairItems`.
 */
export function pairStableId(pair: string): string {
  return pair.replaceAll('+', '_');
}

/** Items a matched pair practised. */
function pairItems(stored: string): string[] {
  const pair = stored.replaceAll('_', '+');
  if (pair.startsWith('fam:')) {
    const parsed = parseItemId(pair.slice(4));
    if (parsed?.kind === 'mul') return [pair.slice(4), divFactId(parsed.product, parsed.b)];
    if (parsed?.kind === 'add') return [pair.slice(4), subFactId(parsed.sum, parsed.a)];
    if (parsed?.kind === 'sub')
      return [pair.slice(4), addFactId(parsed.difference, parsed.subtrahend)];
    return [];
  }
  const slash = pair.indexOf('/');
  return [slash === -1 ? pair : pair.slice(0, slash)];
}

function memoryPairs(request: BoardRequest): MemoryPair[] {
  const mode = request.options['match'];
  return mode === 'family'
    ? familyPairs(request)
    : mode === 'term'
      ? termPairs(request)
      : valuePairs(request);
}

function memoryConfig(request: BoardRequest): MatchingConfig {
  const wanted = Number(request.options['pairs'] ?? 6);
  const used = new Set<string>();
  const picks: MemoryPair[] = [];
  for (const pair of shuffled(memoryPairs(request), request.random)) {
    if (used.has(pair.value)) continue;
    used.add(pair.value);
    picks.push(pair);
    if (picks.length === wanted) break;
  }
  const cards = shuffled(
    picks.flatMap((pick) => [
      { pair: pick.pair, labelKey: pick.faces[0] },
      { pair: pick.pair, labelKey: pick.faces[1] },
    ]),
    request.random,
  );
  return {
    cards: cards.map((card, index) => ({
      id: `c${index + 1}`,
      pair: pairStableId(card.pair),
      labelKey: card.labelKey,
      backLabelKey: CARD_BACK_LABEL,
    })),
  };
}

function trailConfig(request: BoardRequest): { config: OrderingConfig; id: string } {
  const trails = trailCandidates(request.skills, request.options);
  const previous = request.previous === null ? null : trailShape(request.previous.id);
  const same = (trail: TrailCandidate) =>
    previous !== null &&
    trail.step === previous.step &&
    trail.direction === previous.direction &&
    trail.start === previous.start;
  const fresh = trails.filter((trail) => !same(trail));
  const trail = request.random.pick(fresh.length > 0 ? fresh : trails);
  const { step, length, start } = trail;
  const direction = trail.direction ?? 'up';
  const gaps = Math.min(Number(request.options['gaps'] ?? 3), length - 1);
  const positions = shuffled(
    Array.from({ length: length - 1 }, (_, i) => i + 1),
    request.random,
  )
    .slice(0, gaps)
    .sort((a, b) => a - b);
  const stones = positions.map((position) => ({
    id: `g${position}`,
    labelKey: `num:${direction === 'down' ? start - step * position : start + step * position}`,
  }));
  const solution = stones.map((stone) => stone.id);
  let items = shuffled(stones, request.random);
  if (items.length > 1 && items.every((stone, i) => stone.id === solution[i])) {
    items = [...items.slice(1), items[0]!];
  }
  const id =
    direction === 'up' && start === step
      ? `${request.id}.trail.${step}.${length}`
      : `${request.id}.trail.${step}.${length}.${start}.${direction}`;
  return { config: { items, solution }, id };
}

/** Step and length of a number trail, from its definition ID (`….trail.<step>.<length>`). */
export function trailShape(
  definitionId: string,
): { step: number; length: number; start: number; direction?: 'up' | 'down' } | null {
  const match = /\.trail\.([1-9][0-9]*)\.([1-9][0-9]*)(?:\.([0-9]+)\.(up|down))?$/.exec(
    definitionId,
  );
  if (!match) return null;
  const step = Number(match[1]);
  return {
    step,
    length: Number(match[2]),
    start: match[3] === undefined ? step : Number(match[3]),
    direction: match[4] === 'down' ? 'down' : undefined,
  };
}

function feastConfig(request: BoardRequest): SharingFeastConfig {
  const previous = request.previous?.config as { total?: number; baskets?: number } | undefined;
  const all = feasts(request.pool, request.skills);
  const source = request.random.pick(all);
  const fresh = source.deals.filter(
    (deal) => deal.total !== previous?.total || deal.baskets !== previous?.baskets,
  );
  const deal = request.random.pick(fresh.length > 0 ? fresh : source.deals);
  const leftovers = deal.total % deal.baskets !== 0 || source.item.startsWith('rem:');
  return { total: deal.total, baskets: deal.baskets, remainder: leftovers };
}

/** Draws for an expression that reads the way the Golem works it out, before brackets are
 * written in instead (85-93 % of the order generator's draws for the v1 skills read that way, so
 * sixteen draws practically never all fail). */
const GOLEM_DRAWS = 16;

function orderExpr(skill: OrderSkill, item: string, random: RandomStream): Expr {
  const problem = orderProblem(skill.params, item, random);
  if (problem.kind !== 'equation') throw new Error('An order skill gives an equation.');
  return problem.left.kind === 'blank' ? problem.right : problem.left;
}

/**
 * The Golem checks each step against the expression's tree, so the tree must be the expression
 * as a child reads it (`60 + 6 + 45 : 5` worked out as `(60 + 6) + 45 : 5`). The order generator
 * may build a tree with the same value that reads differently (`60 + (6 + 45 : 5)`): such draws
 * are drawn again, and if none of `GOLEM_DRAWS` reads right, the last one is written with the
 * brackets its tree needs.
 */
function golemConfig(request: BoardRequest): GolemOrdersConfig {
  const skill = request.random.pick(golemSkills(request.pool, request.skills));
  const item = request.random.pick(orderItems(request.pool, skill));
  let expr = orderExpr(skill, item, request.random);
  for (let draw = 1; draw < GOLEM_DRAWS && !readsAsComputed(expr); draw++) {
    expr = orderExpr(skill, item, request.random);
  }
  return { expr: readsAsComputed(expr) ? expr : bracketed(expr) };
}

function tenFrameConfig(request: BoardRequest): TenFrameConfig {
  const previous = request.previous?.config as
    { task?: string; a?: number; b?: number | null; target?: number } | undefined;
  const same = (source: TenFrameSource) =>
    source.task === previous?.task &&
    source.a === previous.a &&
    source.b === previous.b &&
    source.target === previous.target;
  const source = request.random.pick(
    prefer(tenFrameSources(request.pool, request.skills, request.options), request, same),
  );
  return { task: source.task, a: source.a, b: source.b, target: source.target, item: source.item };
}

function bundleConfig(request: BoardRequest): BundleSticksConfig {
  const previous = request.previous?.config as
    { task?: string; target?: number | null; a?: number | null; b?: number | null } | undefined;
  const same = (source: BundleSource) =>
    source.task === previous?.task &&
    source.target === previous.target &&
    source.a === previous.a &&
    source.b === previous.b;
  const source = request.random.pick(
    prefer(bundleSources(request.pool, request.skills, request.options), request, same),
  );
  return { task: source.task, target: source.target, a: source.a, b: source.b, item: source.item };
}

/** Generate the next board of a round as a narrative minigame definition. */
export function makeBoard(request: BoardRequest): MinigameDefinition {
  const definition = (kind: string, config: unknown, id = request.id): MinigameDefinition => ({
    schema: 1,
    id,
    revision: '1',
    kind,
    adapterSchema: 1,
    config: config as Json,
    outputs: [],
  });
  switch (request.activity) {
    case 'memory-match':
      return definition('matching', memoryConfig(request));
    case 'number-trail': {
      const { config, id } = trailConfig(request);
      return definition('ordering', config, id);
    }
    case 'egg-grid':
      return definition(EGG_GRID_KIND, eggGridConfig(request));
    case 'fact-family':
      return definition(FACT_FAMILY_KIND, factFamilyConfig(request));
    case 'sharing-feast':
      return definition(SHARING_FEAST_KIND, feastConfig(request));
    case 'golem-orders':
      return definition(GOLEM_ORDERS_KIND, golemConfig(request));
    case 'ten-frame':
      return definition(TEN_FRAME_KIND, tenFrameConfig(request));
    case 'bundle-sticks':
      return definition(BUNDLE_STICKS_KIND, bundleConfig(request));
  }
}

/** The typed board of a (validated) definition and state; `projected` is the adapter view. */
export function boardView(
  definition: DeepReadonly<MinigameDefinition>,
  state: DeepReadonly<MinigameState>,
  projected: Json,
): BoardView {
  if (definition.kind === 'matching') {
    const config = definition.config as unknown as MatchingConfig;
    const progress = state.progress as unknown as MatchingState;
    return {
      kind: 'memory-match',
      cards: config.cards.map((card) => {
        const faceUp = progress.open.includes(card.id) || progress.matched.includes(card.id);
        return {
          id: card.id,
          face: faceUp ? parseCardLabel(card.labelKey) : null,
          faceUp,
          matched: progress.matched.includes(card.id),
        };
      }),
      clearAvailable: progress.open.length === 2,
      pairs: config.cards.length / 2,
      matched: progress.matched.length / 2,
      attempts: progress.attempts,
    };
  }
  if (definition.kind === 'ordering') {
    const config = definition.config as unknown as OrderingConfig;
    const progress = state.progress as unknown as OrderingState;
    const shape = trailShape(definition.id) ?? { step: 1, length: config.items.length, start: 1 };
    const direction = shape.direction ?? 'up';
    const valueAt = (position: number) =>
      direction === 'down'
        ? shape.start - shape.step * position
        : shape.start + shape.step * position;
    const value = (id: string) => valueAt(Number(id.slice(1)));
    const board: NumberTrailBoard = {
      kind: 'number-trail',
      step: shape.step,
      path: Array.from({ length: shape.length }, (_, position) => {
        const gap = config.solution.indexOf(`g${position}`);
        return gap === -1 ? { value: valueAt(position), gap: null } : { value: null, gap };
      }),
      stones: progress.order.map((id) => ({ id, value: value(id) })),
      submitted: progress.submitted,
      attempts: progress.attempts,
    };
    if (shape.direction !== undefined) board.direction = shape.direction;
    return board;
  }
  if (definition.kind === EGG_GRID_KIND) {
    return { kind: 'egg-grid', ...(projected as unknown as Omit<EggGridBoard, 'kind'>) };
  }
  if (definition.kind === SHARING_FEAST_KIND) {
    return { kind: 'sharing-feast', ...(projected as unknown as Omit<SharingFeastBoard, 'kind'>) };
  }
  if (definition.kind === GOLEM_ORDERS_KIND) {
    return { kind: 'golem-orders', ...(projected as unknown as Omit<GolemOrdersBoard, 'kind'>) };
  }
  if (definition.kind === TEN_FRAME_KIND) {
    return { kind: 'ten-frame', ...(projected as unknown as Omit<TenFrameBoard, 'kind'>) };
  }
  if (definition.kind === BUNDLE_STICKS_KIND) {
    return {
      kind: 'bundle-sticks',
      ...(projected as unknown as Omit<BundleSticksBoard, 'kind'>),
    };
  }
  return { kind: 'fact-family', ...(projected as unknown as Omit<FactFamilyBoard, 'kind'>) };
}

/** The item a finished feast practised: a division fact, a remainder or a 2-digit division. */
function feastItems(config: SharingFeastConfig): string[] {
  const { total, baskets } = config;
  const left = total % baskets;
  const each = (total - left) / baskets;
  const items: string[] = [];
  if (left === 0 && each <= 10) items.push(divFactId(total, baskets));
  if (config.remainder) items.push(bucketId('rem', `d${baskets}`));
  if (total >= 10 && total <= 99 && each >= 10) {
    const tens = (total - (total % 10)) / 10;
    items.push(bucketId('div2d1d', tens % baskets !== 0 ? 'regroup' : 'noregroup'));
  }
  return items;
}

/** Whether an expression has brackets anywhere. */
function hasGroup(expr: DeepReadonly<GolemOrdersConfig['expr']>): boolean {
  if (expr.kind === 'group') return true;
  return expr.kind === 'op' && (hasGroup(expr.left) || hasGroup(expr.right));
}

export interface BoardCredit {
  items: { item: string; bucket: ResponseBucket }[];
  coins: number;
}

/**
 * What a move earned: facts to credit and coin steps. `pool` limits credits to the round's
 * items (a rectangle outside the round's tables earns coins but credits no fact).
 */
export function boardCredits(
  definition: DeepReadonly<MinigameDefinition>,
  before: DeepReadonly<MinigameState>,
  after: DeepReadonly<MinigameState>,
  pool: ReadonlySet<string>,
): BoardCredit {
  const credit: BoardCredit = { items: [], coins: 0 };
  const add = (item: string | null, bucket: ResponseBucket) => {
    if (item !== null && pool.has(item)) credit.items.push({ item, bucket });
  };
  const completed = after.status === 'completed' && before.status !== 'completed';
  if (definition.kind === 'matching') {
    const config = definition.config as unknown as MatchingConfig;
    const was = (before.progress as unknown as MatchingState).matched;
    const now = after.progress as unknown as MatchingState;
    const fresh = now.matched.filter((card) => !was.includes(card));
    const pairs = [...new Set(fresh.map((card) => config.cards.find((c) => c.id === card)!.pair))];
    const clean = now.attempts * 2 === now.matched.length;
    for (const pair of pairs) {
      for (const item of pairItems(pair)) add(item, clean ? 'fast' : 'ok');
    }
    credit.coins += pairs.length;
  } else if (definition.kind === 'ordering' && completed) {
    const config = definition.config as unknown as OrderingConfig;
    const shape = trailShape(definition.id);
    const attempts = (after.progress as unknown as OrderingState).attempts;
    const bucket: ResponseBucket = attempts === 1 ? 'ok' : 'slow';
    for (const id of config.solution) {
      const groups = Number(id.slice(1)) + 1;
      if (shape === null) continue;
      if (shape.start !== shape.step || shape.direction !== undefined) continue;
      if (shape.step <= 10 && groups <= 10) add(mulFactId(groups, shape.step), bucket);
      else if (shape.step % 10 === 0 && groups >= 2 && groups <= 9) {
        add(bucketId('tens', `d${groups}`), bucket);
      }
    }
    credit.coins += config.solution.length;
  } else if (definition.kind === EGG_GRID_KIND) {
    const was = (before.progress as unknown as EggGridState).found;
    for (const found of (after.progress as unknown as EggGridState).found) {
      if (was.includes(found)) continue;
      const [rows, columns] = found.split('x').map(Number) as [number, number];
      add(rows <= 10 && columns <= 10 ? mulFactId(rows, columns) : null, 'ok');
      credit.coins += 1;
    }
  } else if (definition.kind === FACT_FAMILY_KIND && completed) {
    const { a, b, product, operation } = definition.config as unknown as FactFamilyConfig;
    const attempts = (after.progress as unknown as FactFamilyState).attempts;
    const bucket: ResponseBucket = attempts === 1 ? 'ok' : 'slow';
    if (operation === 'add') {
      const small = a <= 10 && b <= 10 && product <= 20;
      add(small ? addFactId(a, b) : null, bucket);
      add(small ? addFactId(b, a) : null, bucket);
      add(small ? subFactId(product, a) : null, bucket);
      add(small ? subFactId(product, b) : null, bucket);
    } else {
      const small = a <= 10 && b <= 10;
      add(small ? mulFactId(a, b) : null, bucket);
      add(small ? mulFactId(b, a) : null, bucket);
      add(small ? divFactId(product, a) : null, bucket);
      add(small ? divFactId(product, b) : null, bucket);
    }
    credit.coins += 4;
  } else if (definition.kind === SHARING_FEAST_KIND && completed) {
    const config = definition.config as unknown as SharingFeastConfig;
    const attempts = (after.progress as unknown as SharingFeastState).attempts;
    const item = feastItems(config).find((candidate) => pool.has(candidate)) ?? null;
    add(item, attempts === 1 ? 'ok' : 'slow');
    credit.coins += config.baskets;
  } else if (definition.kind === GOLEM_ORDERS_KIND && completed) {
    const config = definition.config as unknown as GolemOrdersConfig;
    const progress = after.progress as unknown as GolemOrdersState;
    const item = bucketId('order', hasGroup(config.expr) ? 'brackets' : 'no-brackets');
    add(item, progress.mistakes === 0 ? 'ok' : 'slow');
    credit.coins += progress.steps;
  } else if (definition.kind === TEN_FRAME_KIND && completed) {
    const config = definition.config as unknown as TenFrameConfig;
    const attempts = (after.progress as unknown as TenFrameState).attempts;
    add(config.item, attempts === 1 ? 'ok' : 'slow');
    credit.coins += config.task === 'cross' ? 2 : 1;
  } else if (definition.kind === BUNDLE_STICKS_KIND && completed) {
    const config = definition.config as unknown as BundleSticksConfig;
    const attempts = (after.progress as unknown as BundleSticksState).attempts;
    add(config.item, attempts === 1 ? 'ok' : 'slow');
    credit.coins += config.task === 'build' ? 1 : 2;
  }
  return credit;
}
