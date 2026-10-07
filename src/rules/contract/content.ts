/**
 * The content pack: everything data-driven about the game, in one versioned JSON file
 * (`content/dragon-valley.content.json`), validated by `contentRegistration`.
 *
 * Adding levels, regions, skills, dragons, stickers or cosmetics is a JSON edit plus a new pack
 * `revision`. Only a new generator, activity kind or criterion kind needs code. A save pins the
 * exact pack (id, revision, hash) it was played with; shipped packs are archived under
 * `content/history/<revision>.json` and every one of them must stay valid under this schema, so
 * the schema only ever grows by adding union variants or optional fields (docs/contract.md).
 */
import { failure, schema, success, validateReferences } from '@aegis/runtime';
import type { ContentRegistration, DeepReadonly, RuntimeDiagnostic, Schema } from '@aegis/runtime';
import { tokenizeWords, validateNarrative } from '@aegis/narrative';
import type { NarrativeGraph } from '@aegis/narrative';
import { COSMETIC_SLOTS, DRAGON_STAGES } from './ids';
import type { CosmeticSlot, DragonStage } from './ids';
import { INPUT_MODES, LEVEL_ACTIVITY_KINDS, OPERATORS, STRANDS, isMinigameKind } from './kinds';
import type { InputMode, LevelActivityKind, Operator, Strand, WordFamily } from './kinds';
import { EGG_GRID_SPLITS } from './minigames';
import { MAX_PROBLEM_NUMBER } from './problems';
import {
  artId,
  catalogKey,
  contentId,
  hexColor,
  int,
  lazy,
  nullable,
  objectWithOptional,
  oneOf,
  percent,
  refine,
  uniqueArray,
} from './schema';
import { skillItems, skillSchema, wordFamilySchema } from './skills';
import type { Skill } from './skills';

/** The content pack ID. */
export const CONTENT_PACK_ID = 'dragon-valley';
/** Content data schema version. Frozen at 1: the schema evolves only compatibly (see above). */
export const CONTENT_SCHEMA_VERSION = 1;

const ids = uniqueArray(contentId, { max: 256 });

// ---------------------------------------------------------------------------------------------
// Records

/** A curriculum objective (docs/curriculum.md). Every objective maps to levels and a boss. */
export interface Objective {
  id: string;
  strand: Strand;
  titleKey: string;
}

/** Unlocked once every listed level is completed (at least one star, or placed out). */
export interface Unlock {
  after: string[];
}

export interface Region {
  id: string;
  /** 1-based map order. */
  order: number;
  titleKey: string;
  unlock: Unlock;
  boss: string | null;
  /** Art catalog ID of the region's background. */
  background: string;
}

/**
 * One activity of a level: its kind, the skills it draws from, how many problems or minigame
 * boards it has, the input mode, and kind-specific `options` (see `ACTIVITY_OPTION_SCHEMAS`).
 */
export interface Activity {
  kind: LevelActivityKind;
  skills: string[];
  count: number;
  input: InputMode;
  options: Record<string, number | boolean | string>;
}

/** Star thresholds: 1 star = completed; 2 and 3 need accuracy, 3 also fluency (fast share). */
export interface StarRule {
  twoStars: { accuracy: number };
  threeStars: { accuracy: number; fastShare: number };
}

export interface LevelRewards {
  /** Coins for first reaching 1, 2 and 3 stars (paid once per star level). */
  coins: [number, number, number];
  /** Dragon eggs given on first completion. */
  eggs: string[];
  /** Cosmetics given on first completion. */
  cosmetics: string[];
}

export interface Level {
  id: string;
  region: string;
  /** 1-based order inside the region; the boss level comes last. */
  order: number;
  titleKey: string;
  kind: 'lesson' | 'boss';
  unlock: Unlock;
  activities: Activity[];
  /** `null` uses `balance.stars`. */
  stars: StarRule | null;
  rewards: LevelRewards;
  /** The boss of a `boss` level; `null` for lessons. */
  boss: string | null;
  /** Story beat played before the level's first run, or `null`. */
  storyBeat: string | null;
  /** Curriculum objectives this level teaches or practises. */
  objectives: string[];
}

export type DragonKind = 'table' | 'special' | 'finale';

/**
 * A raisable dragon. Its mastery set is the union of its skills' items; growth to youngling also
 * needs `divisionSkills`, and to adult its `boss` defeated (balance.growth).
 */
export interface Dragon {
  id: string;
  kind: DragonKind;
  /** The times table of a table dragon, else `null`. */
  table: number | null;
  nameKey: string;
  /** The region whose levels give its egg. */
  region: string;
  /** Art catalog ID of the dragon's rig recipe. */
  rig: string;
  skills: string[];
  divisionSkills: string[];
  boss: string | null;
}

export type BossMood = 'sleepy' | 'laughing' | 'happy';

/** A friendly boss: fill its mood meter with correct answers. Nobody loses. */
export interface Boss {
  id: string;
  region: string;
  nameKey: string;
  mood: BossMood;
  /** Correct answers that fill the meter. Misses never lower it. */
  meter: number;
  /** Share of boss problems drawn as spaced review of earlier skills. */
  reviewShare: number;
  /**
   * Heads to win over one after another (default 1). A boss with several heads shares its meter
   * evenly between them and serves its boss activity's skills in order, one skill per head (the
   * Seven-Headed Dragon: one strand per head).
   */
  heads?: number;
  /** Winning over this boss completes the game (the finale). Default false. */
  finale?: boolean;
}

/** A cosmetic: the narrative `CosmeticItem` (`id`, `slot`, `assetId`) plus shop data. */
export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  assetId: string;
  nameKey: string;
  price: number;
  /** Shown in Glimmer's Market once this level is completed; `null` = from the start. */
  unlock: string | null;
}

export type StickerCriteria =
  | { kind: 'level-complete'; level: string; stars: number }
  | { kind: 'boss-defeated'; boss: string }
  | { kind: 'dragon-stage'; dragon: string | null; stage: DragonStage }
  | {
      kind: 'facts-mastered';
      family: 'mul' | 'div';
      level: 'bronze' | 'silver' | 'gold';
      count: number;
    }
  | { kind: 'streak'; count: number }
  | { kind: 'days-practiced'; count: number }
  | { kind: 'week-days'; count: number }
  | { kind: 'coins-earned'; count: number }
  | { kind: 'cosmetics-owned'; count: number }
  /** count owned dragons wearing at least one cosmetic (dressed by the child). */
  | { kind: 'dragons-dressed'; count: number }
  | { kind: 'arena-best'; count: number }
  | { kind: 'quests-claimed'; count: number }
  | { kind: 'placement-done' }
  | { kind: 'finale' }
  /** `share` percent of a skill's items at `level` or better (`seen`: answered right once). */
  | {
      kind: 'skill-mastered';
      skill: string;
      level: 'seen' | 'bronze' | 'silver' | 'gold';
      share: number;
    }
  /** `count` owned dragons of `kind` (any kind when `null`) at `stage` or later; `count: null`
   * means every dragon of that kind in the content. */
  | {
      kind: 'dragons-stage';
      dragonKind: DragonKind | null;
      stage: DragonStage;
      count: number | null;
    };

/**
 * A sticker for the album, composed by the art pipeline from `icon`, `color` and `frame`, so a new
 * sticker needs no new art. Pages are regions.
 */
export interface Sticker {
  id: string;
  nameKey: string;
  page: string;
  criteria: StickerCriteria;
  icon: string;
  color: string;
  frame: string;
}

export type QuestGoal =
  | 'correct-answers'
  | 'fast-answers'
  | 'feed-hungry'
  | 'play-minigame'
  | 'finish-level'
  | 'best-streak';

/** A daily quest template; three are drawn per day from the unlocked templates. */
export interface QuestTemplate {
  id: string;
  titleKey: string;
  goal: QuestGoal;
  target: number;
  coins: number;
  weight: number;
  /** Offered once this level is completed; `null` = from the start. */
  unlock: string | null;
}

/** A list of words for word problems. Entries are catalog keys: a `name` entry is one string; a
 * `thing` entry has `<key>.one` and `<key>.other` plural forms in the catalog. */
export interface WordList {
  id: string;
  kind: 'name' | 'thing';
  entries: string[];
}

/** An expression over template variables; `var` nodes name `WordTemplate.vars` entries. */
export type TemplateExpr =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'op'; op: Operator; left: TemplateExpr; right: TemplateExpr }
  | { kind: 'group'; inner: TemplateExpr };

/**
 * A template variable. `int` is a whole number drawn from `problems` in `min..max`. `word` is an
 * entry drawn from `words` out of a word list: a name's catalog key, or a thing's plural form
 * `<key>.other`. `calc` is computed from numeric vars. `form` is the thing drawn for the `word`
 * var in the form that agrees with the number in the `count` var: `<key>.one` exactly when it
 * is 1, else `<key>.other`, so both "1 apple" and "3 apples" read correctly.
 */
export type WordVar =
  | { kind: 'int'; min: number; max: number }
  | { kind: 'word'; list: string }
  | { kind: 'calc'; expr: TemplateExpr }
  | { kind: 'form'; word: string; count: string };

export type WordModel =
  | { kind: 'value'; expr: TemplateExpr }
  | { kind: 'divrem'; dividend: TemplateExpr; divisor: TemplateExpr };

/**
 * A word-problem template. `textKey` is a catalog string with `{placeholders}` naming `vars`;
 * `model` is the arithmetic the story asks for; `operation` is the operation the child picks
 * first (Riddle Scrolls), or `null`. Generators draw `int` vars from `problems` and `word` vars
 * from `words`, compute `calc` and `form` vars, and reject draws whose model is not a valid
 * problem. `words` (optional) is the story's length in words (`storyWordCount` of its catalog
 * text): with `balance.response.word` it gives the answer time to read the story (design §6.2).
 */
export interface WordTemplate {
  id: string;
  family: WordFamily;
  textKey: string;
  vars: Record<string, WordVar>;
  model: WordModel;
  operation: Operator | null;
  words?: number;
}

/**
 * The length of a story in words, as the child reads it: the words of its catalog text as the
 * child profile counts them (`tokenizeWords`), a `{placeholder}` (a name, a number, an object)
 * counting as one word, so that `{name}'s` stays one word.
 */
export function storyWordCount(text: string): number {
  return tokenizeWords(text.replace(/\{[A-Za-z][A-Za-z0-9_]*\}/g, 'x')).length;
}

/**
 * Reading time for word problems (design §6.2: time the arithmetic, not the reading). A story
 * answered whole (no operation step) is allowed `words × perWordMs + wholeStoryMs` on top of the
 * response limits; the number after an operation step `words × perWordMs × rereadPercent / 100`
 * (the story was read for the operation: the child only glances back).
 */
export interface WordTiming {
  perWordMs: number;
  wholeStoryMs: number;
  rereadPercent: number;
}

/** One rung of the placement check: a few problems of `skill`; passing marks `levels` placed. */
export interface PlacementStep {
  skill: string;
  problems: number;
  passAccuracy: number;
  levels: string[];
}

export interface Placement {
  steps: PlacementStep[];
  minProblems: number;
  maxProblems: number;
  /** Stop early (gently) after this many misses in a row. */
  stopAfterMisses: number;
}

export type BeatTrigger =
  | { kind: 'first-session' }
  | { kind: 'after-beat'; beat: string }
  | { kind: 'level-start'; level: string }
  | { kind: 'level-complete'; level: string }
  | { kind: 'boss-defeated'; boss: string }
  | { kind: 'finale' };

/**
 * A story beat: a small `@aegis/narrative` graph played when its trigger fires. Text references
 * in the graph are catalog keys. Reward claims in the graph map to game grants via
 * `story.rewards`.
 */
export interface StoryBeat {
  id: string;
  trigger: BeatTrigger;
  skippable: boolean;
  graph: NarrativeGraph;
}

export type Grant =
  | { kind: 'egg'; dragon: string }
  | { kind: 'coins'; amount: number }
  | { kind: 'cosmetic'; item: string };

export interface StoryReward {
  /** A narrative `reward` catalog ID claimed by a beat's effect. */
  reward: string;
  grant: Grant;
}

export interface GrowthRule {
  stage: Exclude<DragonStage, 'egg'>;
  /** Share of the dragon's mastery set at `mastery` or better. */
  share: number;
  /** `seen` = answered correctly at least once (box 1+). */
  mastery: 'seen' | 'bronze' | 'silver' | 'gold';
  /** Also require the same share of the dragon's division skills. */
  division: boolean;
  /** Also require the dragon's boss defeated. */
  boss: boolean;
}

/** Every tunable number. Percentages and durations are integers; nothing is a fraction. */
export interface Balance {
  leitner: {
    /** Days until an item in box 0..5 is due again. Correct fast/ok: up one box; slow: stay;
     * miss: back to box 1. */
    intervals: number[];
  };
  response: {
    choice: { fastMs: number; okMs: number };
    keypad: { fastMs: number; okMs: number; perExtraDigitMs: number };
    /** Reading time for word problems; without it (or a template's `words`) there is none. */
    word?: WordTiming;
  };
  input: { keypadFromBox: number; choices: number };
  mix: {
    /** Round success target and the share of likely-known items (due reviews, known facts). */
    successTarget: number;
    knownShare: number;
    minLearningShare: number;
    maxLearningShare: number;
    /** Rolling window of answers used to steer the mix. */
    window: number;
    /** An item is not served again within this many problems (re-asks excepted). */
    noRepeatWithin: number;
  };
  reask: { delay: number; maxPerRound: number };
  coins: {
    correct: number;
    streakEvery: number;
    streakBonus: number;
    bossDefeated: number;
    placementDone: number;
  };
  stars: StarRule;
  mastery: { goldBox: number; goldFast: number; goldOfLast: number };
  growth: GrowthRule[];
  daily: {
    goalAnswers: number;
    goalMin: number;
    goalMax: number;
    quests: number;
    historyDays: number;
  };
  gift: { coinsMin: number; coinsMax: number; cosmeticWeight: number; coinsWeight: number };
  arena: { unlockAfter: string; maxProblems: number };
  hungry: { minDue: number };
}

export interface ContentData {
  objectives: Objective[];
  regions: Region[];
  levels: Level[];
  skills: Skill[];
  dragons: Dragon[];
  bosses: Boss[];
  cosmetics: Cosmetic[];
  stickers: Sticker[];
  quests: QuestTemplate[];
  wordLists: WordList[];
  wordTemplates: WordTemplate[];
  placement: Placement;
  story: { beats: StoryBeat[]; rewards: StoryReward[] };
  balance: Balance;
}

// ---------------------------------------------------------------------------------------------
// Schemas

const unlockSchema: Schema<Unlock> = schema.object({ after: ids });
const starRuleSchema: Schema<StarRule> = schema.object({
  twoStars: schema.object({ accuracy: percent }),
  threeStars: schema.object({ accuracy: percent, fastShare: percent }),
});

/** Memory Match pairs: a fact and its value, a × and ÷ sentence of one family, or a term and an
 * example sentence. */
export const MEMORY_MATCH_MODES = ['value', 'family', 'term'] as const;
/** Feeding Time draws: the mix (default), or the child's weakest known facts first. */
export const FEEDING_DRAWS = ['mix', 'weakest'] as const;

/** Per-kind activity options: allowed keys and their schemas. Absent keys take the default. */
export const ACTIVITY_OPTION_SCHEMAS: Readonly<
  Record<LevelActivityKind, Readonly<Record<string, Schema<number | boolean | string>>>>
> = {
  feeding: { draw: oneOf(FEEDING_DRAWS) },
  'compare-stones': {},
  'riddle-scrolls': { pickOperation: schema.boolean },
  boss: {},
  'memory-match': { pairs: int(3, 8), match: oneOf(MEMORY_MATCH_MODES) },
  'number-trail': { length: int(5, 12), gaps: int(1, 6) },
  'egg-grid': { split: oneOf(EGG_GRID_SPLITS) },
  'fact-family': {},
  'sharing-feast': {},
  'golem-orders': {},
};
export const ACTIVITY_OPTION_DEFAULTS: Readonly<
  Record<LevelActivityKind, Readonly<Record<string, number | boolean | string>>>
> = {
  feeding: { draw: 'mix' },
  'compare-stones': {},
  'riddle-scrolls': { pickOperation: true },
  boss: {},
  'memory-match': { pairs: 6, match: 'value' },
  'number-trail': { length: 10, gaps: 3 },
  'egg-grid': { split: 'none' },
  'fact-family': {},
  'sharing-feast': {},
  'golem-orders': {},
};

const activitySchema: Schema<Activity> = schema.object({
  kind: oneOf(LEVEL_ACTIVITY_KINDS),
  skills: uniqueArray(contentId, { min: 1, max: 16 }),
  count: int(1, 30),
  input: oneOf(INPUT_MODES),
  options: schema.record(schema.union(int(0, 1000), schema.boolean, contentId)),
});

const levelSchema: Schema<Level> = schema.object({
  id: contentId,
  region: contentId,
  order: int(1, 50),
  titleKey: catalogKey,
  kind: oneOf(['lesson', 'boss'] as const),
  unlock: unlockSchema,
  activities: schema.array(activitySchema, { min: 1, max: 8 }),
  stars: nullable(starRuleSchema),
  rewards: schema.object({
    coins: schema.array(int(0, 1000), { min: 3, max: 3 }) as Schema<[number, number, number]>,
    eggs: uniqueArray(contentId, { max: 4 }),
    cosmetics: uniqueArray(contentId, { max: 4 }),
  }),
  boss: nullable(contentId),
  storyBeat: nullable(contentId),
  objectives: uniqueArray(contentId, { max: 16 }),
});

const stickerCriteriaSchema: Schema<StickerCriteria> = schema.union(
  schema.object({ kind: schema.literal('level-complete'), level: contentId, stars: int(1, 3) }),
  schema.object({ kind: schema.literal('boss-defeated'), boss: contentId }),
  schema.object({
    kind: schema.literal('dragon-stage'),
    dragon: nullable(contentId),
    stage: oneOf(DRAGON_STAGES),
  }),
  schema.object({
    kind: schema.literal('facts-mastered'),
    family: oneOf(['mul', 'div'] as const),
    level: oneOf(['bronze', 'silver', 'gold'] as const),
    count: int(1, 121),
  }),
  schema.object({ kind: schema.literal('streak'), count: int(1, 1000) }),
  schema.object({ kind: schema.literal('days-practiced'), count: int(1, 10_000) }),
  schema.object({ kind: schema.literal('week-days'), count: int(1, 7) }),
  schema.object({ kind: schema.literal('coins-earned'), count: int(1, 1_000_000) }),
  schema.object({ kind: schema.literal('cosmetics-owned'), count: int(1, 1000) }),
  schema.object({ kind: schema.literal('dragons-dressed'), count: int(1, 100) }),
  schema.object({ kind: schema.literal('arena-best'), count: int(1, 1000) }),
  schema.object({ kind: schema.literal('quests-claimed'), count: int(1, 10_000) }),
  schema.object({ kind: schema.literal('placement-done') }),
  schema.object({ kind: schema.literal('finale') }),
  schema.object({
    kind: schema.literal('skill-mastered'),
    skill: contentId,
    level: oneOf(['seen', 'bronze', 'silver', 'gold'] as const),
    share: int(1, 100),
  }),
  schema.object({
    kind: schema.literal('dragons-stage'),
    dragonKind: nullable(oneOf(['table', 'special', 'finale'] as const)),
    stage: oneOf(DRAGON_STAGES),
    count: nullable(int(1, 100)),
  }),
);

const templateExprSchema: Schema<TemplateExpr> = lazy(() =>
  schema.union(
    schema.object({ kind: schema.literal('num'), value: int(0, MAX_PROBLEM_NUMBER) }),
    schema.object({ kind: schema.literal('var'), name: contentId }),
    schema.object({
      kind: schema.literal('op'),
      op: oneOf(OPERATORS),
      left: templateExprSchema,
      right: templateExprSchema,
    }),
    schema.object({ kind: schema.literal('group'), inner: templateExprSchema }),
  ),
);

const wordTemplateSchema: Schema<WordTemplate> = objectWithOptional(
  {
    id: contentId,
    family: wordFamilySchema,
    textKey: catalogKey,
    vars: schema.record(
      schema.union(
        refine(
          schema.object({
            kind: schema.literal('int'),
            min: int(0, MAX_PROBLEM_NUMBER),
            max: int(0, MAX_PROBLEM_NUMBER),
          }),
          (v) => (v.min <= v.max ? null : 'min must not exceed max'),
        ),
        schema.object({ kind: schema.literal('word'), list: contentId }),
        schema.object({ kind: schema.literal('calc'), expr: templateExprSchema }),
        schema.object({ kind: schema.literal('form'), word: contentId, count: contentId }),
      ),
    ),
    model: schema.union(
      schema.object({ kind: schema.literal('value'), expr: templateExprSchema }),
      schema.object({
        kind: schema.literal('divrem'),
        dividend: templateExprSchema,
        divisor: templateExprSchema,
      }),
    ),
    operation: nullable(oneOf(OPERATORS)),
  },
  { words: int(1, 300) },
);

function narrativeGraphSchema(): Schema<NarrativeGraph> {
  return {
    parse(value: unknown, path = '') {
      try {
        const result = validateNarrative(value);
        if (result.ok && result.value) return success(result.value);
        const detail = result.diagnostics
          .slice(0, 3)
          .map((d) => `${d.code} at ${d.location?.path ?? '$'}: ${d.message}`)
          .join('; ');
        return failure('invalid-story', `Invalid story graph: ${detail}`, { path });
      } catch (error) {
        return failure('invalid-story', error instanceof Error ? error.message : String(error), {
          path,
        });
      }
    },
  };
}

const beatTriggerSchema: Schema<BeatTrigger> = schema.union(
  schema.object({ kind: schema.literal('first-session') }),
  schema.object({ kind: schema.literal('after-beat'), beat: contentId }),
  schema.object({ kind: schema.literal('level-start'), level: contentId }),
  schema.object({ kind: schema.literal('level-complete'), level: contentId }),
  schema.object({ kind: schema.literal('boss-defeated'), boss: contentId }),
  schema.object({ kind: schema.literal('finale') }),
);

const grantSchema: Schema<Grant> = schema.union(
  schema.object({ kind: schema.literal('egg'), dragon: contentId }),
  schema.object({ kind: schema.literal('coins'), amount: int(1, 10_000) }),
  schema.object({ kind: schema.literal('cosmetic'), item: contentId }),
);

const balanceSchema: Schema<Balance> = schema.object({
  leitner: schema.object({ intervals: schema.array(int(0, 365), { min: 6, max: 6 }) }),
  response: objectWithOptional(
    {
      choice: schema.object({ fastMs: int(500, 60_000), okMs: int(500, 120_000) }),
      keypad: schema.object({
        fastMs: int(500, 60_000),
        okMs: int(500, 120_000),
        perExtraDigitMs: int(0, 10_000),
      }),
    },
    {
      word: schema.object({
        perWordMs: int(0, 10_000),
        wholeStoryMs: int(0, 120_000),
        rereadPercent: percent,
      }),
    },
  ),
  input: schema.object({ keypadFromBox: int(0, 6), choices: int(2, 6) }),
  mix: schema.object({
    successTarget: percent,
    knownShare: percent,
    minLearningShare: percent,
    maxLearningShare: percent,
    window: int(1, 200),
    noRepeatWithin: int(0, 10),
  }),
  reask: schema.object({ delay: int(1, 20), maxPerRound: int(0, 10) }),
  coins: schema.object({
    correct: int(0, 100),
    streakEvery: int(1, 100),
    streakBonus: int(0, 100),
    bossDefeated: int(0, 1000),
    placementDone: int(0, 1000),
  }),
  stars: starRuleSchema,
  mastery: schema.object({ goldBox: int(0, 5), goldFast: int(0, 10), goldOfLast: int(1, 10) }),
  growth: schema.array(
    schema.object({
      stage: oneOf(['hatchling', 'youngling', 'adult', 'crowned'] as const),
      share: percent,
      mastery: oneOf(['seen', 'bronze', 'silver', 'gold'] as const),
      division: schema.boolean,
      boss: schema.boolean,
    }),
    { min: 4, max: 4 },
  ),
  daily: schema.object({
    goalAnswers: int(1, 1000),
    goalMin: int(1, 1000),
    goalMax: int(1, 1000),
    quests: int(0, 5),
    historyDays: int(7, 365),
  }),
  gift: schema.object({
    coinsMin: int(0, 1000),
    coinsMax: int(0, 1000),
    cosmeticWeight: int(0, 100),
    coinsWeight: int(0, 100),
  }),
  arena: schema.object({ unlockAfter: contentId, maxProblems: int(1, 200) }),
  hungry: schema.object({ minDue: int(1, 100) }),
});

export const contentDataSchema: Schema<ContentData> = objectWithOptional(
  {
    objectives: schema.array(
      schema.object({ id: contentId, strand: oneOf(STRANDS), titleKey: catalogKey }),
      { min: 1, max: 200 },
    ),
    regions: schema.array(
      schema.object({
        id: contentId,
        order: int(1, 100),
        titleKey: catalogKey,
        unlock: unlockSchema,
        boss: nullable(contentId),
        background: artId,
      }),
      { min: 1, max: 100 },
    ),
    levels: schema.array(levelSchema, { min: 1, max: 1000 }),
    skills: schema.array(skillSchema, { min: 1, max: 1000 }),
    dragons: schema.array(
      schema.object({
        id: contentId,
        kind: oneOf(['table', 'special', 'finale'] as const),
        table: nullable(int(0, 10)),
        nameKey: catalogKey,
        region: contentId,
        rig: artId,
        skills: uniqueArray(contentId, { min: 1, max: 32 }),
        divisionSkills: uniqueArray(contentId, { max: 32 }),
        boss: nullable(contentId),
      }),
      { min: 1, max: 100 },
    ),
    bosses: schema.array(
      objectWithOptional(
        {
          id: contentId,
          region: contentId,
          nameKey: catalogKey,
          mood: oneOf(['sleepy', 'laughing', 'happy'] as const),
          meter: int(3, 100),
          reviewShare: percent,
        },
        { heads: int(1, 10), finale: schema.boolean },
      ),
      { max: 100 },
    ),
    cosmetics: schema.array(
      schema.object({
        id: contentId,
        slot: oneOf(COSMETIC_SLOTS),
        assetId: artId,
        nameKey: catalogKey,
        price: int(0, 10_000),
        unlock: nullable(contentId),
      }),
      { max: 500 },
    ),
    stickers: schema.array(
      schema.object({
        id: contentId,
        nameKey: catalogKey,
        page: contentId,
        criteria: stickerCriteriaSchema,
        icon: artId,
        color: hexColor,
        frame: artId,
      }),
      { max: 500 },
    ),
    quests: schema.array(
      schema.object({
        id: contentId,
        titleKey: catalogKey,
        goal: oneOf([
          'correct-answers',
          'fast-answers',
          'feed-hungry',
          'play-minigame',
          'finish-level',
          'best-streak',
        ] as const),
        target: int(1, 1000),
        coins: int(0, 1000),
        weight: int(1, 100),
        unlock: nullable(contentId),
      }),
      { max: 200 },
    ),
    wordLists: schema.array(
      schema.object({
        id: contentId,
        kind: oneOf(['name', 'thing'] as const),
        entries: uniqueArray(catalogKey, { min: 1, max: 200 }),
      }),
      { max: 50 },
    ),
    wordTemplates: schema.array(wordTemplateSchema, { max: 500 }),
    placement: schema.object({
      steps: schema.array(
        schema.object({
          skill: contentId,
          problems: int(1, 10),
          passAccuracy: percent,
          levels: uniqueArray(contentId, { max: 64 }),
        }),
        { max: 50 },
      ),
      minProblems: int(0, 100),
      maxProblems: int(0, 100),
      stopAfterMisses: int(1, 20),
    }),
    story: schema.object({
      beats: schema.array(
        schema.object({
          id: contentId,
          trigger: beatTriggerSchema,
          skippable: schema.boolean,
          graph: lazy(narrativeGraphSchema),
        }),
        { max: 200 },
      ),
      rewards: schema.array(schema.object({ reward: contentId, grant: grantSchema }), { max: 500 }),
    }),
    balance: balanceSchema,
  },
  {},
);

// ---------------------------------------------------------------------------------------------
// Cross-reference validation

type Read<T> = DeepReadonly<T>;

/** Templates' word families by ID, for `skillItems`. */
export function wordFamilyLookup(data: Read<ContentData>): (template: string) => WordFamily | null {
  const families = new Map(data.wordTemplates.map((t) => [t.id, t.family]));
  return (template) => families.get(template) ?? null;
}

/** The item universe of every skill, by skill ID. */
export function skillItemIndex(data: Read<ContentData>): Map<string, string[]> {
  const familyOf = wordFamilyLookup(data);
  return new Map(data.skills.map((skill) => [skill.id, skillItems(skill as Skill, familyOf)]));
}

function templateVars(expr: Read<TemplateExpr>, into: string[] = []): string[] {
  if (expr.kind === 'var') into.push(expr.name);
  else if (expr.kind === 'op') {
    templateVars(expr.left, into);
    templateVars(expr.right, into);
  } else if (expr.kind === 'group') templateVars(expr.inner, into);
  return into;
}

/**
 * Every cross-reference and structural rule of a content pack. Returns diagnostics with record ID
 * and field path; an empty array means the pack is valid.
 */
export function validateContentData(data: Read<ContentData>): RuntimeDiagnostic[] {
  const file = 'dragon-valley.content.json';
  const out: RuntimeDiagnostic[] = [];
  const problem = (recordId: string, path: string, message: string, code = 'invalid-content') =>
    out.push({ code, message, file, recordId, path });
  /** Duplicate IDs within one collection. */
  const unique = (catalog: string, ids: readonly string[]) =>
    out.push(
      ...validateReferences(
        ids.map((id) => ({ id, references: [] })),
        [],
        `${file}#${catalog}`,
      ),
    );
  /** References of one field, checked against the IDs of the kind the field names. */
  const need = (
    catalog: string,
    recordId: string,
    field: string,
    references: readonly string[],
    available: ReadonlySet<string>,
    kind: string,
  ) =>
    references.forEach((reference, index) => {
      if (!available.has(reference)) {
        out.push({
          code: 'missing-reference',
          message: `Unknown ${kind} "${reference}".`,
          file: `${file}#${catalog}`,
          recordId,
          path: references.length === 1 ? field : `${field}[${index}]`,
        });
      }
    });
  const one = (value: string | null): string[] => (value === null ? [] : [value]);

  const objectives = new Set(data.objectives.map((o) => o.id));
  const regions = new Set(data.regions.map((r) => r.id));
  const levels = new Set(data.levels.map((l) => l.id));
  const skills = new Set(data.skills.map((s) => s.id));
  const dragons = new Set(data.dragons.map((d) => d.id));
  const bosses = new Set(data.bosses.map((b) => b.id));
  const cosmetics = new Set(data.cosmetics.map((c) => c.id));
  const beats = new Set(data.story.beats.map((b) => b.id));
  const lists = new Set(data.wordLists.map((w) => w.id));
  const templates = new Set(data.wordTemplates.map((t) => t.id));

  unique(
    'objectives',
    data.objectives.map((o) => o.id),
  );
  unique(
    'regions',
    data.regions.map((r) => r.id),
  );
  unique(
    'levels',
    data.levels.map((l) => l.id),
  );
  unique(
    'skills',
    data.skills.map((s) => s.id),
  );
  unique(
    'dragons',
    data.dragons.map((d) => d.id),
  );
  unique(
    'bosses',
    data.bosses.map((b) => b.id),
  );
  unique(
    'cosmetics',
    data.cosmetics.map((c) => c.id),
  );
  unique(
    'stickers',
    data.stickers.map((s) => s.id),
  );
  unique(
    'quests',
    data.quests.map((q) => q.id),
  );
  unique(
    'wordLists',
    data.wordLists.map((w) => w.id),
  );
  unique(
    'wordTemplates',
    data.wordTemplates.map((t) => t.id),
  );
  unique(
    'beats',
    data.story.beats.map((b) => b.id),
  );
  unique(
    'storyRewards',
    data.story.rewards.map((r) => r.reward),
  );

  for (const r of data.regions) {
    need('regions', r.id, 'unlock.after', r.unlock.after, levels, 'level');
    need('regions', r.id, 'boss', one(r.boss), bosses, 'boss');
  }
  for (const l of data.levels) {
    need('levels', l.id, 'region', [l.region], regions, 'region');
    need('levels', l.id, 'unlock.after', l.unlock.after, levels, 'level');
    need('levels', l.id, 'boss', one(l.boss), bosses, 'boss');
    need('levels', l.id, 'storyBeat', one(l.storyBeat), beats, 'story beat');
    need('levels', l.id, 'objectives', l.objectives, objectives, 'objective');
    l.activities.forEach((a, index) =>
      need('levels', l.id, `activities[${index}].skills`, a.skills, skills, 'skill'),
    );
    need('levels', l.id, 'rewards.eggs', l.rewards.eggs, dragons, 'dragon');
    need('levels', l.id, 'rewards.cosmetics', l.rewards.cosmetics, cosmetics, 'cosmetic');
  }
  for (const s of data.skills) {
    if (s.generator === 'word') {
      need('skills', s.id, 'params.templates', s.params.templates, templates, 'word template');
    }
  }
  for (const d of data.dragons) {
    need('dragons', d.id, 'region', [d.region], regions, 'region');
    need('dragons', d.id, 'skills', d.skills, skills, 'skill');
    need('dragons', d.id, 'divisionSkills', d.divisionSkills, skills, 'skill');
    need('dragons', d.id, 'boss', one(d.boss), bosses, 'boss');
  }
  for (const b of data.bosses) need('bosses', b.id, 'region', [b.region], regions, 'region');
  for (const c of data.cosmetics) need('cosmetics', c.id, 'unlock', one(c.unlock), levels, 'level');
  for (const s of data.stickers) {
    const c = s.criteria;
    need('stickers', s.id, 'page', [s.page], regions, 'region');
    if (c.kind === 'level-complete')
      need('stickers', s.id, 'criteria.level', [c.level], levels, 'level');
    if (c.kind === 'boss-defeated')
      need('stickers', s.id, 'criteria.boss', [c.boss], bosses, 'boss');
    if (c.kind === 'dragon-stage') {
      need('stickers', s.id, 'criteria.dragon', one(c.dragon), dragons, 'dragon');
    }
    if (c.kind === 'skill-mastered') {
      need('stickers', s.id, 'criteria.skill', [c.skill], skills, 'skill');
    }
  }
  for (const q of data.quests) need('quests', q.id, 'unlock', one(q.unlock), levels, 'level');
  for (const t of data.wordTemplates) {
    for (const [name, v] of Object.entries(t.vars)) {
      if (v.kind === 'word')
        need('wordTemplates', t.id, `vars.${name}.list`, [v.list], lists, 'word list');
    }
  }
  data.placement.steps.forEach((step, index) => {
    need('placement', `step-${index}`, 'skill', [step.skill], skills, 'skill');
    need('placement', `step-${index}`, 'levels', step.levels, levels, 'level');
  });
  for (const b of data.story.beats) {
    const t = b.trigger;
    if (t.kind === 'after-beat') need('beats', b.id, 'trigger.beat', [t.beat], beats, 'story beat');
    if (t.kind === 'level-start' || t.kind === 'level-complete') {
      need('beats', b.id, 'trigger.level', [t.level], levels, 'level');
    }
    if (t.kind === 'boss-defeated') need('beats', b.id, 'trigger.boss', [t.boss], bosses, 'boss');
  }
  for (const r of data.story.rewards) {
    if (r.grant.kind === 'egg')
      need('storyRewards', r.reward, 'grant.dragon', [r.grant.dragon], dragons, 'dragon');
    if (r.grant.kind === 'cosmetic') {
      need('storyRewards', r.reward, 'grant.item', [r.grant.item], cosmetics, 'cosmetic');
    }
  }
  need(
    'balance',
    'balance',
    'arena.unlockAfter',
    [data.balance.arena.unlockAfter],
    levels,
    'level',
  );
  // Skills produce at least one item; word templates are internally consistent.
  for (const [id, items] of skillItemIndex(data)) {
    if (items.length === 0)
      problem(id, 'params', 'The skill can never produce a problem.', 'empty-skill');
  }
  const listKinds = new Map(data.wordLists.map((w) => [w.id, w.kind]));
  for (const template of data.wordTemplates) {
    const vars = template.vars;
    const numeric = (name: string) => vars[name]?.kind === 'int' || vars[name]?.kind === 'calc';
    const used = [
      ...Object.values(vars).flatMap((v) => (v.kind === 'calc' ? templateVars(v.expr) : [])),
      ...(template.model.kind === 'value'
        ? templateVars(template.model.expr)
        : [...templateVars(template.model.dividend), ...templateVars(template.model.divisor)]),
    ];
    for (const name of used) {
      if (vars[name] === undefined) problem(template.id, 'model', `Undefined variable "${name}".`);
      else if (!numeric(name)) problem(template.id, 'model', `Variable "${name}" is not a number.`);
    }
    for (const [name, v] of Object.entries(vars)) {
      if (v.kind !== 'form') continue;
      const word = vars[v.word];
      if (word?.kind !== 'word' || listKinds.get(word.list) !== 'thing') {
        problem(template.id, `vars.${name}.word`, 'A form var names a word var over a thing list.');
      }
      if (!numeric(v.count)) {
        problem(template.id, `vars.${name}.count`, 'A form var agrees with an int or calc var.');
      }
    }
    // Calculated vars are computed in dependency order, so they must not depend on each other in
    // a cycle (undefined names are reported above and do not block).
    const resolved = new Set(Object.keys(vars).filter((name) => vars[name]?.kind !== 'calc'));
    for (let progress = true; progress;) {
      progress = false;
      for (const [name, v] of Object.entries(vars)) {
        const ready =
          v.kind === 'calc' &&
          !resolved.has(name) &&
          templateVars(v.expr).every((n) => resolved.has(n) || vars[n] === undefined);
        if (ready) {
          resolved.add(name);
          progress = true;
        }
      }
    }
    for (const name of Object.keys(vars)) {
      if (!resolved.has(name)) {
        problem(
          template.id,
          `vars.${name}`,
          'Calculated variables depend on each other in a cycle.',
        );
      }
    }
    if (template.model.kind === 'divrem' && template.family !== 'leftover') {
      problem(template.id, 'family', 'Only leftover templates may use a divrem model.');
    }
  }

  // Activities: options match their kind; minigame and problem kinds use suitable inputs.
  for (const level of data.levels) {
    level.activities.forEach((activity, index) => {
      const allowed = ACTIVITY_OPTION_SCHEMAS[activity.kind];
      for (const [key, value] of Object.entries(activity.options)) {
        const option = allowed[key];
        if (!option) {
          problem(
            level.id,
            `activities[${index}].options.${key}`,
            `Unknown option for ${activity.kind}.`,
          );
        } else if (!option.parse(value).ok) {
          problem(level.id, `activities[${index}].options.${key}`, 'Option value out of range.');
        }
      }
      if (isMinigameKind(activity.kind) && activity.input !== 'auto') {
        problem(level.id, `activities[${index}].input`, 'Minigames take input "auto".');
      }
      if (activity.kind === 'compare-stones' && activity.input === 'keypad') {
        problem(level.id, `activities[${index}].input`, 'Compare Stones is answered by choice.');
      }
      const last = index === level.activities.length - 1;
      if (activity.kind === 'boss' && !(level.kind === 'boss' && last)) {
        problem(
          level.id,
          `activities[${index}].kind`,
          'Only the last activity of a boss level is a boss activity.',
        );
      }
      if (level.kind === 'boss' && last && activity.kind !== 'boss') {
        problem(level.id, `activities[${index}].kind`, 'A boss level ends with its boss activity.');
      }
    });
    if ((level.kind === 'boss') !== (level.boss !== null)) {
      problem(level.id, 'boss', 'Boss levels name a boss; lessons do not.');
    }
    if (level.rewards.coins.some((c, i) => i > 0 && c < level.rewards.coins[i - 1]!)) {
      problem(level.id, 'rewards.coins', 'Star coins must not decrease with more stars.');
    }
  }

  // Regions: unique map order; every level's region has unique per-region order.
  const regionOrders = data.regions.map((r) => r.order);
  if (new Set(regionOrders).size !== regionOrders.length) {
    problem('regions', 'order', 'Region map order must be unique.');
  }
  const orderKeys = data.levels.map((l) => `${l.region}#${l.order}`);
  orderKeys.forEach((key, index) => {
    if (orderKeys.indexOf(key) !== index) {
      problem(data.levels[index]!.id, 'order', 'Level order must be unique within its region.');
    }
  });
  for (const region of data.regions) {
    const bossLevels = data.levels.filter((l) => l.region === region.id && l.kind === 'boss');
    if (region.boss !== null && !bossLevels.some((l) => l.boss === region.boss)) {
      problem(region.id, 'boss', 'The region boss needs a boss level in the region.');
    }
  }

  // Multi-head bosses share the meter evenly and need a skill per head; one finale at most.
  for (const boss of data.bosses) {
    const heads = boss.heads ?? 1;
    if (boss.meter % heads !== 0) {
      problem(boss.id, 'heads', 'The meter must share evenly between the heads.');
    }
    for (const level of data.levels.filter((l) => l.boss === boss.id)) {
      const last = level.activities[level.activities.length - 1];
      if (last && last.kind === 'boss' && last.skills.length < heads) {
        problem(level.id, 'activities', 'A boss with several heads needs a skill per head.');
      }
    }
  }
  if (data.bosses.filter((b) => b.finale === true).length > 1) {
    problem('bosses', 'finale', 'Only one boss can be the finale.');
  }

  // Unlock graph: acyclic and every level reachable from the start.
  const levelById = new Map(data.levels.map((l) => [l.id, l]));
  const regionById = new Map(data.regions.map((r) => [r.id, r]));
  const requires = (levelId: string): string[] => {
    const level = levelById.get(levelId);
    if (!level) return [];
    return [...level.unlock.after, ...(regionById.get(level.region)?.unlock.after ?? [])];
  };
  const reached = new Set<string>();
  let progress = true;
  while (progress) {
    progress = false;
    for (const level of data.levels) {
      if (!reached.has(level.id) && requires(level.id).every((id) => reached.has(id))) {
        reached.add(level.id);
        progress = true;
      }
    }
  }
  for (const level of data.levels) {
    if (!reached.has(level.id)) {
      problem(
        level.id,
        'unlock.after',
        'Unreachable: its unlock requirements form a cycle or depend on an unreachable level.',
        'unreachable',
      );
    }
  }
  if (!data.levels.some((l) => requires(l.id).length === 0)) {
    problem('levels', 'unlock', 'No level is available at the start.', 'unreachable');
  }

  // Dragons and growth.
  for (const dragon of data.dragons) {
    if ((dragon.kind === 'table') !== (dragon.table !== null)) {
      problem(dragon.id, 'table', 'Table dragons have a table; other dragons do not.');
    }
  }
  const growthStages = data.balance.growth.map((g) => g.stage).join(',');
  if (growthStages !== 'hatchling,youngling,adult,crowned') {
    problem(
      'balance',
      'growth',
      'Growth rules list hatchling, youngling, adult, crowned in order.',
    );
  }
  const intervals = data.balance.leitner.intervals;
  if (intervals.some((value, i) => i > 0 && value < intervals[i - 1]!)) {
    problem('balance', 'leitner.intervals', 'Leitner intervals must not decrease.');
  }
  const { daily, gift, mix, response } = data.balance;
  if (!(daily.goalMin <= daily.goalAnswers && daily.goalAnswers <= daily.goalMax)) {
    problem('balance', 'daily', 'goalMin <= goalAnswers <= goalMax.');
  }
  if (gift.coinsMin > gift.coinsMax)
    problem('balance', 'gift', 'coinsMin must not exceed coinsMax.');
  if (mix.minLearningShare > mix.maxLearningShare) {
    problem('balance', 'mix', 'minLearningShare must not exceed maxLearningShare.');
  }
  if (
    response.choice.fastMs > response.choice.okMs ||
    response.keypad.fastMs > response.keypad.okMs
  ) {
    problem('balance', 'response', 'fastMs must not exceed okMs.');
  }
  if (data.placement.minProblems > data.placement.maxProblems) {
    problem('placement', 'minProblems', 'minProblems must not exceed maxProblems.');
  }

  // Story: beat graphs are unique by graph ID; first-session beat exists at most once.
  const graphIds = data.story.beats.map((b) => b.graph.id);
  if (new Set(graphIds).size !== graphIds.length) {
    problem('story', 'beats', 'Each beat needs its own graph ID.');
  }
  const rewardIds = new Set(data.story.beats.flatMap((b) => b.graph.catalogs.reward));
  for (const reward of data.story.rewards) {
    if (!rewardIds.has(reward.reward)) {
      problem(reward.reward, 'reward', 'No beat claims this reward.', 'missing-reference');
    }
  }
  return out;
}

/** The registration passed to the runtime host and to `parseContentJson`. */
export const contentRegistration: ContentRegistration<ContentData> = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  schema: contentDataSchema,
  validate: validateContentData,
};

// ---------------------------------------------------------------------------------------------
// Cross-file references (catalog strings and art), checked by scripts/validate-content.mjs

/** Every catalog key a pack refers to, with where it is used. */
export function collectCatalogKeys(data: Read<ContentData>): { key: string; where: string }[] {
  const keys: { key: string; where: string }[] = [];
  const add = (key: string, where: string) => keys.push({ key, where });
  data.objectives.forEach((o) => add(o.titleKey, `objective ${o.id}`));
  data.regions.forEach((r) => add(r.titleKey, `region ${r.id}`));
  data.levels.forEach((l) => add(l.titleKey, `level ${l.id}`));
  data.skills.forEach((s) => add(s.titleKey, `skill ${s.id}`));
  data.dragons.forEach((d) => add(d.nameKey, `dragon ${d.id}`));
  data.bosses.forEach((b) => add(b.nameKey, `boss ${b.id}`));
  data.cosmetics.forEach((c) => add(c.nameKey, `cosmetic ${c.id}`));
  data.stickers.forEach((s) => add(s.nameKey, `sticker ${s.id}`));
  data.quests.forEach((q) => add(q.titleKey, `quest ${q.id}`));
  data.wordLists.forEach((w) =>
    w.entries.forEach((e) => {
      if (w.kind === 'name') add(e, `word list ${w.id}`);
      else {
        add(`${e}.one`, `word list ${w.id}`);
        add(`${e}.other`, `word list ${w.id}`);
      }
    }),
  );
  data.wordTemplates.forEach((t) => add(t.textKey, `word template ${t.id}`));
  for (const beat of data.story.beats) {
    for (const text of beat.graph.catalogs.text) add(text, `story beat ${beat.id}`);
  }
  return keys;
}

/**
 * Every art catalog ID a pack refers to: backgrounds, rigs, cosmetics, sticker parts, and the
 * scenes of story beats (scene IDs are background IDs: `castle-hall`, `valley-map`, a region ID).
 */
export function collectArtIds(data: Read<ContentData>): { id: string; where: string }[] {
  const art: { id: string; where: string }[] = [];
  data.regions.forEach((r) => art.push({ id: r.background, where: `region ${r.id} background` }));
  data.dragons.forEach((d) => art.push({ id: d.rig, where: `dragon ${d.id} rig` }));
  data.cosmetics.forEach((c) => art.push({ id: c.assetId, where: `cosmetic ${c.id}` }));
  for (const s of data.stickers) {
    art.push({ id: s.icon, where: `sticker ${s.id} icon` });
    art.push({ id: s.frame, where: `sticker ${s.id} frame` });
  }
  for (const beat of data.story.beats) {
    for (const scene of beat.graph.catalogs.scene) {
      art.push({ id: scene, where: `story beat ${beat.id} scene` });
    }
  }
  return art;
}

/** Diagnostics for art references missing from the published art catalog. */
export function checkArtCatalog(
  data: Read<ContentData>,
  catalogIds: readonly string[],
): RuntimeDiagnostic[] {
  const known = new Set(catalogIds);
  return collectArtIds(data)
    .filter(({ id }) => !known.has(id))
    .map(({ id, where }) => ({
      code: 'missing-art',
      message: `Art ID "${id}" (${where}) is not in assets/art/catalog.json.`,
      file: 'dragon-valley.content.json',
      recordId: id,
    }));
}

/**
 * Diagnostics for word templates whose `words` count is not the length of their story in
 * `catalog` (`storyWordCount`): the reading time follows the words the child reads.
 */
export function checkStoryWords(
  data: Read<ContentData>,
  catalog: Readonly<Record<string, string>>,
): RuntimeDiagnostic[] {
  return data.wordTemplates.flatMap((template) => {
    const text = catalog[template.textKey];
    if (template.words === undefined || text === undefined) return [];
    const count = storyWordCount(text);
    if (template.words === count) return [];
    return [
      {
        code: 'story-words',
        message: `Word template "${template.id}" says ${template.words} words, but "${template.textKey}" has ${count}.`,
        file: 'dragon-valley.content.json',
        recordId: template.id,
      },
    ];
  });
}

/**
 * Curriculum coverage: objectives with no level or no boss level. A complete v1 pack has none;
 * the content-v1 work turns this from a report into a gate.
 */
export function curriculumGaps(
  data: Read<ContentData>,
): { objective: string; missing: ('level' | 'boss')[] }[] {
  return data.objectives
    .map((objective) => {
      const levels = data.levels.filter((l) => l.objectives.includes(objective.id));
      const missing: ('level' | 'boss')[] = [];
      if (!levels.some((l) => l.kind === 'lesson')) missing.push('level');
      if (!levels.some((l) => l.kind === 'boss')) missing.push('boss');
      return { objective: objective.id, missing };
    })
    .filter((gap) => gap.missing.length > 0);
}
