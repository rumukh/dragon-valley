/**
 * Event vocabulary. Rules emit these as transient runtime events with each commit; the shell
 * turns them into one-shot sounds, animations and announcements (S3 maps events to S5's sound
 * IDs), and tests assert on them by name. Events are never replayed: after a restore the shell
 * rebuilds the screen from the view, not from past events.
 *
 * Names are `<subject>.<verb>`. Payloads are small JSON objects of IDs and numbers.
 */
import type { DragonStage, MasteryLevel } from './ids';
import type { Grade } from './kinds';
import type { ProblemActivityKind, MinigameActivityKind, ResponseBucket } from './kinds';
import type { Grant } from './content';

export const EVENTS = {
  // Session and answers
  sessionStarted: 'session.started',
  roundStarted: 'round.started',
  answerCorrect: 'answer.correct',
  answerIncorrect: 'answer.incorrect',
  itemPromoted: 'item.promoted',
  reaskScheduled: 'reask.scheduled',
  hintShown: 'hint.shown',
  // Progression
  roundCompleted: 'round.completed',
  levelCompleted: 'level.completed',
  regionUnlocked: 'region.unlocked',
  bossDefeated: 'boss.defeated',
  placementCompleted: 'placement.completed',
  gradeCompleted: 'grade.completed',
  // Dragons and the Magic Window
  eggReceived: 'egg.received',
  dragonHatched: 'dragon.hatched',
  dragonGrew: 'dragon.grew',
  dragonCrowned: 'dragon.crowned',
  dragonDressed: 'dragon.dressed',
  paneLit: 'pane.lit',
  // Economy, collections and story
  coinsEarned: 'coins.earned',
  itemPurchased: 'item.purchased',
  stickerEarned: 'sticker.earned',
  questCompleted: 'quest.completed',
  questClaimed: 'quest.claimed',
  dailyGoalReached: 'daily.goal-reached',
  giftOpened: 'gift.opened',
  storyAdvanced: 'story.advanced',
  finaleCompleted: 'finale.completed',
  minigameCompleted: 'minigame.completed',
  arenaFinished: 'arena.finished',
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];

export const EVENT_TYPES: readonly EventType[] = Object.values(EVENTS);

/** Payload of each event type. */
export interface EventPayloads {
  'session.started': { day: string; newDay: boolean };
  'round.started': { round: string; activity: ProblemActivityKind | MinigameActivityKind };
  'answer.correct': { item: string; bucket: Exclude<ResponseBucket, 'miss'>; streak: number };
  'answer.incorrect': { item: string };
  'item.promoted': { item: string; box: number };
  'reask.scheduled': { item: string; dueTurn: number };
  'hint.shown': { item: string };
  'round.completed': { round: string; answered: number; correct: number; fast: number };
  'level.completed': { level: string; stars: number; firstTime: boolean };
  'region.unlocked': { region: string };
  'boss.defeated': { boss: string };
  'placement.completed': { placed: string[] };
  /** The last boss of an earlier grade's regions was defeated: its certificate (grades 1-2). */
  'grade.completed': { grade: Grade };
  'egg.received': { dragon: string };
  'dragon.hatched': { dragon: string };
  'dragon.grew': { dragon: string; stage: DragonStage };
  'dragon.crowned': { dragon: string };
  'dragon.dressed': { dragon: string; slot: string; item: string | null };
  'pane.lit': { item: string; level: MasteryLevel };
  'coins.earned': { amount: number; reason: CoinReason };
  'item.purchased': { item: string; price: number };
  'sticker.earned': { sticker: string };
  'quest.completed': { quest: string };
  'quest.claimed': { quest: string; coins: number };
  'daily.goal-reached': { day: string };
  'gift.opened': { grant: Grant };
  'story.advanced': { beat: string; node: string; finished: boolean };
  'finale.completed': Record<string, never>;
  'minigame.completed': { round: string; board: number };
  /** A Lightning Arena race ran to its end: right answers, the personal best, a new record? */
  'arena.finished': { score: number; best: number; record: boolean };
}

export type CoinReason =
  'answer' | 'streak' | 'stars' | 'boss' | 'quest' | 'gift' | 'placement' | 'story';

/** A typed event, as found in `RuntimeCommit.events` (with `rule` set by the runtime). */
export type GameEvent = { [T in EventType]: { type: T; data: EventPayloads[T] } }[EventType];
