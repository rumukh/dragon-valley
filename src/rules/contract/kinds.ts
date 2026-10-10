/**
 * Closed vocabularies of the rules: activity kinds, input modes, generators, operators, response
 * buckets and random streams. Each value is implemented in code, so adding one is a code change
 * plus a contract change (docs/contract.md, "Changing the contract").
 */

/**
 * Activity kinds. "Problem" activities serve one problem at a time and are answered with the
 * `answer` action; "minigame" activities are played with `minigameMove` on an `@aegis/narrative`
 * minigame instance. See docs/design.md §5 for every activity's rules.
 */
export const PROBLEM_ACTIVITY_KINDS = [
  'feeding',
  'compare-stones',
  'riddle-scrolls',
  'boss',
  'arena',
  'snack',
  'placement',
] as const;
export const MINIGAME_ACTIVITY_KINDS = [
  'memory-match',
  'number-trail',
  'egg-grid',
  'fact-family',
  'sharing-feast',
  'golem-orders',
  'ten-frame',
  'bundle-sticks',
] as const;
export const ACTIVITY_KINDS = [...PROBLEM_ACTIVITY_KINDS, ...MINIGAME_ACTIVITY_KINDS] as const;
export type ProblemActivityKind = (typeof PROBLEM_ACTIVITY_KINDS)[number];
export type MinigameActivityKind = (typeof MINIGAME_ACTIVITY_KINDS)[number];
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** Activity kinds a content level may list (arena, snack and placement are hub-only). */
export const LEVEL_ACTIVITY_KINDS = [
  'feeding',
  'compare-stones',
  'riddle-scrolls',
  'boss',
  ...MINIGAME_ACTIVITY_KINDS,
] as const;
export type LevelActivityKind = (typeof LEVEL_ACTIVITY_KINDS)[number];

export function isMinigameKind(kind: string): kind is MinigameActivityKind {
  return (MINIGAME_ACTIVITY_KINDS as readonly string[]).includes(kind);
}

/**
 * Narrative minigame kinds behind the minigame activities. `matching` and `ordering` are built
 * into `@aegis/narrative`; the `dv.*` kinds are custom `MinigameAdapter`s registered by the rules.
 */
export const MINIGAME_KIND_BY_ACTIVITY = {
  'memory-match': 'matching',
  'number-trail': 'ordering',
  'egg-grid': 'dv.egg-grid',
  'fact-family': 'dv.fact-family',
  'sharing-feast': 'dv.sharing-feast',
  'golem-orders': 'dv.golem-orders',
  'ten-frame': 'dv.ten-frame',
  'bundle-sticks': 'dv.place-value',
} as const satisfies Record<MinigameActivityKind, string>;
export type NarrativeMinigameKind =
  (typeof MINIGAME_KIND_BY_ACTIVITY)[keyof typeof MINIGAME_KIND_BY_ACTIVITY];

/**
 * Minigame activities reserved for grades 1-2 before their rules exist. The G2 boards moved Ten
 * Frame and Bundle Sticks into the playable lists; keep this export for older importers.
 */
export const RESERVED_MINIGAME_KIND_BY_ACTIVITY = {} as const satisfies Record<string, string>;
export type ReservedMinigameActivityKind = keyof typeof RESERVED_MINIGAME_KIND_BY_ACTIVITY;

/**
 * School grades the valley serves (docs/grades-plan.md). A profile's `settings.grade` picks where
 * the child starts and what the Daily Adventure suggests; content regions belong to one grade.
 */
export const GRADES = [1, 2, 3] as const;
export type Grade = (typeof GRADES)[number];
/** The grade of a save or region that does not name one: the valley as shipped is 3rd grade. */
export const DEFAULT_GRADE: Grade = 3;

/**
 * How answers are entered. `auto` resolves per problem: multiple choice while the item is new
 * (Leitner box below `balance.input.keypadFromBox`), keypad once it has strengthened.
 */
export const INPUT_MODES = ['auto', 'choice', 'keypad'] as const;
export type InputMode = (typeof INPUT_MODES)[number];
export type ResolvedInputMode = Exclude<InputMode, 'auto'>;

/** Arithmetic operators, notation-agnostic. Rendering is the shell's job (notation.ts). */
export const OPERATORS = ['add', 'sub', 'mul', 'div'] as const;
export type Operator = (typeof OPERATORS)[number];

/** Comparison relations for Compare Stones (`<`, `>`, `=` when rendered). */
export const RELATIONS = ['lt', 'gt', 'eq'] as const;
export type Relation = (typeof RELATIONS)[number];

/**
 * Response buckets. The shell measures `elapsedMs`; the rules sort a correct answer into `fast`,
 * `ok` or `slow` with `balance.response`, and record a wrong answer as `miss`.
 */
export const RESPONSE_BUCKETS = ['fast', 'ok', 'slow', 'miss'] as const;
export type ResponseBucket = (typeof RESPONSE_BUCKETS)[number];

/**
 * Problem generators. A content skill names one generator plus its parameters; the generator
 * enumerates the skill's item universe and draws problems from the `problems` stream. Adding a
 * generator is code (src/rules/learning/generators); adding a skill that uses one is data.
 */
export const GENERATOR_IDS = [
  'mul.fact',
  'div.fact',
  'mul.missing',
  'div.remainder',
  'mul.power10',
  'mul.tens',
  'mul.2d1d',
  'div.2d1d',
  'order.ops',
  'compare',
  'word',
  'terms',
  // Grades 1-2 (docs/curriculum.md §7).
  'num.count',
  'num.compare',
  'num.place',
  'add.fact',
  'sub.fact',
  'add.missing',
  'addsub.2d',
] as const;
export type GeneratorId = (typeof GENERATOR_IDS)[number];

/**
 * Named random streams, forked once by the runtime before initialisation. They are independent:
 * drawing a gift never changes the next problem. `main` (the runtime default) is unused by rules.
 */
export const RANDOM_STREAMS = ['problems', 'distractors', 'rewards', 'words'] as const;
export type RandomStreamName = (typeof RANDOM_STREAMS)[number];

/** Runtime event phases for scheduled jobs (only re-asks today). */
export const EVENT_PHASES = ['reask'] as const;
export type EventPhase = (typeof EVENT_PHASES)[number];

/** Runtime job rules. */
export const JOB_RULES = ['reask'] as const;
export type JobRuleId = (typeof JOB_RULES)[number];

/** Runtime phase IDs entered by the rules: a round, or the hub between rounds. */
export const RUNTIME_PHASES = ['hub', 'round'] as const;

/** Curriculum strands (docs/curriculum.md). */
export const STRANDS = [
  'meaning',
  'multiplication',
  'division',
  'remainder',
  'beyond-tables',
  'order-of-operations',
  'comparison',
  'word-problems',
  'terminology',
  // Grades 1-2.
  'numbers',
  'addition-subtraction',
] as const;
export type Strand = (typeof STRANDS)[number];

/** Word-problem families. Additive comparison is deliberately present: confusing "3 more" with
 * "3 times as many" is the classic error, so levels contrast the two. */
export const WORD_FAMILIES = [
  'equal-groups',
  'sharing',
  'grouping',
  'times-as-many',
  'times-fewer',
  'more-than',
  'fewer-than',
  'leftover',
  'two-step',
  // Grades 1-2: additive change stories (Petr has 5 apples and gets 3 more / gives 2 away).
  'add-to',
  'take-from',
] as const;
export type WordFamily = (typeof WORD_FAMILIES)[number];

/** The terms of multiplication and division (činitel, součin, dělenec, dělitel, podíl, zbytek). */
export const TERMS = ['factor', 'product', 'dividend', 'divisor', 'quotient', 'remainder'] as const;
export type Term = (typeof TERMS)[number];
