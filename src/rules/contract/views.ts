/**
 * The view: a JSON projection of the state for the shell. It is recomputed by the rules on every
 * commit and is the only thing screens render from (plus the commit's events for one-shots).
 * Everything a screen needs is precomputed here, so the shell holds no game logic: map status,
 * stars, the current problem and its choices, feedback, dragons and their expressions, the
 * Magic Window, the market, the album, the daily quests and the parent statistics.
 *
 * Text is never rendered here: `*Key` fields are catalog keys, problems are structured
 * (problems.ts) and days are ISO dates.
 */
import type { JsonValue } from '@aegis/runtime';
import type { CosmeticSlot, DragonExpression, DragonStage, MasteryLevel } from './ids';
import type {
  InputMode,
  MinigameActivityKind,
  ProblemActivityKind,
  ResolvedInputMode,
} from './kinds';
import type { BossMood, DragonKind, QuestGoal } from './content';
import type { BoardView } from './minigames';
import type { AnswerValue, Problem, ProblemStep } from './problems';
import type { Feedback, RoundEndReason, RoundSource, RuleSettings } from './state';

/** What the shell should show when it has no other navigation intent. */
export type Screen = 'story' | 'hub' | 'round' | 'results';

export interface GameView {
  revision: number;
  turn: number;
  /** The session's local date, `null` before the first session. */
  day: string | null;
  screen: Screen;
  coins: number;
  settings: RuleSettings;
  onboarding: { firstEgg: string | null; placement: 'pending' | 'done' | 'skipped' };
  story: StoryView | null;
  hub: HubView;
  run: RunView | null;
  round: RoundView | null;
  dragons: DragonView[];
  window: WindowView;
  market: MarketView;
  album: AlbumView;
  daily: DailyView | null;
  parent: ParentView;
}

// ------------------------------------------------------------------------------ story

export interface StoryView {
  beat: string;
  skippable: boolean;
  node: string;
  scene: string;
  /** Catalog key of the line; read aloud by the shell. */
  text: string;
  revision: number;
  choices: { id: string; text: string; enabled: boolean }[];
  /** True when the beat has reached a node with no choices. */
  finished: boolean;
}

// ------------------------------------------------------------------------------ hub / map

export type LevelStatus = 'locked' | 'open' | 'completed';

export interface LevelCard {
  id: string;
  titleKey: string;
  order: number;
  kind: 'lesson' | 'boss';
  status: LevelStatus;
  stars: number;
  placed: boolean;
  /** The level the map should make glow (the next suggestion). */
  glowing: boolean;
}

export interface RegionView {
  id: string;
  titleKey: string;
  order: number;
  background: string;
  unlocked: boolean;
  /** `heads`: 1, or more for a boss won over head by head (the meter is shared evenly; heads
   * cured = floor(meter.value * heads / meter.target)). */
  boss: {
    id: string;
    nameKey: string;
    mood: BossMood;
    defeated: boolean;
    heads: number;
  } | null;
  levels: LevelCard[];
}

/** The Daily Adventure's next step, in priority order (docs/design.md §4.2). */
export type NextStep =
  | { kind: 'story'; beat: string }
  | { kind: 'placement' }
  | { kind: 'snack'; dragon: string | null }
  | { kind: 'level'; level: string }
  /** Replay a minigame activity of a completed level (once a day, after the day's first level). */
  | { kind: 'minigame'; level: string; activity: number }
  | { kind: 'gift' }
  | { kind: 'free-play' };

export interface HubView {
  regions: RegionView[];
  next: NextStep;
  /** Dragons with due items ("hungry for snacks"). */
  hungry: string[];
  arena: { available: boolean; best: number };
}

// ------------------------------------------------------------------------------ rounds

export interface RunView {
  level: string;
  next: number;
  activities: {
    index: number;
    kind: ProblemActivityKind | MinigameActivityKind;
    done: boolean;
  }[];
  /** Set once every activity is done: the level result. */
  result: { stars: number; accuracy: number; firstTime: boolean } | null;
}

export interface ProblemView {
  index: number;
  item: string;
  problem: Problem;
  input: ResolvedInputMode;
  choices: AnswerValue[] | null;
  step: ProblemStep;
  reask: boolean;
  hinted: boolean;
  /** Present when the item was missed twice in a row: show the picture model before asking. */
  teach?: boolean;
}

export interface ProblemRoundView {
  id: string;
  type: 'problems';
  activity: ProblemActivityKind;
  source: RoundSource;
  input: InputMode;
  status: 'active' | 'complete';
  endReason: RoundEndReason | null;
  progress: {
    answered: number;
    target: number | null;
    correct: number;
    streak: number;
    meter: { value: number; target: number } | null;
  };
  problem: ProblemView | null;
  feedback: Feedback | null;
  coins: number;
  /** The dragon being fed or cheering, and its expression hint. */
  dragon: { id: string; expression: DragonExpression } | null;
  /** The placement check's ladder (only for `activity: 'placement'`): the step being asked
   * (0-based; equal to `steps` once the ladder is done) and the levels placed so far. */
  placement: { step: number; steps: number; placed: string[] } | null;
}

export interface MinigameRoundView {
  id: string;
  type: 'minigame';
  activity: MinigameActivityKind;
  source: RoundSource;
  status: 'active' | 'complete';
  endReason: RoundEndReason | null;
  /** Boards completed so far, and boards in the round. */
  board: number;
  boards: number;
  /** `projectMinigame` output for the current board (hidden faces are absent). The `revision`
   * is what `minigameMove.revision` must carry. */
  minigame: { definition: string; status: string; revision: number; view: JsonValue };
  /** The current board as a typed view (minigames.ts); render from this. */
  current: BoardView;
  coins: number;
}

export type RoundView = ProblemRoundView | MinigameRoundView;

// ------------------------------------------------------------------------------ dragons and window

export interface DragonView {
  id: string;
  nameKey: string;
  kind: DragonKind;
  table: number | null;
  rig: string;
  stage: DragonStage;
  expression: DragonExpression;
  /** Share of the mastery set at each level or better, in percent. */
  mastery: { seen: number; bronze: number; silver: number; gold: number; items: number };
  hungry: boolean;
  dueItems: number;
  outfit: Record<CosmeticSlot, string | null>;
  /** The next stage and its requirement, or `null` when crowned. `have` of the mastery set's
   * `items` are at `mastery` or better and `need` must be (`share` percent, rounded up): the
   * exact counts behind "4 of 7 facts" (the percentages above are rounded down). */
  next: {
    stage: DragonStage;
    share: number;
    mastery: 'seen' | 'bronze' | 'silver' | 'gold';
    have: number;
    need: number;
  } | null;
}

export interface WindowCell {
  item: string;
  /** Multiplication: row = first factor, column = second factor (0..10).
   * Division panel: row = divisor (1..10), column = quotient (0..10). */
  row: number;
  column: number;
  level: MasteryLevel;
  /** A known fact that is due again: the pane "needs polishing". */
  needsPolish: boolean;
}

/** The Magic Window: an 11 x 11 mosaic of all multiplication facts plus a division panel. */
export interface WindowView {
  size: 11;
  /** 121 cells, row-major from `mul:0x0` to `mul:10x10`. */
  cells: WindowCell[];
  /** 110 cells, by divisor then quotient. */
  division: WindowCell[];
  counts: Record<MasteryLevel, number>;
}

// ------------------------------------------------------------------------------ economy

export interface MarketItem {
  id: string;
  slot: CosmeticSlot;
  assetId: string;
  nameKey: string;
  price: number;
  owned: boolean;
  affordable: boolean;
  available: boolean;
}

export interface MarketView {
  items: MarketItem[];
}

export interface AlbumView {
  pages: {
    region: string;
    stickers: {
      id: string;
      nameKey: string;
      icon: string;
      color: string;
      frame: string;
      earned: boolean;
      day: string | null;
    }[];
  }[];
  earned: number;
  total: number;
}

export interface QuestView {
  id: string;
  template: string;
  titleKey: string;
  goal: QuestGoal;
  target: number;
  progress: number;
  done: boolean;
  claimed: boolean;
  coins: number;
}

export interface DailyView {
  day: string;
  goal: number;
  correct: number;
  answers: number;
  reached: boolean;
  quests: QuestView[];
  gift: 'locked' | 'ready' | 'opened';
  /** Monday..Sunday of the current week: practised that day. A habit view, not a streak. */
  week: boolean[];
  /** After the goal: the dragons are sleepy (play may continue). */
  sleepy: boolean;
}

// ------------------------------------------------------------------------------ parent area

export interface ParentView {
  /** Per times table 0..10: accuracy and fluency over its multiplication facts. */
  tables: { table: number; accuracy: number; fastShare: number; mastered: number; items: number }[];
  skills: { skill: string; titleKey: string; accuracy: number; mastered: number; items: number }[];
  /** The hardest facts (lowest accuracy, then lowest box), at most 10. */
  hardest: { item: string; accuracy: number; box: number }[];
  /** The last 60 practised days, oldest first. */
  trend: { day: string; answers: number; correct: number; fast: number }[];
  daysPracticed: number;
  answers: number;
}
