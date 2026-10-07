/**
 * Small, pure readings of the game view for screens: what kind of answer a problem takes, where
 * a level sits on the map, which dragon the hub features and how far it is from growing, the
 * boss's pose, what the Daily Adventure button does and where results lead. No rules live here:
 * every decision the game makes is already in the view; these only choose how to show it.
 */
import { OPERATORS } from '../../rules/contract';
import type {
  AnswerValue,
  DragonStage,
  DragonView,
  GameView,
  LevelCard,
  Problem,
  ProblemStep,
  ProblemView,
  RegionView,
} from '../../rules/contract';

export type AnswerKind = 'number' | 'remainder' | 'relation' | 'operation' | 'term';

/** The answer a problem takes at a step (structure only; the rules know the right one). */
export function answerKindOf(problem: Problem, step: ProblemStep): AnswerKind {
  switch (problem.kind) {
    case 'divrem':
      return 'remainder';
    case 'compare':
      return 'relation';
    case 'term':
      return 'term';
    case 'word':
      return step === 'operation' ? 'operation' : answerKindOf(problem.model, 'answer');
    case 'equation':
      return 'number';
  }
}

/**
 * The choice tiles for a problem at its current step, or `null` for the keypad. A story's
 * operation step is always answered with the four signs, whatever the input mode: the sign
 * cannot be typed, and the choices the view carries may be meant for the answer step.
 */
export function stepChoices(problem: ProblemView): AnswerValue[] | null {
  if (answerKindOf(problem.problem, problem.step) === 'operation') {
    const offered = (problem.choices ?? []).filter((choice) => choice.kind === 'operation');
    return offered.length > 0
      ? offered
      : OPERATORS.map((operation): AnswerValue => ({ kind: 'operation', operation }));
  }
  return problem.input === 'choice' && problem.choices ? problem.choices : null;
}

export function findRegion(view: GameView, regionId: string): RegionView | undefined {
  return view.hub.regions.find((region) => region.id === regionId);
}

export function findLevel(
  view: GameView,
  levelId: string,
): { readonly region: RegionView; readonly level: LevelCard } | undefined {
  for (const region of view.hub.regions) {
    const level = region.levels.find((candidate) => candidate.id === levelId);
    if (level) return { region, level };
  }
  return undefined;
}

/** The dragon the hub shows big: the first egg's dragon while it is owned, else the first one. */
export function featuredDragon(view: GameView): DragonView | undefined {
  const first = view.onboarding.firstEgg;
  return view.dragons.find((dragon) => dragon.id === first) ?? view.dragons[0];
}

export interface Growth {
  /** The stage the dragon grows into next. */
  readonly next: DragonStage;
  /** Facts of the dragon's set at the needed mastery, and how many the next stage needs. */
  readonly have: number;
  readonly need: number;
}

/**
 * How far a dragon is from its next stage ("4 of 7 facts"), from the rules' exact counts, or
 * null when it is crowned.
 */
export function growthOf(dragon: DragonView): Growth | null {
  const next = dragon.next;
  if (!next) return null;
  const need = Math.max(1, next.need);
  return { next: next.stage, have: Math.min(next.have, need), need };
}

export type BossPose = 'start' | 'warming' | 'won';

/** The boss's pose for its meter: the challenge, about half way, and won over. */
export function bossPose(
  meter: { readonly value: number; readonly target: number } | null,
  complete: boolean,
): BossPose {
  if (complete || (meter !== null && meter.target > 0 && meter.value >= meter.target)) {
    return 'won';
  }
  if (meter !== null && meter.target > 0 && meter.value * 2 >= meter.target) return 'warming';
  return 'start';
}

/** What a problem says above itself when it is taught or asked again. */
export type ProblemNote =
  | 'round.teach'
  | 'round.reask'
  | 'round.teachPlain'
  | 'round.reaskPlain'
  | 'round.rule.timesZero'
  | 'round.rule.zeroDivided';

type ExprNode = Extract<Problem, { kind: 'equation' }>['left'];

function isZero(expr: ExprNode): boolean {
  return expr.kind === 'num' && expr.value === 0;
}

/** Every operation node of an expression. */
function operations(expr: ExprNode): Extract<ExprNode, { kind: 'op' }>[] {
  if (expr.kind === 'op') return [expr, ...operations(expr.left), ...operations(expr.right)];
  if (expr.kind === 'group') return operations(expr.inner);
  return [];
}

/**
 * The rule that answers a fact about zero, which has no picture to count: "any number times 0
 * is 0" (`4 · 0`, `0 · 7`, `? · 5 = 0`) or "0 divided by any number is 0" (`0 : 6`, `? : 6 = 0`).
 */
export function zeroRule(
  problem: Problem,
): 'round.rule.timesZero' | 'round.rule.zeroDivided' | null {
  if (problem.kind === 'word') return zeroRule(problem.model);
  if (problem.kind !== 'equation') return null;
  const sides = [problem.left, problem.right];
  for (const [index, side] of sides.entries()) {
    for (const node of operations(side)) {
      if (
        node.op === 'mul' &&
        (isZero(node.left) || isZero(node.right) || isZero(sides[1 - index]!))
      ) {
        return 'round.rule.timesZero';
      }
      if (node.op === 'div' && (isZero(node.left) || isZero(sides[1 - index]!))) {
        return 'round.rule.zeroDivided';
      }
    }
  }
  return null;
}

/**
 * The note above a problem: a fact taught after two misses in a row (`teach`, docs/app.md §14)
 * or asked again (`reask`) sends the child to look at its picture first. A fact with no picture
 * never says "look" (DV-QA-18): a fact about zero says its rule instead, any other one only that
 * it comes again.
 */
export function problemNote(
  problem: Pick<ProblemView, 'reask' | 'teach' | 'problem'>,
  hasPicture: boolean,
): ProblemNote | null {
  const taught = problem.teach === true;
  if (!taught && !problem.reask) return null;
  if (hasPicture) return taught ? 'round.teach' : 'round.reask';
  return zeroRule(problem.problem) ?? (taught ? 'round.teachPlain' : 'round.reaskPlain');
}

/** Whether a problem shows its picture before the answer: re-asked, taught, or a hint asked. */
export function pictureFirst(problem: Pick<ProblemView, 'reask' | 'teach' | 'hinted'>): boolean {
  return problem.reask || problem.teach === true || problem.hinted;
}

/**
 * The day the game is on once today's session has started (`today` is the local date): the rules
 * never go back a day, so a save from a device whose clock ran ahead keeps its own day.
 */
export function gameDay(view: Pick<GameView, 'day'>, today: string): string {
  return view.day !== null && view.day > today ? view.day : today;
}

/**
 * Heads won over so far, for a boss won over head by head: the meter is shared evenly between
 * the heads (docs/contract.md, `RegionView.boss.heads`).
 */
export function curedHeads(
  meter: { readonly value: number; readonly target: number } | null,
  heads: number,
): number {
  if (meter === null || meter.target <= 0 || heads < 1) return 0;
  return Math.min(heads, Math.floor((meter.value * heads) / meter.target));
}

export type Adventure =
  | { readonly kind: 'level'; readonly level: string; readonly resume: number | null }
  | { readonly kind: 'minigame'; readonly level: string; readonly activity: number }
  | { readonly kind: 'snack'; readonly dragon: string | null }
  | { readonly kind: 'placement' }
  | { readonly kind: 'gift' }
  | { readonly kind: 'story' }
  | { readonly kind: 'map' };

/**
 * What the Daily Adventure button does now (docs/design.md §4.2). A level already in progress
 * resumes at its next activity instead of starting over; a `minigame` step replays one game of a
 * finished level.
 */
export function adventureFor(view: GameView): Adventure {
  const next = view.hub.next;
  switch (next.kind) {
    case 'level': {
      const run = view.run;
      const resume =
        run !== null && run.level === next.level && run.result === null ? run.next : null;
      return { kind: 'level', level: next.level, resume };
    }
    case 'minigame':
      return { kind: 'minigame', level: next.level, activity: next.activity };
    case 'snack':
      return { kind: 'snack', dragon: next.dragon };
    case 'placement':
      return { kind: 'placement' };
    case 'gift':
      return { kind: 'gift' };
    case 'story':
      return { kind: 'story' };
    case 'free-play':
      return { kind: 'map' };
  }
}

export type ResultsNext =
  { readonly kind: 'activity'; readonly index: number } | { readonly kind: 'done' };

/** After a finished round: the level's next activity, or back to the valley. */
export function resultsNext(view: GameView): ResultsNext {
  const done: ResultsNext = { kind: 'done' };
  const { round, run } = view;
  if (!round || round.status !== 'complete' || round.source.kind !== 'level') return done;
  if (round.endReason === 'quit' || round.endReason === 'time-limit') return done;
  if (!run || run.result !== null || run.next >= run.activities.length) return done;
  return { kind: 'activity', index: run.next };
}

/** A local calendar date `YYYY-MM-DD` as the weekday index used by `daily.week` (Monday = 0). */
export function weekdayIndex(day: string): number {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  // Days since Monday 1970-01-05, counted in UTC so no time zone can shift the date.
  const days = Math.floor(Date.UTC(year, month - 1, date) / 86_400_000);
  return (((days - 4) % 7) + 7) % 7;
}
