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
  bucketId,
  divFactId,
  mulFactId,
  parseCardLabel,
  parseItemId,
} from '../contract';
import type {
  BoardView,
  EggGridBoard,
  EggGridSplit,
  Expr,
  FactFamilyBoard,
  GolemOrdersBoard,
  MinigameActivityKind,
  ResponseBucket,
  SharingFeastBoard,
  Skill,
  Term,
} from '../contract';
import { orderProblem } from '../learning/generators/order';
import { shuffled } from '../learning/selection';
import { EGG_GRID_KIND, eggGridAdapter, rectangles } from './egg-grid';
import type { EggGridConfig, EggGridState } from './egg-grid';
import { FACT_FAMILY_KIND, factFamilyAdapter } from './fact-family';
import type { FactFamilyConfig, FactFamilyState } from './fact-family';
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
  .register(golemOrdersAdapter);

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

/** Steps a number trail can count in: the tables of the round's skills, from 2 up. */
function trailSteps(skills: readonly DeepReadonly<Skill>[]): number[] {
  const steps = new Set<number>();
  for (const skill of skills) {
    if (skill.generator === 'mul.fact' || skill.generator === 'mul.missing') {
      skill.params.tables.forEach((table) => steps.add(table));
    } else if (skill.generator === 'div.fact') {
      skill.params.divisors.forEach((divisor) => steps.add(divisor));
    } else if (skill.generator === 'mul.tens') {
      // Count in whole tens: 30, 60, 90, … (tens times one digit).
      range(skill.params.tens).forEach((tens) => steps.add(tens * 10));
    }
  }
  return [...steps].filter((step) => step >= 2).sort((a, b) => a - b);
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
      pool.map((item) => parseItemId(item)).flatMap((p) => (p?.kind === 'mul' ? [p.product] : [])),
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
      return trailSteps(skills).length > 0;
    case 'egg-grid':
      return eggProducts(pool).length > 0;
    case 'fact-family':
      return families(pool).length > 0;
    case 'sharing-feast':
      return feasts(pool, skills).length > 0;
    case 'golem-orders':
      return golemSkills(pool, skills).length > 0;
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
  const previous = request.previous?.config as { a?: number; b?: number } | undefined;
  const same = (e: { a: number; b: number }) =>
    previous !== undefined &&
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
    if (parsed?.kind !== 'mul' || parsed.a < 1 || parsed.b < 1) return [];
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

/** Items a matched pair practised. */
function pairItems(pair: string): string[] {
  if (pair.startsWith('fam:')) {
    const parsed = parseItemId(pair.slice(4));
    return parsed?.kind === 'mul' ? [pair.slice(4), divFactId(parsed.product, parsed.b)] : [];
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
      pair: card.pair,
      labelKey: card.labelKey,
      backLabelKey: CARD_BACK_LABEL,
    })),
  };
}

function trailConfig(request: BoardRequest): { config: OrderingConfig; id: string } {
  const steps = trailSteps(request.skills);
  const previous = request.previous === null ? null : trailShape(request.previous.id)?.step;
  const fresh = steps.filter((step) => step !== previous);
  const step = request.random.pick(fresh.length > 0 ? fresh : steps);
  const length = Number(request.options['length'] ?? 10);
  const gaps = Math.min(Number(request.options['gaps'] ?? 3), length - 1);
  const positions = shuffled(
    Array.from({ length: length - 1 }, (_, i) => i + 1),
    request.random,
  )
    .slice(0, gaps)
    .sort((a, b) => a - b);
  const stones = positions.map((position) => ({
    id: `g${position}`,
    labelKey: `num:${step * (position + 1)}`,
  }));
  const solution = stones.map((stone) => stone.id);
  let items = shuffled(stones, request.random);
  if (items.length > 1 && items.every((stone, i) => stone.id === solution[i])) {
    items = [...items.slice(1), items[0]!];
  }
  return { config: { items, solution }, id: `${request.id}.trail.${step}.${length}` };
}

/** Step and length of a number trail, from its definition ID (`….trail.<step>.<length>`). */
export function trailShape(definitionId: string): { step: number; length: number } | null {
  const match = /\.trail\.([1-9][0-9]*)\.([1-9][0-9]*)$/.exec(definitionId);
  return match ? { step: Number(match[1]), length: Number(match[2]) } : null;
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
    const shape = trailShape(definition.id) ?? { step: 1, length: config.items.length };
    const value = (id: string) => shape.step * (Number(id.slice(1)) + 1);
    return {
      kind: 'number-trail',
      step: shape.step,
      path: Array.from({ length: shape.length }, (_, position) => {
        const gap = config.solution.indexOf(`g${position}`);
        return gap === -1
          ? { value: shape.step * (position + 1), gap: null }
          : { value: null, gap };
      }),
      stones: progress.order.map((id) => ({ id, value: value(id) })),
      submitted: progress.submitted,
      attempts: progress.attempts,
    };
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
    const { a, b, product } = definition.config as unknown as FactFamilyConfig;
    const attempts = (after.progress as unknown as FactFamilyState).attempts;
    const bucket: ResponseBucket = attempts === 1 ? 'ok' : 'slow';
    const small = a <= 10 && b <= 10;
    add(small ? mulFactId(a, b) : null, bucket);
    add(small ? mulFactId(b, a) : null, bucket);
    add(small ? divFactId(product, a) : null, bucket);
    add(small ? divFactId(product, b) : null, bucket);
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
  }
  return credit;
}
