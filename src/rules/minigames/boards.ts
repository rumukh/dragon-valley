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
import { CARD_BACK_LABEL, divFactId, mulFactId, parseCardLabel, parseItemId } from '../contract';
import type {
  BoardView,
  EggGridBoard,
  EggGridSplit,
  FactFamilyBoard,
  MinigameActivityKind,
  ResponseBucket,
  Skill,
} from '../contract';
import { shuffled } from '../learning/selection';
import { EGG_GRID_KIND, eggGridAdapter, rectangles } from './egg-grid';
import type { EggGridConfig, EggGridState } from './egg-grid';
import { FACT_FAMILY_KIND, factFamilyAdapter } from './fact-family';
import type { FactFamilyConfig, FactFamilyState } from './fact-family';
import type { ReadState } from '../types';

/** The minigame registry of the rules: the narrative built-ins plus Dragon Valley's adapters. */
export const MINIGAMES = createMinigameRegistry()
  .register(eggGridAdapter)
  .register(factFamilyAdapter);

export type Options = Readonly<Record<string, number | boolean | string>>;

export interface BoardRequest {
  activity: MinigameActivityKind;
  /** The definition ID (`<round>.b<board>`), also the base of the instance ID. */
  id: string;
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
function eggProducts(pool: readonly string[]): { item: string; product: number }[] {
  return pool.flatMap((item) => {
    const parsed = parseItemId(item);
    if (parsed?.kind === 'mul' && parsed.a >= 1 && parsed.b >= 1 && parsed.product >= 2) {
      return [{ item, product: parsed.product }];
    }
    if (parsed?.kind === 'div' && parsed.quotient >= 1 && parsed.dividend >= 2) {
      return [{ item, product: parsed.dividend }];
    }
    return [];
  });
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
    }
  }
  return [...steps].filter((step) => step >= 2).sort((a, b) => a - b);
}

/** Distinct-value fact pairs for Memory Match. */
function matchable(pool: readonly string[]): number {
  return new Set(pool.map((item) => factValue(item)?.value).filter((v) => v !== undefined)).size;
}

/** Whether the round's items and skills can make a board of this activity. */
export function canMakeBoard(
  activity: MinigameActivityKind,
  pool: readonly string[],
  skills: readonly DeepReadonly<Skill>[],
): boolean {
  switch (activity) {
    case 'memory-match':
      return matchable(pool) >= 2;
    case 'number-trail':
      return trailSteps(skills).length > 0;
    case 'egg-grid':
      return eggProducts(pool).length > 0;
    case 'fact-family':
      return families(pool).length > 0;
    default:
      return false;
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
  const split = request.options['split'];
  const product = request.random.pick(choices).product;
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

function memoryConfig(request: BoardRequest): MatchingConfig {
  const wanted = Number(request.options['pairs'] ?? 6);
  const used = new Set<number>();
  const picks: { item: string; face: string; value: number }[] = [];
  for (const item of shuffled(request.pool, request.random)) {
    const fact = factValue(item);
    if (fact === null || used.has(fact.value)) continue;
    used.add(fact.value);
    picks.push({ item, ...fact });
    if (picks.length === wanted) break;
  }
  const cards = shuffled(
    picks.flatMap((pick) => [
      { pair: pick.item, labelKey: pick.face },
      { pair: pick.item, labelKey: `num:${pick.value}` },
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
    default:
      throw new Error(`No board for ${request.activity}.`);
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
  return { kind: 'fact-family', ...(projected as unknown as Omit<FactFamilyBoard, 'kind'>) };
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
    for (const pair of pairs) add(pair, clean ? 'fast' : 'ok');
    credit.coins += pairs.length;
  } else if (definition.kind === 'ordering' && completed) {
    const config = definition.config as unknown as OrderingConfig;
    const shape = trailShape(definition.id);
    const attempts = (after.progress as unknown as OrderingState).attempts;
    for (const id of config.solution) {
      const groups = Number(id.slice(1)) + 1;
      const fact = shape !== null && groups <= 10 && shape.step <= 10;
      add(fact ? mulFactId(groups, shape!.step) : null, attempts === 1 ? 'ok' : 'slow');
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
  }
  return credit;
}
