/**
 * The effort path to bronze and silver (docs/design.md §6.5): a fact also counts as bronze once it
 * was answered right on `bronzeDays` different days, and as silver on `silverDays`, each counted
 * day at least `gapDays` after the last counted one, at any speed. The level the child sees and
 * dragons grow by is the better of the Leitner box's and the effort path's; gold stays fluency.
 * Without `balance.mastery.effort` nothing is counted and nothing changes. States are built by
 * hand; the expectations are worked out here.
 */
import { describe, expect, it } from 'vitest';
import { dragonValleyAdapter } from '../../../src/rules/adapter';
import {
  contentRegistration,
  initialProfileState,
  validateContentData,
} from '../../../src/rules/contract';
import { parseContentJson } from '@aegis/runtime';
import type {
  ContentData,
  ItemState,
  ProfileState,
  ResponseBucket,
} from '../../../src/rules/contract';
import { creditItem } from '../../../src/rules/learning/credit';
import { itemIndex } from '../../../src/rules/learning/index-cache';
import {
  atLeast,
  boxLevel,
  effortLevel,
  masteryLevel,
  updateItem,
} from '../../../src/rules/learning/items';
import { earnedStage, growthItems, itemsOf } from '../../../src/rules/progression/dragons';
import { awardStickers } from '../../../src/rules/economy/rewards';
import { projectView } from '../../../src/rules/view';
import type { Ctx, Read } from '../../../src/rules/types';
import { loadPack } from '../../traces/support';

const plain = loadPack().data;
const EFFORT = { bronzeDays: 2, silverDays: 4, gapDays: 2 };
/** The shipped pack with the effort path: bronze after 2 counted days, silver after 4, 2 apart. */
const data: ContentData = JSON.parse(JSON.stringify(plain));
data.balance.mastery.effort = { ...EFFORT };
const index = itemIndex(plain);
const DAY = 20_000;

/** The record after right (`'slow'` by default) or missed answers on the given days. */
function answered(
  days: readonly number[],
  bucket: ResponseBucket = 'slow',
  balance = data.balance,
) {
  let record: ItemState | undefined;
  for (const day of days) record = updateItem(record, bucket, DAY + day, balance);
  return record!;
}

describe('counting the days a fact was answered right', () => {
  it('counts the first right day, at any speed', () => {
    expect(answered([0], 'slow')).toMatchObject({ box: 0, rightDays: 1, lastCountedDay: DAY });
    expect(answered([0], 'fast')).toMatchObject({ box: 1, rightDays: 1, lastCountedDay: DAY });
    const missed = answered([0], 'miss');
    expect(missed.rightDays, 'a miss counts nothing').toBeUndefined();
    expect(missed.lastCountedDay).toBeUndefined();
  });

  it('counts a day only gapDays after the last counted day, not the last right day', () => {
    // Right on days 0, 1, 2, 5 and 6 with a gap of 2: days 0, 2 and 5 count.
    const record = answered([0, 1, 2, 5, 6]);
    expect(record).toMatchObject({ rightDays: 3, lastCountedDay: DAY + 5, correct: 5 });
    expect(answered([0, 0, 0, 2, 2]).rightDays, 'a day counts once').toBe(2);
    const gapOne: ContentData['balance'] = {
      ...data.balance,
      mastery: { ...data.balance.mastery, effort: { ...EFFORT, gapDays: 1 } },
    };
    expect(answered([0, 1, 2, 5, 6], 'ok', gapOne).rightDays, 'a gap of 1: every day').toBe(5);
  });

  it('keeps the count through a miss, and counts again after it', () => {
    const counted = answered([0, 2]);
    const missed = updateItem(counted, 'miss', DAY + 4, data.balance);
    expect(missed).toMatchObject({ box: 1, rightDays: 2, lastCountedDay: DAY + 2 });
    expect(updateItem(missed, 'slow', DAY + 4, data.balance).rightDays).toBe(3);
  });

  it('counts nothing without the path, and a record keeps the counts it has', () => {
    const record = answered([0, 2, 4], 'ok', plain.balance);
    expect(Object.keys(record).sort(), 'no new fields: 1.2.0 states hash the same').toEqual([
      'box',
      'correct',
      'due',
      'lastDay',
      'recent',
      'seen',
    ]);
    const counted = answered([0, 2]);
    expect(updateItem(counted, 'ok', DAY + 6, plain.balance)).toMatchObject({
      rightDays: 2,
      lastCountedDay: DAY + 2,
    });
  });
});

describe('the mastery level: the better of the box and the effort path', () => {
  const record = (patch: Partial<ItemState>): ItemState => ({
    box: 1,
    due: DAY,
    seen: 6,
    correct: 6,
    recent: ['slow', 'slow', 'slow'],
    lastDay: DAY,
    ...patch,
  });

  it('gives bronze after bronzeDays counted days and silver after silverDays, never gold', () => {
    const levels = [0, 1, 2, 3, 4, 40].map((days) =>
      effortLevel(
        days === 0 ? record({}) : record({ rightDays: days, lastCountedDay: DAY }),
        data.balance,
      ),
    );
    expect(levels).toEqual(['dim', 'dim', 'bronze', 'bronze', 'silver', 'silver']);
    expect(effortLevel(record({ rightDays: 9, lastCountedDay: DAY }), plain.balance)).toBe('dim');
  });

  it('takes the better of the two; gold only from a fluent box', () => {
    const fluent = record({ box: 5, recent: ['fast', 'fast', 'ok'] });
    const steady = record({ box: 5, recent: ['ok', 'ok', 'ok'] });
    const cases: [ItemState, string, string][] = [
      [record({ rightDays: 4, lastCountedDay: DAY }), 'dim', 'silver'],
      [record({ box: 3, rightDays: 2, lastCountedDay: DAY }), 'silver', 'silver'],
      [record({ box: 2, rightDays: 4, lastCountedDay: DAY }), 'bronze', 'silver'],
      [{ ...fluent, rightDays: 4, lastCountedDay: DAY }, 'gold', 'gold'],
      [{ ...steady, rightDays: 40, lastCountedDay: DAY }, 'silver', 'silver'],
    ];
    for (const [item, byBox, level] of cases) {
      expect(boxLevel(item, data.balance), JSON.stringify(item)).toBe(byBox);
      expect(masteryLevel(item, data.balance), JSON.stringify(item)).toBe(level);
    }
    expect(atLeast(record({ rightDays: 2, lastCountedDay: DAY }), 'bronze', data.balance)).toBe(
      true,
    );
    expect(atLeast(record({ rightDays: 2, lastCountedDay: DAY }), 'bronze', plain.balance)).toBe(
      false,
    );
  });
});

/**
 * A child with Bubbles (×2) hatched whose facts of `skills` (×2 and ÷2) were all answered right,
 * slowly (box 0), each counted on `rightDays` days, the last one `ago` days back.
 */
function child(rightDays: number, skills = ['mul-2', 'div-2'], ago = 2): ProfileState {
  const s: ProfileState = { ...initialProfileState({ dailyGoal: 30, arena: true }), day: DAY };
  const outfit = { head: null, neck: null, eyes: null, wings: null, nest: null };
  s.dragons = { bubbles: { stage: 'hatchling', obtainedDay: DAY - 9, stageDay: DAY - 9, outfit } };
  s.items = Object.fromEntries(
    itemsOf(skills, index).map((item) => [
      item,
      {
        box: 0,
        due: DAY,
        seen: rightDays,
        correct: rightDays,
        recent: ['slow', 'slow', 'slow'].slice(0, Math.min(3, rightDays)) as ResponseBucket[],
        lastDay: DAY - ago,
        ...(rightDays > 0 ? { rightDays, lastCountedDay: DAY - ago } : {}),
      },
    ]),
  );
  return s;
}

const read = (s: ProfileState, content: ContentData) =>
  projectView(
    { state: s, content: { data: content }, revision: 0, turn: 0 } as unknown as Read,
    index,
  );

const context = (
  s: ProfileState,
  content: ContentData,
  events: { type: string; data: unknown }[] = [],
) =>
  ({
    state: s,
    content: { data: content },
    emit: (type: string, payload: unknown) => events.push({ type, data: payload }),
  }) as unknown as Ctx;

describe('what the effort path grows and lights', () => {
  const dragon = data.dragons.find((d) => d.id === 'bubbles')!;

  it('grows a dragon whose facts were right on enough days, however slowly', () => {
    expect(earnedStage(child(1), data, dragon, index), 'one day each: hatchling').toBe('hatchling');
    expect(earnedStage(child(2), data, dragon, index), 'two days each: youngling').toBe(
      'youngling',
    );
    expect(earnedStage(child(2), plain, dragon, index), 'without the path').toBe('hatchling');
    // Adult needs the Bridge Troll won over as well; crowned needs gold, which effort never gives.
    const won = child(9);
    expect(earnedStage(won, data, dragon, index), 'silver, the troll not won').toBe('youngling');
    won.bosses = { 'bridge-troll': { defeatedDay: DAY - 1 } };
    expect(earnedStage(won, data, dragon, index), 'silver, the troll won: adult').toBe('adult');
  });

  it('lights the window, counts toward the next stage and in the grown-ups Progress', () => {
    const pane = (s: ProfileState, content: ContentData) =>
      read(s, content).window.cells.find((c) => c.item === 'mul:2x7')!.level;
    expect(pane(child(2), data), 'two days: a bronze pane').toBe('bronze');
    expect(pane(child(4), data), 'four days: a silver pane').toBe('silver');
    expect(pane(child(4), plain), 'without the path').toBe('dim');
    const counted = growthItems(dragon, dragon.skills, index, 'bronze');
    const next = read(child(2), data).dragons.find((d) => d.id === 'bubbles')!.next!;
    expect(next).toMatchObject({ stage: 'youngling', mastery: 'bronze', have: counted.length });
    expect(read(child(2), plain).dragons.find((d) => d.id === 'bubbles')!.next!.have).toBe(0);
    const twos = (content: ContentData) =>
      read(child(4), content).parent.tables.find((t) => t.table === 2)!;
    expect(twos(data).mastered, 'every ×2 fact at silver').toBe(twos(data).items);
    expect(twos(plain).mastered).toBe(0);
  });

  it('lights a pane on the day a counted answer brings it to bronze', () => {
    const lit = (content: ContentData) => {
      const events: { type: string; data: unknown }[] = [];
      creditItem(context(child(1), content, events), 'mul:2x7', 'slow');
      return events.filter((e) => e.type === 'pane.lit');
    };
    expect(lit(data)).toEqual([{ type: 'pane.lit', data: { item: 'mul:2x7', level: 'bronze' } }]);
    expect(lit(plain), 'without the path').toEqual([]);
  });

  it("does not count a commuted twin's review: its counts stay its own", () => {
    const s = child(1);
    creditItem(context(s, data), 'mul:2x7', 'ok');
    expect(s.items['mul:2x7']).toMatchObject({ rightDays: 2, lastCountedDay: DAY });
    expect(s.items['mul:7x2'], 'the twin was only rescheduled').toMatchObject({
      rightDays: 1,
      lastCountedDay: DAY - 2,
      lastDay: DAY,
    });
  });

  it('earns stickers for facts mastered on the effort path', () => {
    // Double Double: every ×4 fact at silver.
    const stickers = (content: ContentData) => {
      const s = child(4, ['mul-4']);
      awardStickers(context(s, content));
      return Object.keys(s.stickers);
    };
    expect(stickers(data)).toContain('double-double');
    expect(stickers(plain)).not.toContain('double-double');
  });
});

describe('the contract', () => {
  it('validates the effort block: bronze no later than silver, whole days of 1 or more', () => {
    const late: ContentData = JSON.parse(JSON.stringify(data));
    late.balance.mastery.effort = { bronzeDays: 5, silverDays: 4, gapDays: 2 };
    expect(validateContentData(data)).toEqual([]);
    expect(validateContentData(late).map((d) => d.path)).toContain('mastery.effort');
    const pack = loadPack();
    const parse = (effort: object) => {
      const balance = { ...data.balance, mastery: { ...data.balance.mastery, effort } };
      const json = JSON.stringify({ ...pack, data: { ...data, balance } });
      return parseContentJson(json, contentRegistration, 'pack').ok;
    };
    expect(parse(EFFORT), 'the shipped values parse').toBe(true);
    expect(parse({ ...EFFORT, gapDays: 0 }), 'a gap of 0 days').toBe(false);
    expect(parse({ bronzeDays: 2, silverDays: 4 }), 'all three numbers').toBe(false);
  });

  it('refuses a state whose counts cannot be: both fields or neither, at most one per right answer', () => {
    const validate = (s: ProfileState) =>
      dragonValleyAdapter.validate!({
        state: s,
        content: { data },
        jobs: [],
      } as unknown as Read);
    expect(validate(child(2)).ok, 'a consistent state').toBe(true);
    const broken: Partial<ItemState>[] = [
      { rightDays: 2, lastCountedDay: undefined },
      { rightDays: undefined, lastCountedDay: DAY - 2 },
      { rightDays: 3 },
      { rightDays: 0 },
      { lastCountedDay: DAY },
    ];
    for (const patch of broken) {
      const s = child(2);
      const item = { ...s.items['mul:2x7']!, ...patch };
      for (const key of ['rightDays', 'lastCountedDay'] as const) {
        if (key in patch && patch[key] === undefined) delete item[key];
      }
      s.items['mul:2x7'] = item;
      expect(validate(s).ok, JSON.stringify(patch)).toBe(false);
    }
  });
});
