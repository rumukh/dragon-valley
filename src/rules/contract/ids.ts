/**
 * Canonical identifiers shared by rules, content, art (S4), audio (S5) and the shell (S3).
 *
 * Two kinds of lists live here:
 *
 * - **Closed vocabularies** whose meaning is implemented in code: dragon growth stages, dragon
 *   expressions, cosmetic slots (rig anchors), mastery levels and keeper avatars. Adding a value
 *   is a code change and a contract change.
 * - **Canonical v1 content IDs**: the regions, dragons and bosses that version 1 ships. Content
 *   is open: a later content revision may add regions, dragons or bosses with new IDs, so schemas
 *   accept any well-formed ID and these lists are used to check the v1 pack and to key art/audio.
 *
 * IDs are stable forever once shipped: saves, art catalogs and audio manifests refer to them.
 * Never rename or reuse one; retire it with a content migration instead (docs/contract.md).
 */

/** Lower-case kebab words joined by `.`, `:` or `-`; at most 64 characters. */
export const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:[-.:][a-z0-9]+)*$/;
export const CONTENT_ID_MAX_LENGTH = 64;

export function isContentId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= CONTENT_ID_MAX_LENGTH &&
    CONTENT_ID_PATTERN.test(value)
  );
}

/** The nine v1 regions, in map order. */
export const CANONICAL_REGION_IDS = [
  'sunny-meadow',
  'whispering-woods',
  'fire-mountain',
  'crystal-caves',
  'sharing-lake',
  'leftover-lagoon',
  'giants-peaks',
  'riddle-ruins',
  'dragon-castle',
] as const;
export type CanonicalRegionId = (typeof CANONICAL_REGION_IDS)[number];

/** Table dragons, indexed by their times table: `TABLE_DRAGON_IDS[7] === 'rainbow'`. */
export const TABLE_DRAGON_IDS = [
  'puff',
  'mirror',
  'bubbles',
  'clover',
  'petal',
  'sunny',
  'ember',
  'rainbow',
  'crystal',
  'starry',
  'goldie',
] as const;
export type TableDragonId = (typeof TABLE_DRAGON_IDS)[number];

/** Dragons that hatch from later regions' skills rather than a single times table. */
export const SPECIAL_DRAGON_IDS = ['pearl', 'boulder', 'clockwork'] as const;
export type SpecialDragonId = (typeof SPECIAL_DRAGON_IDS)[number];

/** The finale dragon. It is also a boss ID; dragon and boss IDs are separate namespaces. */
export const FINALE_DRAGON_ID = 'seven-headed';

/** Every raisable v1 dragon. */
export const CANONICAL_DRAGON_IDS = [
  ...TABLE_DRAGON_IDS,
  ...SPECIAL_DRAGON_IDS,
  FINALE_DRAGON_ID,
] as const;
export type CanonicalDragonId = (typeof CANONICAL_DRAGON_IDS)[number];

/** Old Glimmer, the castle dragon and guide. A character, not a raisable dragon. */
export const GUIDE_ID = 'glimmer';

/** The nine v1 bosses, in region order. */
export const CANONICAL_BOSS_IDS = [
  'bridge-troll',
  'forest-witch',
  'krakonos',
  'gnome-king',
  'water-goblin',
  'lake-nymphs',
  'friendly-giant',
  'golem',
  'seven-headed',
] as const;
export type CanonicalBossId = (typeof CANONICAL_BOSS_IDS)[number];

/** Dragon growth stages, in order. Dragons never shrink: a stage index only increases. */
export const DRAGON_STAGES = ['egg', 'hatchling', 'youngling', 'adult', 'crowned'] as const;
export type DragonStage = (typeof DRAGON_STAGES)[number];

/** Expression hints the rules project for the art rig. Presentation only; never authoritative. */
export const DRAGON_EXPRESSIONS = [
  'idle',
  'happy',
  'curious',
  'eating',
  'sleepy',
  'proud',
] as const;
export type DragonExpression = (typeof DRAGON_EXPRESSIONS)[number];

/** Cosmetic slots, one per dragon-rig anchor. */
export const COSMETIC_SLOTS = ['head', 'neck', 'eyes', 'wings', 'nest'] as const;
export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];

/** Keeper (player) avatars offered when a child profile is created. */
export const KEEPER_AVATARS = [
  'keeper-1',
  'keeper-2',
  'keeper-3',
  'keeper-4',
  'keeper-5',
  'keeper-6',
  'keeper-7',
  'keeper-8',
] as const;
export type KeeperAvatar = (typeof KEEPER_AVATARS)[number];

/** Per-fact mastery shown by the Magic Window and used for dragon growth. */
export const MASTERY_LEVELS = ['dim', 'bronze', 'silver', 'gold'] as const;
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

/** Smallest and largest factor of the small multiplication table (the window is 11 x 11). */
export const TABLE_MIN = 0;
export const TABLE_MAX = 10;
