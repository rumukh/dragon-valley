/**
 * Item selection: which item a problem round serves next (the mix, docs/design.md §6.3).
 *
 * Items are sorted into three tiers on the child's current day:
 * - **due**: items answered right before whose review day has come (spaced review, most overdue
 *   first);
 * - **known**: items at bronze or better (box 2+) that are not due;
 * - **learning**: new items and items in box 0-1.
 *
 * Each draw first decides, from the `problems` stream, whether to serve a learning item. The
 * learning share starts at `100 - mix.knownShare` and follows recent success (`recentSuccess`:
 * the last `mix.window` answers, across days): above `mix.successTarget` it grows, below it
 * shrinks, within `mix.minLearningShare` … `mix.maxLearningShare`; a new child's first answers
 * move it less. Otherwise a due review is served, else a known item, else a learning item. Items
 * served in the last `mix.noRepeatWithin` problems are skipped while anything else is available,
 * and inside a tier items not served in this round yet come first (known items: also not
 * practised today), so a small tier never makes a round repeat itself.
 *
 * Below the success band (recent success under `LOW_SUCCESS`) the mix protects the child's
 * success: a due item missed last time counts as a learning item (`mixTier`), and due reviews,
 * learning draws and snacks serve the likeliest successes first (`likely`: answered right last
 * time, the most recently practised first; then new items; then items missed last time).
 *
 * The review guarantee comes before both orders: a known fact (box 2+) that has waited
 * `STARVING_DAYS` past its review day is `starving` and is the next review wherever reviews are
 * served (`pickReview`), so no known fact waits more than about a week.
 *
 * Learning draws prefer the **focus egg**: the chosen first egg while it is an egg, else the
 * oldest owned egg, whose facts the round can serve and that were never answered right. Practice
 * warms the egg, so the first Feeding Time hatches the first egg whichever table it is
 * (docs/design.md §4.1). Then new items and weak items share the draws.
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { parseItemId } from '../contract';
import type { Dragon, ItemState, Skill } from '../contract';
import { isDue } from './items';
import type { Data, ReadState } from '../types';

export type ItemTier = 'due' | 'known' | 'learning';

/** Answers before success starts to guide the mix. */
const MIN_SAMPLE = 5;

/** Known facts are at bronze or better: Leitner box 2 and up. */
export const KNOWN_BOX = 2;

/**
 * Days past its review day after which a known fact is starving and is reviewed before anything
 * else. Children play on weekdays, so a starving fact is served within a few days: well inside
 * the week a known fact may wait (docs/testing.md §4).
 */
export const STARVING_DAYS = 4;

/**
 * The lower edge of the success band (70-90 %, docs/testing.md §4). Below it the game protects
 * the child's success: the mix serves likely successes first, snacks are smaller, reviews and
 * re-asks are asked by choice; and while today's success is below it the Daily Adventure holds
 * new levels after the day's first.
 */
export const LOW_SUCCESS = 70;

/** Signed integer division rounded toward zero (no floating-point fractions in rules). */
function quotient(a: number, b: number): number {
  return (a - (a % b)) / b;
}

export function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/**
 * The child's last `mix.window` answers, across days (the day records in `history`, today's
 * last). A day's answers count at that day's success rate: the records keep no order within a day.
 */
function recentAnswers(state: ReadState, data: Data): { answers: number; correct: number } {
  const window = data.balance.mix.window;
  let answers = 0;
  let correct = 0;
  for (let i = state.history.length - 1; i >= 0 && answers < window; i--) {
    const day = state.history[i]!;
    if (day.answers === 0) continue;
    const take = Math.min(day.answers, window - answers);
    correct += quotient(day.correct * take, day.answers);
    answers += take;
  }
  return { answers, correct };
}

/** Success (percent) over the last `mix.window` answers, or `null` before `MIN_SAMPLE` answers. */
export function recentSuccess(state: ReadState, data: Data): number | null {
  const { answers, correct } = recentAnswers(state, data);
  return answers < MIN_SAMPLE ? null : quotient(correct * 100, answers);
}

/** Today's success (percent), or `null` before `MIN_SAMPLE` answers today. */
export function todaySuccess(state: ReadState): number | null {
  const daily = state.daily;
  if (daily === null || daily.day !== state.day || daily.answers < MIN_SAMPLE) return null;
  return quotient(daily.correct * 100, daily.answers);
}

/** Whether today's success is below `LOW_SUCCESS`: the Daily Adventure then holds new levels. */
export function lowToday(state: ReadState): boolean {
  const today = todaySuccess(state);
  return today !== null && today < LOW_SUCCESS;
}

/** Whether recent success is below `LOW_SUCCESS`: the game then protects the child's success. */
export function lowSuccess(state: ReadState, data: Data): boolean {
  const success = recentSuccess(state, data);
  return success !== null && success < LOW_SUCCESS;
}

/** Whether the last answer to the item was a miss. */
export function missedLast(record: DeepReadonly<ItemState> | undefined): boolean {
  return record !== undefined && record.recent[record.recent.length - 1] === 'miss';
}

/** Whether the last two answers to the item were misses: it is taught before it is asked. */
export function missedTwice(record: DeepReadonly<ItemState> | undefined): boolean {
  const recent = record?.recent ?? [];
  return (
    recent.length >= 2 &&
    recent[recent.length - 1] === 'miss' &&
    recent[recent.length - 2] === 'miss'
  );
}

/** The tier of an item on `day`. */
export function itemTier(state: ReadState, item: string, day: number): ItemTier {
  const record = state.items[item];
  if (isDue(record, day)) return 'due';
  return record !== undefined && record.box >= KNOWN_BOX ? 'known' : 'learning';
}

/**
 * The item's tier in the mix: its `itemTier`, except that while the child's success is
 * protected (`protect`, recent success below `LOW_SUCCESS`) a due item missed last time is a
 * learning item rather than a likely success.
 */
export function mixTier(state: ReadState, item: string, day: number, protect: boolean): ItemTier {
  const tier = itemTier(state, item, day);
  return protect && tier === 'due' && missedLast(state.items[item]) ? 'learning' : tier;
}

/** The share (percent) of draws that serve a learning item, from recent success. */
export function learningShare(state: ReadState, data: Data): number {
  const { knownShare, successTarget, minLearningShare, maxLearningShare, window } =
    data.balance.mix;
  const base = 100 - knownShare;
  const { answers, correct } = recentAnswers(state, data);
  if (answers < MIN_SAMPLE) return clamp(base, minLearningShare, maxLearningShare);
  const accuracy = quotient(correct * 100, answers);
  const shift = quotient((accuracy - successTarget) * answers, window);
  return clamp(base + shift, minLearningShare, maxLearningShare);
}

/** Owned dragon eggs: the chosen first egg first, then the oldest (ties in content order). */
export function eggsByAge(state: ReadState, data: Data): DeepReadonly<Dragon>[] {
  const first = state.onboarding.firstEgg;
  return data.dragons
    .map((dragon, order) => ({ dragon, order, owned: state.dragons[dragon.id] }))
    .filter((entry) => entry.owned !== undefined && entry.owned.stage === 'egg')
    .sort(
      (a, b) =>
        Number(b.dragon.id === first) - Number(a.dragon.id === first) ||
        a.owned!.obtainedDay - b.owned!.obtainedDay ||
        a.order - b.order,
    )
    .map((entry) => entry.dragon);
}

/**
 * The focus egg's facts among `pool` that were never answered correctly (those are what warms
 * an egg: hatching needs facts answered right at least once), from the oldest owned egg that
 * still has some; `null` when no egg can be warmed by this round. With `tables` (the round's own
 * times tables), a table dragon's egg is warmed only by a round that practises its table: Puff's
 * `2 · 0` is only a stray fact of the twos, so a round of twos warms Bubbles, not Puff.
 */
export function focusItems(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
  pool: readonly string[],
  tables?: ReadonlySet<number>,
): string[] | null {
  const available = new Set(pool);
  for (const egg of eggsByAge(state, data)) {
    if (tables !== undefined && egg.table !== null && !tables.has(egg.table)) continue;
    const items = [...new Set(egg.skills.flatMap((skill) => index.get(skill) ?? []))].filter(
      (item) => available.has(item) && (state.items[item]?.correct ?? 0) === 0,
    );
    if (items.length > 0) return items.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  return null;
}

/** The times tables a round practises: its skills' tables, divisors and missing-factor tables. */
export function roundTables(skills: readonly DeepReadonly<Skill>[]): Set<number> {
  const tables = new Set<number>();
  for (const skill of skills) {
    if (skill.generator === 'mul.fact' || skill.generator === 'mul.missing') {
      skill.params.tables.forEach((table) => tables.add(table));
    } else if (skill.generator === 'div.fact') {
      skill.params.divisors.forEach((divisor) => tables.add(divisor));
    }
  }
  return tables;
}

/** The focus for a round of `skills`: an egg whose table the round practises (focusItems). */
export function roundFocus(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
  pool: readonly string[],
  skills: readonly DeepReadonly<Skill>[],
): string[] | null {
  return focusItems(state, data, index, pool, roundTables(skills));
}

/**
 * Strategy items are the open-ended skills grouped into buckets (`<family>:<bucket>`: remainders,
 * powers of ten, tens, 2-digit × 1-digit and 2-digit : 1-digit, order of operations, comparisons,
 * word problems, terms), solved with a strategy rather than recalled; small-table facts (`mul:`,
 * `div:`) are not. The first time a strategy item comes up it is taught before it is asked.
 */
export function isStrategyItem(item: string): boolean {
  return parseItemId(item)?.kind === 'bucket';
}

/**
 * Rule facts follow a rule instead of being remembered one by one: `n · 0`, `n · 1` (either
 * order), `0 : n` and `n : 1`. A round whose own tables do not include 0 or 1 serves at most one
 * of them (docs/design.md §6.3), so they never crowd out the facts the round is about.
 */
export function isRuleFact(item: string): boolean {
  const parsed = parseItemId(item);
  if (parsed?.kind === 'mul') return parsed.a <= 1 || parsed.b <= 1;
  if (parsed?.kind === 'div') return parsed.dividend === 0 || parsed.divisor === 1;
  return false;
}

/**
 * Whether a dragon's growth from bronze up counts `item`: every fact of its set, except that rule
 * facts count only for the dragons of the 0 and 1 tables (Puff and Mirror), whose facts they are.
 * A round serves at most one rule fact, so for any other dragon they would hold growth back.
 */
export function growsWith(dragon: DeepReadonly<Dragon>, item: string): boolean {
  return dragon.table === 0 || dragon.table === 1 || !isRuleFact(item);
}

/** The recently served items that may not be served again yet (none when `window` is 0). */
export function blockedRecent(recent: readonly string[], window: number): string[] {
  return window <= 0 ? [] : recent.slice(-window);
}

/** `pool` without the blocked items, or the whole pool when nothing else is left. */
export function withoutRecent(pool: readonly string[], blocked: readonly string[]): string[] {
  const free = pool.filter((item) => !blocked.includes(item));
  return free.length > 0 ? free : [...pool];
}

/** The first non-empty subset of `items` passing a test, in order of preference, else all. */
export function prefer<T>(items: readonly T[], ...tests: ((item: T) => boolean)[]): T[] {
  for (const test of tests) {
    const subset = items.filter(test);
    if (subset.length > 0) return subset;
  }
  return [...items];
}

/** Due items, most overdue first; a random one among the most overdue. */
export function pickDue(
  state: ReadState,
  due: readonly string[],
  random: RandomStream,
): string | null {
  if (due.length === 0) return null;
  let earliest = Number.MAX_SAFE_INTEGER;
  for (const item of due) earliest = Math.min(earliest, state.items[item]!.due);
  return random.pick(due.filter((item) => state.items[item]!.due === earliest));
}

/** The items practised most recently (the latest `lastDay`). */
function mostRecent(state: ReadState, items: readonly string[]): string[] {
  let latest = -1;
  for (const item of items) latest = Math.max(latest, state.items[item]!.lastDay);
  return items.filter((item) => state.items[item]!.lastDay === latest);
}

/**
 * The likeliest successes among `items`: those answered right last time, the most recently
 * practised first; else new items; else the most recently practised (missed last time).
 */
export function likely(state: ReadState, items: readonly string[]): string[] {
  const seen = items.filter((item) => state.items[item] !== undefined);
  const right = seen.filter((item) => !missedLast(state.items[item]));
  if (right.length > 0) return mostRecent(state, right);
  const fresh = items.filter((item) => state.items[item] === undefined);
  return fresh.length > 0 ? fresh : mostRecent(state, seen);
}

/** One of the likeliest successes among `items` (`likely`), or `null` when there are none. */
export function pickLikely(
  state: ReadState,
  items: readonly string[],
  random: RandomStream,
): string | null {
  return items.length === 0 ? null : random.pick(likely(state, items));
}

/** Whether a known fact (box `KNOWN_BOX`+) has waited `STARVING_DAYS` or more past its review. */
export function starving(record: DeepReadonly<ItemState> | undefined, day: number): boolean {
  return (
    record !== undefined &&
    record.box >= KNOWN_BOX &&
    isDue(record, day) &&
    day - record.due >= STARVING_DAYS
  );
}

/**
 * The next of the `due` items to review: a starving fact first (the most overdue), whatever the
 * child's success; else the most overdue, or with `likelyFirst` (success protected) the likeliest
 * success. `null` when nothing is due.
 */
export function pickReview(
  state: ReadState,
  due: readonly string[],
  random: RandomStream,
  likelyFirst: boolean,
): string | null {
  const day = state.day ?? 0;
  const starved = due.filter((item) => starving(state.items[item], day));
  if (starved.length > 0) return pickDue(state, starved, random);
  return likelyFirst ? pickLikely(state, due, random) : pickDue(state, due, random);
}

/**
 * A learning item: the focus egg's first, items not served in this round before others, then
 * new and weak items in equal measure; with `likelyFirst` (recent success below target), the
 * likeliest successes instead (`likely`).
 */
export function pickLearning(
  state: ReadState,
  learning: readonly string[],
  focus: readonly string[] | null,
  random: RandomStream,
  served: readonly string[] = [],
  likelyFirst = false,
): string | null {
  if (learning.length === 0) return null;
  const focused = focus === null ? [] : learning.filter((item) => focus.includes(item));
  const from = prefer(focused.length > 0 ? focused : learning, (item) => !served.includes(item));
  if (likelyFirst) return random.pick(likely(state, from));
  const fresh = from.filter((item) => state.items[item] === undefined);
  const weak = from.filter((item) => state.items[item] !== undefined);
  if (fresh.length > 0 && weak.length > 0) return random.pick(random.bool() ? fresh : weak);
  return random.pick(fresh.length > 0 ? fresh : weak);
}

/**
 * A known item not served in this round yet, one not practised today if possible; `null` when
 * every known item was already served (the draw then moves on rather than repeat one).
 */
export function pickKnown(
  state: ReadState,
  known: readonly string[],
  random: RandomStream,
  served: readonly string[] = [],
): string | null {
  const day = state.day ?? 0;
  const fresh = known.filter((item) => !served.includes(item));
  if (fresh.length === 0) return null;
  return random.pick(prefer(fresh, (item) => state.items[item]!.lastDay < day));
}

/**
 * The next item of a mixed round from `pool` (the round's items), skipping `blocked` recent
 * items while others are available and preferring items not `served` in this round yet. `null`
 * when the pool is empty (like every draw here: the round then has nothing left to serve).
 */
export function pickMixed(options: {
  state: ReadState;
  data: Data;
  pool: readonly string[];
  blocked: readonly string[];
  served?: readonly string[];
  focus: readonly string[] | null;
  random: RandomStream;
}): string | null {
  const { state, data, random } = options;
  const served = options.served ?? [];
  const day = state.day ?? 0;
  const candidates = withoutRecent(options.pool, options.blocked);
  if (candidates.length === 0) return null;
  const tiers: Record<ItemTier, string[]> = { due: [], known: [], learning: [] };
  const protect = lowSuccess(state, data);
  for (const item of candidates) tiers[mixTier(state, item, day, protect)].push(item);
  const learningFirst = random.int(0, 100) < learningShare(state, data);
  if (learningFirst) {
    const item = pickLearning(state, tiers.learning, options.focus, random, served, protect);
    if (item !== null) return item;
  }
  return (
    pickReview(state, tiers.due, random, protect) ??
    pickKnown(state, tiers.known, random, served) ??
    pickLearning(state, tiers.learning, options.focus, random, served, protect) ??
    random.pick(prefer(candidates, (item) => !served.includes(item)))
  );
}

/**
 * Snack time: starving facts first (the review guarantee), then at every other problem a first
 * taste (`tastes`: facts the child was taught but never answered, in order), up to
 * `tastesPerSnack` in a snack; the first of them (the 2nd problem) comes even before starving
 * facts, unless the child's success is protected (`likelyFirst`). Then due items (the most overdue, or with `likelyFirst`, while
 * the child's success is protected, the likeliest successes), then rule facts never answered right
 * (other rounds serve at most one of them, so snack time is where Puff and Mirror meet the rest
 * of their facts), then the weakest known items (lowest box) not served in this snack yet, then
 * anything in the pool. `null` when the pool is empty: a snack of the basket alone empties it as
 * it goes.
 */
export function pickSnack(options: {
  state: ReadState;
  pool: readonly string[];
  blocked: readonly string[];
  served?: readonly string[];
  random: RandomStream;
  likelyFirst?: boolean;
  tastes?: readonly string[];
  tastesPerSnack?: number;
}): string | null {
  const { state, random } = options;
  const served = options.served ?? [];
  const day = state.day ?? 0;
  const candidates = withoutRecent(options.pool, options.blocked);
  if (candidates.length === 0) return null;
  const due = candidates.filter((item) => isDue(state.items[item], day));
  const starved = due.filter((item) => starving(state.items[item], day));
  const slot = served.length % 2 === 1 && served.length < 2 * (options.tastesPerSnack ?? 0);
  const taste = slot
    ? (options.tastes ?? []).find((item) => candidates.includes(item) && !served.includes(item))
    : undefined;
  // A snack's first taste comes even before starving facts, unless the child's success is
  // protected: a long review backlog must not hold every new fact back for weeks.
  const firstTaste = served.length === 1 && !(options.likelyFirst ?? false);
  if (taste !== undefined && (firstTaste || starved.length === 0)) return taste;
  if (starved.length > 0) return pickDue(state, starved, random)!;
  const picked = pickReview(state, due, random, options.likelyFirst ?? false);
  if (picked !== null) return picked;
  const rules = candidates.filter(
    (item) => isRuleFact(item) && (state.items[item]?.correct ?? 0) === 0 && !served.includes(item),
  );
  if (rules.length > 0) return random.pick(rules);
  const known = prefer(
    candidates.filter((item) => (state.items[item]?.correct ?? 0) > 0),
    (item) => !served.includes(item),
  );
  if (known.length > 0) {
    let lowest = 6;
    for (const item of known) lowest = Math.min(lowest, state.items[item]!.box);
    return random.pick(known.filter((item) => state.items[item]!.box === lowest));
  }
  return random.pick(prefer(candidates, (item) => !served.includes(item)));
}

/**
 * Placement: an item of the step's skill not asked yet in this round, new items first; with
 * `focus` (every other problem of a step), the chosen egg's facts first, so a child who knows
 * them warms the egg already in the check. `null` when the pool is empty.
 */
export function pickPlacement(options: {
  state: ReadState;
  pool: readonly string[];
  blocked: readonly string[];
  random: RandomStream;
  focus?: readonly string[] | null;
}): string | null {
  const { state, random, focus } = options;
  const candidates = withoutRecent(options.pool, options.blocked);
  if (candidates.length === 0) return null;
  const fresh = candidates.filter((item) => state.items[item] === undefined);
  const from = fresh.length > 0 ? fresh : candidates;
  const focused = focus ? from.filter((item) => focus.includes(item)) : [];
  return random.pick(focused.length > 0 ? focused : from);
}

/**
 * The Arena: facts answered right before, not served in this race yet, else anything. `null` when
 * the pool is empty.
 */
export function pickArena(options: {
  state: ReadState;
  pool: readonly string[];
  blocked: readonly string[];
  served: readonly string[];
  random: RandomStream;
}): string | null {
  const { state, served, random } = options;
  const candidates = withoutRecent(options.pool, options.blocked);
  if (candidates.length === 0) return null;
  return random.pick(
    prefer(
      candidates,
      (item) => (state.items[item]?.correct ?? 0) > 0 && !served.includes(item),
      (item) => (state.items[item]?.correct ?? 0) > 0,
    ),
  );
}

/** A seeded Fisher-Yates shuffle. */
export function shuffled<T>(items: readonly T[], random: RandomStream): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random.int(0, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
