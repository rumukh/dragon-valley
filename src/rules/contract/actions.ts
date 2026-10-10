/**
 * Actions: the only way the shell changes the game. Every action is validated by
 * `gameActionSchema` and then by the rules' legality checks (`resolve`). Time enters only here:
 * the local date in `startSession.day` and the measured response time in `answer.elapsedMs`.
 *
 * Logical turns: an answer costs exactly one turn (re-ask jobs are scheduled in turns, so "about
 * three problems later" is three turns); every other action costs none. The shell dispatches
 * with `{ expectedRevision }` captured when the control was rendered, so a stale button can
 * never act on a newer view.
 */
import { schema } from '@aegis/runtime';
import type { JsonValue, Schema } from '@aegis/runtime';
import { COSMETIC_SLOTS } from './ids';
import type { CosmeticSlot } from './ids';
import type { Grade } from './kinds';
import { answerValueSchema } from './problems';
import type { AnswerValue } from './problems';
import {
  contentId,
  gradeSchema,
  int,
  nullable,
  objectWithOptional,
  oneOf,
  uniqueArray,
} from './schema';

/** Longest response time recorded; anything slower is simply `slow`. */
export const MAX_ELAPSED_MS = 600_000;

export type ActivityRequest =
  /** The activity at `index` of the active level run (the next one, or a completed one to replay). */
  | { kind: 'level'; index: number }
  /** Lightning Arena: a timed fluency race; the shell ends it with `endRound{ reason: 'time-up' }`. */
  | { kind: 'arena' }
  /** Snack time: feed hungry dragons (due reviews), one dragon or all (`null`). */
  | { kind: 'snack'; dragon: string | null }
  /** The placement check ("Show the dragons what you know!"). */
  | { kind: 'placement' };

export type SettingChange =
  | { key: 'dailyGoal'; value: number }
  | { key: 'arena'; value: boolean }
  | { key: 'unlockAhead'; value: string[] }
  /** The child's school grade (1-3): moves the start region and the suggestions only. */
  | { key: 'grade'; value: Grade };

export type GameAction =
  /** Start (or resume) a play session on the child's local date `YYYY-MM-DD`. */
  | { type: 'startSession'; day: string }
  /**
   * Enter a level and start its first activity. With `activity` (a completed level only), replay
   * just that activity: the Daily Adventure's minigame step. A replay never completes the level
   * again.
   */
  | { type: 'startLevel'; level: string; activity?: number }
  | { type: 'startActivity'; activity: ActivityRequest }
  /** Answer the current problem. `elapsedMs` excludes paused time. */
  | { type: 'answer'; value: AnswerValue; elapsedMs: number }
  /** A move in the current minigame board, tagged with the board revision it was made against. */
  | { type: 'minigameMove'; revision: number; move: JsonValue }
  /** Ask for a hint on the current problem (shows the visual model; never costs anything). */
  | { type: 'hint' }
  /** Leave the round: close a finished round, quit early (progress kept), or end on time. */
  | { type: 'endRound'; reason: 'done' | 'quit' | 'time-up' | 'time-limit' }
  /** Answer a placement-check problem. */
  | { type: 'placementAnswer'; value: AnswerValue; elapsedMs: number }
  | { type: 'buy'; item: string }
  /** Dress a dragon: put `item` in `slot`, or empty the slot with `item: null`. */
  | { type: 'equip'; dragon: string; slot: CosmeticSlot; item: string | null }
  | { type: 'claimQuest'; quest: string }
  | { type: 'openGift' }
  /** Choose in the pending story beat; `choice: null` skips a skippable beat. */
  | { type: 'storyChoice'; beat: string; node: string; revision: number; choice: string | null }
  /** A parent setting that affects rules. Presentation settings are preferences, not actions. */
  | { type: 'setSetting'; setting: SettingChange };

export type GameActionType = GameAction['type'];

/** Logical turns per action. Only answers advance the turn clock. */
export const ACTION_TURNS: Readonly<Record<GameActionType, 0 | 1>> = {
  startSession: 0,
  startLevel: 0,
  startActivity: 0,
  answer: 1,
  minigameMove: 0,
  hint: 0,
  endRound: 0,
  placementAnswer: 1,
  buy: 0,
  equip: 0,
  claimQuest: 0,
  openGift: 0,
  storyChoice: 0,
  setSetting: 0,
};

const elapsedMs = int(0, MAX_ELAPSED_MS);

const activityRequestSchema: Schema<ActivityRequest> = schema.union(
  schema.object({ kind: schema.literal('level'), index: int(0, 7) }),
  schema.object({ kind: schema.literal('arena') }),
  schema.object({ kind: schema.literal('snack'), dragon: nullable(contentId) }),
  schema.object({ kind: schema.literal('placement') }),
);

const settingSchema: Schema<SettingChange> = schema.union(
  schema.object({ key: schema.literal('dailyGoal'), value: int(1, 1000) }),
  schema.object({ key: schema.literal('arena'), value: schema.boolean }),
  schema.object({
    key: schema.literal('unlockAhead'),
    value: uniqueArray(contentId, { max: 100 }),
  }),
  schema.object({ key: schema.literal('grade'), value: gradeSchema }),
);

export const gameActionSchema: Schema<GameAction> = schema.union(
  schema.object({
    type: schema.literal('startSession'),
    day: schema.string({ minLength: 10, maxLength: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ }),
  }),
  objectWithOptional(
    { type: schema.literal('startLevel'), level: contentId },
    { activity: int(0, 7) },
  ),
  schema.object({ type: schema.literal('startActivity'), activity: activityRequestSchema }),
  schema.object({ type: schema.literal('answer'), value: answerValueSchema, elapsedMs }),
  schema.object({
    type: schema.literal('minigameMove'),
    revision: int(0, 1_000_000),
    move: schema.json,
  }),
  schema.object({ type: schema.literal('hint') }),
  schema.object({
    type: schema.literal('endRound'),
    reason: oneOf(['done', 'quit', 'time-up', 'time-limit'] as const),
  }),
  schema.object({ type: schema.literal('placementAnswer'), value: answerValueSchema, elapsedMs }),
  schema.object({ type: schema.literal('buy'), item: contentId }),
  schema.object({
    type: schema.literal('equip'),
    dragon: contentId,
    slot: oneOf(COSMETIC_SLOTS),
    item: nullable(contentId),
  }),
  schema.object({
    type: schema.literal('claimQuest'),
    quest: schema.string({ minLength: 3, maxLength: 96, pattern: /^[a-z0-9.:-]+@[0-9]+$/ }),
  }),
  schema.object({ type: schema.literal('openGift') }),
  schema.object({
    type: schema.literal('storyChoice'),
    beat: contentId,
    node: schema.string({ minLength: 1, maxLength: 128 }),
    revision: int(0, 1_000_000),
    choice: nullable(schema.string({ minLength: 1, maxLength: 128 })),
  }),
  schema.object({ type: schema.literal('setSetting'), setting: settingSchema }),
);
