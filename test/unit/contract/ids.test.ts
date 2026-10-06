/**
 * Canonical IDs are the keys art (S4), audio (S5) and saves use. Expected values are written out
 * from the approved plan (docs/plan.md §2.2–2.3) and the coordinator's ID list, not derived from
 * the module under test.
 */
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_BOSS_IDS,
  CANONICAL_DRAGON_IDS,
  CANONICAL_REGION_IDS,
  COSMETIC_SLOTS,
  DRAGON_EXPRESSIONS,
  DRAGON_STAGES,
  FINALE_DRAGON_ID,
  GUIDE_ID,
  KEEPER_AVATARS,
  MASTERY_LEVELS,
  TABLE_DRAGON_IDS,
  isContentId,
} from '../../../src/rules/contract/ids';

describe('canonical IDs', () => {
  it('maps every times table 0-10 to its mnemonic dragon', () => {
    const byTable: Record<number, string> = {
      0: 'puff',
      1: 'mirror',
      2: 'bubbles',
      3: 'clover',
      4: 'petal',
      5: 'sunny',
      6: 'ember',
      7: 'rainbow',
      8: 'crystal',
      9: 'starry',
      10: 'goldie',
    };
    expect(Object.fromEntries(TABLE_DRAGON_IDS.map((id, table) => [table, id]))).toEqual(byTable);
  });

  it('lists the nine regions and nine bosses in map order', () => {
    expect([...CANONICAL_REGION_IDS]).toEqual([
      'sunny-meadow',
      'whispering-woods',
      'fire-mountain',
      'crystal-caves',
      'sharing-lake',
      'leftover-lagoon',
      'giants-peaks',
      'riddle-ruins',
      'dragon-castle',
    ]);
    expect([...CANONICAL_BOSS_IDS]).toEqual([
      'bridge-troll',
      'forest-witch',
      'krakonos',
      'gnome-king',
      'water-goblin',
      'lake-nymphs',
      'friendly-giant',
      'golem',
      'seven-headed',
    ]);
  });

  it('orders growth stages from egg to crowned', () => {
    expect([...DRAGON_STAGES]).toEqual(['egg', 'hatchling', 'youngling', 'adult', 'crowned']);
  });

  it('keeps every vocabulary unique and well formed', () => {
    const vocabularies: Record<string, readonly string[]> = {
      dragons: CANONICAL_DRAGON_IDS,
      regions: CANONICAL_REGION_IDS,
      bosses: CANONICAL_BOSS_IDS,
      stages: DRAGON_STAGES,
      expressions: DRAGON_EXPRESSIONS,
      slots: COSMETIC_SLOTS,
      avatars: KEEPER_AVATARS,
      mastery: MASTERY_LEVELS,
    };
    for (const [name, ids] of Object.entries(vocabularies)) {
      expect(new Set(ids).size, `${name} are unique`).toBe(ids.length);
      expect(
        ids.filter((id) => !isContentId(id)),
        `${name} match CONTENT_ID_PATTERN`,
      ).toEqual([]);
    }
    expect(CANONICAL_DRAGON_IDS).toHaveLength(15);
    expect(CANONICAL_DRAGON_IDS).toContain(FINALE_DRAGON_ID);
    expect(CANONICAL_DRAGON_IDS).not.toContain(GUIDE_ID);
  });

  it('rejects malformed IDs', () => {
    for (const bad of [
      '',
      'Sunny',
      'sunny meadow',
      'sunny_meadow',
      '-sunny',
      'sunny-',
      'a'.repeat(65),
    ]) {
      expect(isContentId(bad), JSON.stringify(bad)).toBe(false);
    }
    for (const good of ['sunny-meadow', 'sunny-meadow.1', 'mul:7x8', 'div:56:7', 'rem:d7']) {
      expect(isContentId(good), good).toBe(true);
    }
  });
});
