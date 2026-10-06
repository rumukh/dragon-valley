/**
 * Item selection: which item a problem round serves next (the mix, docs/design.md §6.3).
 *
 * Items are sorted into three tiers on the child's current day:
 * - **due**: known items whose review day has come (spaced review, most overdue first);
 * - **known**: items at bronze or better (box 2+) that are not due;
 * - **learning**: new items and items in box 0-1.
 *
 * Each draw first decides, from the `problems` stream, whether to serve a learning item. The
 * learning share starts at `100 - mix.knownShare` and follows today's success rate: above
 * `mix.successTarget` it grows, below it shrinks, within `mix.minLearningShare` …
 * `mix.maxLearningShare`; the adjustment reaches full strength after `mix.window` answers.
 * Otherwise a due review is served, else a known item, else a learning item. Items served in
 * the last `mix.noRepeatWithin` problems are skipped while anything else is available, and
 * inside a tier items not served in this round yet come first (known items: also not
 * practised today), so a small tier never makes a round repeat itself.
 *
 * Learning draws prefer the **focus egg**: the chosen first egg while it is an egg, else the
 * oldest owned egg, whose facts the round can serve and that were never answered right. Practice
 * warms the egg, so the first Feeding Time hatches the first egg whichever table it is
 * (docs/design.md §4.1). Then new items and weak items share the draws.
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { parseItemId } from '../contract';
import type { Dragon, Skill } from '../contract';
import { isDue } from './items';
import type { Data, ReadState } from '../types';

export type ItemTier = 'due' | 'known' | 'learning';

/** Answers today before the learning share starts to follow the success rate. */
const MIN_SAMPLE = 5;

/** Signed integer division rounded toward zero (no floating-point fractions in rules). */
function quotient(a: number, b: number): number {
  return (a - (a % b)) / b;
}

export function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/** The tier of an item on `day`. */
export function itemTier(state: ReadState, item: string, day: number): ItemTier {
  const record = state.items[item];
  if (isDue(record, day)) return 'due';
  return record !== undefined && record.box >= 2 ? 'known' : 'learning';
}

/** The share (percent) of draws that serve a learning item, from today's success rate. */
export function learningShare(state: ReadState, data: Data): number {
  const { knownShare, successTarget, minLearningShare, maxLearningShare, window } =
    data.balance.mix;
  const base = 100 - knownShare;
  const daily = state.daily;
  if (daily === null || daily.day !== state.day || daily.answers < MIN_SAMPLE) {
    return clamp(base, minLearningShare, maxLearningShare);
  }
  const accuracy = quotient(daily.correct * 100, daily.answers);
  const weight = daily.answers < window ? daily.answers : window;
  const shift = quotient((accuracy - successTarget) * weight, window);
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

/**
 * A learning item: the focus egg's first, items not served in this round before others, then
 * new and weak items in equal measure.
 */
export function pickLearning(
  state: ReadState,
  learning: readonly string[],
  focus: readonly string[] | null,
  random: RandomStream,
  served: readonly string[] = [],
): string | null {
  if (learning.length === 0) return null;
  const focused = focus === null ? [] : learning.filter((item) => focus.includes(item));
  const from = prefer(focused.length > 0 ? focused : learning, (item) => !served.includes(item));
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
 * items while others are available and preferring items not `served` in this round yet.
 */
export function pickMixed(options: {
  state: ReadState;
  data: Data;
  pool: readonly string[];
  blocked: readonly string[];
  served?: readonly string[];
  focus: readonly string[] | null;
  random: RandomStream;
}): string {
  const { state, data, random } = options;
  const served = options.served ?? [];
  const day = state.day ?? 0;
  const candidates = withoutRecent(options.pool, options.blocked);
  const tiers: Record<ItemTier, string[]> = { due: [], known: [], learning: [] };
  for (const item of candidates) tiers[itemTier(state, item, day)].push(item);
  const learningFirst = random.int(0, 100) < learningShare(state, data);
  if (learningFirst) {
    const item = pickLearning(state, tiers.learning, options.focus, random, served);
    if (item !== null) return item;
  }
  return (
    pickDue(state, tiers.due, random) ??
    pickKnown(state, tiers.known, random, served) ??
    pickLearning(state, tiers.learning, options.focus, random, served) ??
    random.pick(prefer(candidates, (item) => !served.includes(item)))
  );
}

/**
 * Snack time: due items first (most overdue), then the weakest known items (lowest box) not
 * served in this snack yet, then anything in the dragons' sets.
 */
export function pickSnack(options: {
  state: ReadState;
  pool: readonly string[];
  blocked: readonly string[];
  served?: readonly string[];
  random: RandomStream;
}): string {
  const { state, random } = options;
  const served = options.served ?? [];
  const day = state.day ?? 0;
  const candidates = withoutRecent(options.pool, options.blocked);
  const due = candidates.filter((item) => isDue(state.items[item], day));
  const picked = pickDue(state, due, random);
  if (picked !== null) return picked;
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
 * them warms the egg already in the check.
 */
export function pickPlacement(options: {
  state: ReadState;
  pool: readonly string[];
  blocked: readonly string[];
  random: RandomStream;
  focus?: readonly string[] | null;
}): string {
  const { state, random, focus } = options;
  const candidates = withoutRecent(options.pool, options.blocked);
  const fresh = candidates.filter((item) => state.items[item] === undefined);
  const from = fresh.length > 0 ? fresh : candidates;
  const focused = focus ? from.filter((item) => focus.includes(item)) : [];
  return random.pick(focused.length > 0 ? focused : from);
}

/** The Arena: facts answered right before, not served in this race yet, else anything. */
export function pickArena(options: {
  state: ReadState;
  pool: readonly string[];
  blocked: readonly string[];
  served: readonly string[];
  random: RandomStream;
}): string {
  const { state, served, random } = options;
  const candidates = withoutRecent(options.pool, options.blocked);
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
