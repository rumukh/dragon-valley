/**
 * Growth variants: other rules for a dragon's youngling, adult and crowned stages, evaluated
 * during a simulation alongside the shipped `balance.growth`. Growth past hatching never feeds
 * back into play (the rules read a dragon's stage only for its egg, the view and sticker
 * criteria; stickers pay nothing; no quest or story beat waits on growth), so the stage days a
 * variant records are exactly the ones it would give on the same run. One run then compares
 * several candidates for the struggling child's dragons (docs/balance-report.md).
 *
 * A variant is data: gates like `balance.growth` (a share of the dragon's facts at a mastery
 * level; its division facts too, at their own share if given; its boss), gates of their own
 * for some dragons, and an optional effort path: a fact also counts as bronze or silver once it
 * was answered right on enough different days, `gap` days or more apart.
 *
 * A variant reads the rules' mastery levels (`atLeast`), so the content's own effort path
 * (`balance.mastery.effort`, from content 1.3.0) counts in every variant, and a variant's effort
 * path only adds to it. The growth study (balance-report.md §8) ran on content 1.2.0, which has
 * none: reproduce it there (main 5d98ee3).
 */
import type { DeepReadonly } from '@aegis/runtime';
import { DRAGON_STAGES } from '../../src/rules/contract';
import type { ContentData, Dragon, DragonStage, ItemState } from '../../src/rules/contract';
import { atLeast } from '../../src/rules/learning/items';
import { growthItems } from '../../src/rules/progression/dragons';
import { percentOf } from '../../src/rules/progression/levels';

export type GateMastery = 'seen' | 'bronze' | 'silver' | 'gold';

export interface GrowthGate {
  stage: Exclude<DragonStage, 'egg'>;
  /** Share (percent) of the dragon's multiplication facts at `mastery` or better. */
  share: number;
  mastery: GateMastery;
  /** Whether the dragon's division facts must reach a share too (`divisionShare`, else `share`). */
  division: boolean;
  divisionShare?: number;
  /** Whether the dragon's boss must be won over. */
  boss: boolean;
}

export interface GrowthVariant {
  id: string;
  /** The gates in stage order, like `balance.growth`. */
  gates: GrowthGate[];
  /** Gates of their own for some dragons (by id), e.g. the easy tables. */
  dragons?: Record<string, GrowthGate[]>;
  /**
   * The effort path: a fact also counts as `bronze` (or `silver`) once it was answered right on
   * at least that many different days, each counted day `gap` days (default 1) after the last.
   */
  effort?: { bronze?: number; silver?: number; gap?: number };
}

/** The state a variant reads: the facts, the bosses won over and the owned dragons. */
export interface GrowthState {
  items: Readonly<Record<string, DeepReadonly<ItemState>>>;
  bosses: Readonly<Record<string, unknown>>;
  dragons: Readonly<Record<string, { stage: DragonStage }>>;
}

const RANK: Record<GateMastery | 'dim', number> = {
  dim: 0,
  seen: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
};

type Data = DeepReadonly<ContentData>;
type Index = ReadonlyMap<string, readonly string[]>;

/** A dragon's growth facts for a gate's mastery: multiplication and division (cached per dragon). */
function factsFor(
  cache: Map<string, { mul: string[]; div: string[] }>,
  dragon: DeepReadonly<Dragon>,
  mastery: GateMastery,
  index: Index,
) {
  const key = `${dragon.id}:${mastery === 'seen' ? 'seen' : 'known'}`;
  let facts = cache.get(key);
  if (facts === undefined) {
    facts = {
      mul: growthItems(dragon, dragon.skills, index, mastery),
      div: growthItems(dragon, dragon.divisionSkills, index, mastery),
    };
    cache.set(key, facts);
  }
  return facts;
}

/**
 * The stage a variant gives `dragon` on `state`: the last of its gates met with every gate
 * before it, as the rules' `earnedStage` does. `rightDays` counts the different days each fact
 * was answered right (the effort path).
 */
export function variantStage(
  variant: GrowthVariant,
  dragon: DeepReadonly<Dragon>,
  state: GrowthState,
  data: Data,
  index: Index,
  rightDays: ReadonlyMap<string, number> = new Map(),
  cache: Map<string, { mul: string[]; div: string[] }> = new Map(),
): DragonStage {
  const effort = variant.effort ?? {};
  const counts = (item: string, mastery: GateMastery): boolean => {
    const record = state.items[item];
    if (atLeast(record, mastery, data.balance)) return true;
    if (mastery !== 'bronze' && mastery !== 'silver') return false;
    const days = rightDays.get(item) ?? 0;
    const byEffort =
      effort.silver !== undefined && days >= effort.silver
        ? 'silver'
        : effort.bronze !== undefined && days >= effort.bronze
          ? 'bronze'
          : 'dim';
    return RANK[byEffort] >= RANK[mastery];
  };
  const share = (items: readonly string[], mastery: GateMastery) =>
    items.length === 0
      ? 100
      : percentOf(items.filter((item) => counts(item, mastery)).length, items.length);
  let stage: DragonStage = 'egg';
  for (const gate of variant.dragons?.[dragon.id] ?? variant.gates) {
    const facts = factsFor(cache, dragon, gate.mastery, index);
    if (share(facts.mul, gate.mastery) < gate.share) break;
    if (gate.division && share(facts.div, gate.mastery) < (gate.divisionShare ?? gate.share)) {
      break;
    }
    if (gate.boss && dragon.boss !== null && state.bosses[dragon.boss] === undefined) break;
    stage = gate.stage;
  }
  return stage;
}

/**
 * Follows a run: after each commit, counts the days each fact was answered right (per spacing
 * `gap` the variants use) and records, per variant and owned (hatched) dragon, the first day
 * index it reached each stage. Stages never go down, as in the game.
 */
export class GrowthProbes {
  /** Variant id → dragon id → stage → first day index. */
  readonly days: Record<string, Record<string, Partial<Record<DragonStage, number>>>> = {};
  private readonly reached = new Map<string, number>();
  /** Per gap: days right per fact, and the last count and counted day seen per fact. */
  private readonly right = new Map<
    number,
    { days: Map<string, number>; seen: Map<string, { correct: number; counted: number | null }> }
  >();
  private readonly cache = new Map<string, { mul: string[]; div: string[] }>();

  constructor(
    private readonly data: Data,
    private readonly index: Index,
    private readonly variants: readonly GrowthVariant[],
  ) {
    for (const variant of variants) {
      this.days[variant.id] = {};
      if (variant.effort !== undefined) {
        this.right.set(variant.effort.gap ?? 1, { days: new Map(), seen: new Map() });
      }
    }
  }

  /** Count a day for each fact answered right since the last commit, `gap` days after the last. */
  private countRight(state: GrowthState): void {
    for (const [gap, tally] of this.right) {
      for (const [item, record] of Object.entries(state.items)) {
        const seen = tally.seen.get(item);
        if (record.correct <= (seen?.correct ?? 0)) continue;
        const counted = seen?.counted ?? null;
        const counts = counted === null || record.lastDay - counted >= gap;
        if (counts) tally.days.set(item, (tally.days.get(item) ?? 0) + 1);
        tally.seen.set(item, {
          correct: record.correct,
          counted: counts ? record.lastDay : counted,
        });
      }
    }
  }

  /** Days each fact was answered right, counted `gap` days apart (an effort variant's count). */
  rightDays(gap = 1): ReadonlyMap<string, number> {
    return this.right.get(gap)?.days ?? new Map();
  }

  update(state: GrowthState, dayIndex: number): void {
    this.countRight(state);
    const none = new Map<string, number>();
    for (const variant of this.variants) {
      const rightDays =
        variant.effort === undefined ? none : this.right.get(variant.effort.gap ?? 1)!.days;
      for (const dragon of this.data.dragons) {
        const owned = state.dragons[dragon.id];
        if (owned === undefined || owned.stage === 'egg') continue;
        const key = `${variant.id}:${dragon.id}`;
        const before = this.reached.get(key) ?? 0;
        if (before === DRAGON_STAGES.length - 1) continue;
        const stage = variantStage(
          variant,
          dragon,
          state,
          this.data,
          this.index,
          rightDays,
          this.cache,
        );
        const rank = DRAGON_STAGES.indexOf(stage);
        if (rank <= before) continue;
        const record = (this.days[variant.id]![dragon.id] ??= {});
        for (let r = before + 1; r <= rank; r++) record[DRAGON_STAGES[r]!] = dayIndex;
        this.reached.set(key, rank);
      }
    }
  }
}
